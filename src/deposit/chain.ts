/**
 * On-chain reads and simulation for deposit plans.
 *
 * Every read of a plan happens at one block (spec R2), in one multicall, and is
 * never cached (spec R3). The built steps are then replayed on that block with
 * eth_simulateV1 before the plan is returned.
 */

import {
  createPublicClient,
  decodeErrorResult,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  defineChain,
  getAddress,
  http,
  type Address,
  toHex,
  type Hex,
  type PublicClient,
} from 'viem';
import { erc20Abi, factoryAbi, vaultAbi } from './abi.js';
import { rpcUrlFor, type DepositChainConfig, type VaultFamily } from './config.js';
import type { ChainReading, VaultReading } from './build-plan.js';
import type { IssueCode, PlanSimulation } from './types.js';

/**
 * Storage the vaults expose no getter for (ERC-7201 namespaces, the same in
 * every version from v0.1 to v0.6, see lagoon-v0-internal):
 * - `hopper.storage.vault`: first field `State state` (0 Open, 1 Closing,
 *   2 Closed). v0.6 accepts deposit requests while closing, but they can
 *   never be settled, so only Open vaults take deposits.
 * - `hopper.storage.ERC7540`, slot + 10 (v0.5 and v0.6): `uint128
 *   totalAssetsExpiration` in the low 128 bits, when the NAV expires.
 */
export const VAULT_STATE_SLOT =
  '0x0e6b3200a60a991c539f47dddaca04a18eb4bcf2b53906fb44751d827f001400' as const;
export const NAV_EXPIRATION_SLOT = toHex(
  BigInt('0x5c74d456014b1c0eb4368d944667a568313858a3029a650ff0cb7b56f8b57a00') + 10n,
  { size: 32 }
);

const lowBits = (word: Hex | undefined, bits: bigint): bigint | undefined =>
  word === undefined ? undefined : BigInt(word) & ((1n << bits) - 1n);

export function clientFor(chain: DepositChainConfig): PublicClient | undefined {
  const url = rpcUrlFor(chain.chainId);
  if (!url) return undefined;
  return createPublicClient({
    chain: defineChain({
      id: chain.chainId,
      name: chain.name,
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: [url] } },
      contracts: { multicall3: { address: chain.multicall3 } },
    }),
    transport: http(url, { timeout: 20_000 }),
  });
}

/** Which of these addresses are Lagoon vaults: a chain factory made them, or a listed legacy vault */
export async function areLagoonVaults(
  client: PublicClient,
  chain: DepositChainConfig,
  addresses: Address[],
  blockNumber: bigint
): Promise<boolean[]> {
  if (addresses.length === 0) return [];
  const instances = await client.multicall({
    blockNumber,
    allowFailure: true,
    contracts: addresses.flatMap((vault) =>
      chain.factories.map((factory) => ({
        address: factory,
        abi: factoryAbi,
        functionName: 'isInstance' as const,
        args: [vault] as const,
      }))
    ),
  });
  return addresses.map(
    (address, v) =>
      chain.factories.some((_, f) => instances[v * chain.factories.length + f]?.result === true) ||
      chain.legacyVaults.some((a) => a.toLowerCase() === address.toLowerCase())
  );
}

/**
 * The view calls read for each vault. Some only exist on some versions (see
 * abi.ts): they fail on the others, and the reading leaves them undefined.
 */
function vaultCalls(chain: DepositChainConfig, account: Address, vault: Address) {
  return [
    { address: vault, abi: vaultAbi, functionName: 'name' },
    { address: vault, abi: vaultAbi, functionName: 'version' },
    { address: vault, abi: vaultAbi, functionName: 'asset' },
    { address: vault, abi: vaultAbi, functionName: 'decimals' },
    { address: vault, abi: vaultAbi, functionName: 'paused' },
    { address: vault, abi: vaultAbi, functionName: 'isAllowed', args: [account] },
    { address: vault, abi: vaultAbi, functionName: 'isWhitelisted', args: [account] },
    { address: vault, abi: vaultAbi, functionName: 'maxCap' },
    { address: vault, abi: vaultAbi, functionName: 'totalAssets' },
    { address: vault, abi: vaultAbi, functionName: 'syncMode' },
    { address: vault, abi: vaultAbi, functionName: 'isTotalAssetsValid' },
    { address: vault, abi: vaultAbi, functionName: 'feeRates' },
    { address: vault, abi: vaultAbi, functionName: 'pendingDepositRequest', args: [0n, account] },
    { address: chain.usdc, abi: erc20Abi, functionName: 'allowance', args: [account, vault] },
  ] as const;
}

/** The state byte of the vault's storage word, when it could be read */
function storedState(word: Hex | undefined): number | undefined {
  const state = lowBits(word, 8n);
  return state === undefined ? undefined : Number(state);
}

export async function readChainState(
  client: PublicClient,
  chain: DepositChainConfig,
  account: Address,
  vaultAddresses: Address[]
): Promise<ChainReading> {
  const block = await client.getBlock({ blockTag: 'latest' });
  const blockNumber = block.number;
  const calls = vaultAddresses.map((vault) => vaultCalls(chain, account, vault));
  const storage = (address: Address, slot: Hex): Promise<Hex | undefined> =>
    client.getStorageAt({ address, slot, blockNumber }).catch(() => undefined);

  const [balance, results, lagoon, states, expirations] = await Promise.all([
    client.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
      blockNumber,
    }),
    client.multicall({ blockNumber, allowFailure: true, contracts: calls.flat() }),
    areLagoonVaults(client, chain, vaultAddresses, blockNumber),
    Promise.all(vaultAddresses.map((vault) => storage(vault, VAULT_STATE_SLOT))),
    Promise.all(vaultAddresses.map((vault) => storage(vault, NAV_EXPIRATION_SLOT))),
  ]);

  let offset = 0;
  const vaults: VaultReading[] = vaultAddresses.map((address, v) => {
    // What each call of this vault returned, by function name
    const returned = new Map<string, unknown>();
    calls[v].forEach((call, k) => {
      const result = results[offset + k];
      if (result?.status === 'success') returned.set(call.functionName, result.result);
    });
    offset += calls[v].length;
    const read = <T>(functionName: string): T | undefined => returned.get(functionName) as T;

    return {
      address: getAddress(address),
      isLagoon: lagoon[v],
      name: read<string>('name'),
      decimals: read<number>('decimals'),
      version: read<string>('version'),
      asset: read<Address>('asset'),
      paused: read<boolean>('paused'),
      // v0.6 has isAllowed, older versions isWhitelisted
      isAllowed: read<boolean>('isAllowed') ?? read<boolean>('isWhitelisted'),
      maxCap: read<bigint>('maxCap'),
      totalAssets: read<bigint>('totalAssets'),
      syncMode: read<number>('syncMode'),
      navValid: read<boolean>('isTotalAssetsValid'),
      entryRateBps: read<{ entryRate: number }>('feeRates')?.entryRate,
      pendingDeposit: read<bigint>('pendingDepositRequest'),
      state: storedState(states[v]),
      navExpiration: lowBits(expirations[v], 128n),
      allowance: read<bigint>('allowance') ?? 0n,
    };
  });

  return { chainId: chain.chainId, blockNumber, timestamp: block.timestamp, balance, vaults };
}

/**
 * The shares each sync deposit mints, at the plan's block: previewSyncDeposit
 * on v0.6 (entry fee included), convertToShares on v0.5 (what syncDeposit uses)
 */
export async function readPreviews(
  client: PublicClient,
  blockNumber: bigint,
  requests: Array<{ vault: Address; assets: bigint; family: VaultFamily } | undefined>
): Promise<Array<bigint | undefined>> {
  const wanted = requests.flatMap((r, i) => (r ? [{ ...r, i }] : []));
  if (wanted.length === 0) return requests.map(() => undefined);
  const results = await client.multicall({
    blockNumber,
    allowFailure: true,
    contracts: wanted.map((r) => ({
      address: r.vault,
      abi: vaultAbi,
      functionName:
        r.family === 'v0.6' ? ('previewSyncDeposit' as const) : ('convertToShares' as const),
      args: [r.assets] as const,
    })),
  });
  const out: Array<bigint | undefined> = requests.map(() => undefined);
  wanted.forEach((r, k) => {
    if (results[k]?.status === 'success') out[r.i] = results[k].result;
  });
  return out;
}

const REVERT_TO_ISSUE: Record<string, IssueCode> = {
  NotOpen: 'VAULT_NOT_OPEN',
  Closed: 'VAULT_NOT_OPEN',
  EnforcedPause: 'VAULT_PAUSED',
  AddressNotAllowed: 'ACCESS_DENIED',
  NotWhitelisted: 'ACCESS_DENIED',
  MaxCapReached: 'MAX_CAP_REACHED',
  OnlyOneRequestAllowed: 'PENDING_REQUEST_EXISTS',
  ERC20InsufficientBalance: 'INSUFFICIENT_BALANCE',
};

const revertAbi = parseAbi(['error Error(string reason)']);

/** Decodes a revert into a Lagoon/ERC-20 error name, or a plain revert's reason */
export function decodeRevert(data: Hex | undefined): string | undefined {
  if (!data || data === '0x') return undefined;
  try {
    const decoded = decodeErrorResult({ abi: [...vaultAbi, ...erc20Abi, ...revertAbi], data });
    // A plain revert("reason"): the reason says more than "Error"
    return decoded.errorName === 'Error' && typeof decoded.args?.[0] === 'string'
      ? decoded.args[0]
      : decoded.errorName;
  } catch {
    return undefined;
  }
}

export function issueCodeForRevert(errorName: string | undefined): IssueCode {
  return (errorName && REVERT_TO_ISSUE[errorName]) || 'SIMULATION_FAILED';
}

/** The first line of an error's message: viem appends multi-line details */
export const firstLine = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message.split('\n')[0] : fallback;

type RpcError = {
  message?: string;
  details?: string;
  code?: number;
  data?: unknown;
  cause?: unknown;
};

/** An error and the errors it wraps (viem nests the RPC's error in `cause`) */
function* errorAndCauses(error: unknown): Generator<RpcError> {
  for (let e = error as RpcError | undefined; e; e = e.cause as RpcError | undefined) yield e;
}

/** JSON-RPC "method not found" */
const METHOD_NOT_FOUND = -32601;

/** Whether an RPC error says the node does not offer eth_simulateV1 */
export function isSimulateUnsupported(error: unknown): boolean {
  for (const e of errorAndCauses(error)) {
    if (e.code === METHOD_NOT_FOUND) return true;
    const text = `${e.message ?? ''} ${e.details ?? ''}`;
    const namesTheMethod = /eth_simulateV1/i.test(text);
    const saysMissing = /not (available|supported|found)|does not exist|unsupported/i.test(text);
    if (namesTheMethod && saysMissing) return true;
  }
  return false;
}

/** The revert data an eth_call error carries, if any */
function revertDataOf(error: unknown): Hex | undefined {
  for (const e of errorAndCauses(error)) {
    if (typeof e.data === 'string' && e.data.startsWith('0x')) return e.data as Hex;
    const nested = (e.data as { data?: unknown } | undefined)?.data;
    if (typeof nested === 'string') return nested as Hex;
  }
  return undefined;
}

/** Storage key of allowance[owner][spender] for an allowance mapping at `slot` */
export const allowanceKey = (owner: Address, spender: Address, slot: bigint): Hex =>
  keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes32' }],
      [
        spender,
        keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [owner, slot])),
      ]
    )
  );

/** Addresses only used to find the allowance slot, never real accounts */
export const SLOT_PROBE = {
  owner: '0x00000000000000000000000000000000000a11ce' as Address,
  spender: '0x0000000000000000000000000000000000000b0b' as Address,
};

/** Storage slot of each token's `allowance` mapping, found once per token */
const allowanceSlots = new Map<string, bigint>();

/** How far to look for the allowance mapping: token layouts put it in the first slots */
const MAX_ALLOWANCE_SLOT = 64n;

/**
 * Finds the slot of an ERC-20's allowance mapping (`mapping(owner =>
 * mapping(spender => amount))`) by overriding candidate slots until
 * `allowance()` reads the override back. Read-only.
 */
async function findAllowanceSlot(
  client: PublicClient,
  token: Address,
  blockNumber: bigint
): Promise<bigint | undefined> {
  const cacheKey = `${client.chain?.id}:${token.toLowerCase()}`;
  const cached = allowanceSlots.get(cacheKey);
  if (cached !== undefined) return cached;
  const { owner, spender } = SLOT_PROBE;
  // Any value no real allowance of the probe addresses would have
  const marker = 123_456_789n;
  for (let slot = 0n; slot < MAX_ALLOWANCE_SLOT; slot++) {
    const { data } = await client.call({
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender],
      }),
      blockNumber,
      stateOverride: [
        {
          address: token,
          stateDiff: [
            { slot: allowanceKey(owner, spender, slot), value: toHex(marker, { size: 32 }) },
          ],
        },
      ],
    });
    if (data && BigInt(data) === marker) {
      allowanceSlots.set(cacheKey, slot);
      return slot;
    }
  }
  return undefined;
}

type PlanStep = { id: string; execution: { to: Address; data: Hex } };
type CallResult = { success: boolean; data?: Hex; error?: string; gasUsed?: bigint };
type Approval = { token: Address; spender: Address; amount: bigint };

/** The approval a step grants, when it is an ERC-20 approve */
function approvalIn(step: PlanStep): Approval | undefined {
  try {
    const call = decodeFunctionData({ abi: erc20Abi, data: step.execution.data });
    if (call.functionName !== 'approve') return undefined;
    const [spender, amount] = call.args;
    return { token: step.execution.to, spender, amount };
  } catch {
    return undefined;
  }
}

/** Storage overrides that make `account`'s earlier approvals already granted */
async function approvalOverrides(
  client: PublicClient,
  blockNumber: bigint,
  account: Address,
  approvals: Approval[]
): Promise<Array<{ address: Address; stateDiff: Array<{ slot: Hex; value: Hex }> }>> {
  const byToken = new Map<Address, Array<{ slot: Hex; value: Hex }>>();
  for (const approval of approvals) {
    const slot = await findAllowanceSlot(client, approval.token, blockNumber);
    if (slot === undefined) throw new Error(`cannot simulate approvals of ${approval.token}`);
    const diffs = byToken.get(approval.token) ?? [];
    diffs.push({
      slot: allowanceKey(account, approval.spender, slot),
      value: toHex(approval.amount, { size: 32 }),
    });
    byToken.set(approval.token, diffs);
  }
  return [...byToken].map(([address, stateDiff]) => ({ address, stateDiff }));
}

/**
 * The plan replayed with eth_call, for nodes without eth_simulateV1 (all
 * Avalanche nodes): each step runs at the plan's block from the account,
 * with the approvals before it written into the token's storage. Calls do
 * not see each other's other effects (e.g. the USDC an earlier deposit
 * spent), so the balance check covers the total.
 */
async function simulateByCalls(
  client: PublicClient,
  blockNumber: bigint,
  account: Address,
  steps: PlanStep[]
): Promise<CallResult[]> {
  const approvals: Approval[] = [];
  const results: CallResult[] = [];
  for (const step of steps) {
    const stateOverride = await approvalOverrides(client, blockNumber, account, approvals);
    try {
      await client.call({
        account,
        to: step.execution.to,
        data: step.execution.data,
        blockNumber,
        stateOverride,
      });
      results.push({ success: true });
    } catch (error) {
      results.push({
        success: false,
        data: revertDataOf(error),
        error: firstLine(error, 'reverted'),
      });
    }
    const approval = approvalIn(step);
    if (approval) approvals.push(approval);
  }
  return results;
}

/** eth_simulateV1 over the whole plan */
async function simulateTogether(
  client: PublicClient,
  blockNumber: bigint,
  account: Address,
  steps: PlanStep[]
): Promise<CallResult[]> {
  const { results } = await client.simulateCalls({
    account,
    blockNumber,
    calls: steps.map((s) => ({ to: s.execution.to, data: s.execution.data })),
  });
  return results.map((r) => ({
    success: r.status === 'success',
    data: r.data,
    error: r.error?.message?.split('\n')[0],
    gasUsed: r.gasUsed,
  }));
}

/**
 * Replays the steps in order from the account, on the plan's block: with
 * eth_simulateV1, or eth_call where the node lacks it (`method` says which).
 */
export async function simulatePlan(
  client: PublicClient,
  chainId: number,
  blockNumber: bigint,
  account: Address,
  steps: PlanStep[]
): Promise<PlanSimulation & { revertName?: string }> {
  let method: PlanSimulation['method'] = 'eth_simulateV1';
  let results: CallResult[];
  try {
    results = await simulateTogether(client, blockNumber, account, steps);
  } catch (error) {
    if (!isSimulateUnsupported(error)) throw error;
    method = 'eth_call';
    results = await simulateByCalls(client, blockNumber, account, steps);
  }

  let revertName: string | undefined;
  const calls = steps.map((step, i) => {
    const result = results[i];
    const success = result?.success === true;
    let error: string | undefined;
    if (!success) {
      const name = decodeRevert(result?.data);
      revertName ??= name;
      error = name ?? result?.error ?? 'reverted';
    }
    return { stepId: step.id, success, gasUsed: (result?.gasUsed ?? 0n).toString(), error };
  });

  return {
    chainId,
    blockNumber: blockNumber.toString(),
    method,
    success: calls.every((c) => c.success),
    calls,
    revertName,
  };
}
