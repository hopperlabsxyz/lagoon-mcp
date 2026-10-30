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
  defineChain,
  getAddress,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { erc20Abi, factoryAbi, vaultAbi } from './abi.js';
import { rpcUrlFor, type DepositChainConfig, type VaultFamily } from './config.js';
import type { ChainReading, VaultReading } from './build-plan.js';
import type { IssueCode, PlanSimulation } from './types.js';

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

export async function readChainState(
  client: PublicClient,
  chain: DepositChainConfig,
  account: Address,
  vaultAddresses: Address[]
): Promise<ChainReading> {
  const block = await client.getBlock({ blockTag: 'latest' });
  const blockNumber = block.number;

  const perVault = (vault: Address) =>
    [
      { address: vault, abi: vaultAbi, functionName: 'name' },
      { address: vault, abi: vaultAbi, functionName: 'version' },
      { address: vault, abi: vaultAbi, functionName: 'asset' },
      { address: vault, abi: vaultAbi, functionName: 'decimals' },
      { address: vault, abi: vaultAbi, functionName: 'paused' },
      { address: vault, abi: vaultAbi, functionName: 'isAllowed', args: [account] },
      { address: vault, abi: vaultAbi, functionName: 'maxCap' },
      { address: vault, abi: vaultAbi, functionName: 'totalAssets' },
      { address: vault, abi: vaultAbi, functionName: 'syncMode' },
      { address: vault, abi: vaultAbi, functionName: 'isTotalAssetsValid' },
      { address: vault, abi: vaultAbi, functionName: 'feeRates' },
      { address: vault, abi: vaultAbi, functionName: 'pendingDepositRequest', args: [0n, account] },
      { address: chain.usdc, abi: erc20Abi, functionName: 'allowance', args: [account, vault] },
      { address: vault, abi: vaultAbi, functionName: 'isWhitelisted', args: [account] },
    ] as const;
  const FIELDS = 14;

  const [balance, results, instances] = await Promise.all([
    client.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
      blockNumber,
    }),
    client.multicall({
      blockNumber,
      allowFailure: true,
      contracts: vaultAddresses.flatMap(perVault),
    }),
    // isInstance(vault) on every Lagoon factory of the chain
    client.multicall({
      blockNumber,
      allowFailure: true,
      contracts: vaultAddresses.flatMap((vault) =>
        chain.factories.map((factory) => ({
          address: factory,
          abi: factoryAbi,
          functionName: 'isInstance' as const,
          args: [vault] as const,
        }))
      ),
    }),
  ]);

  const value = <T>(index: number): T | undefined =>
    results[index]?.status === 'success' ? (results[index].result as T) : undefined;

  const vaults: VaultReading[] = vaultAddresses.map((address, v) => {
    const at = (field: number) => v * FIELDS + field;
    const isLagoon =
      chain.factories.some((_, f) => instances[v * chain.factories.length + f]?.result === true) ||
      chain.legacyVaults.some((a) => a.toLowerCase() === address.toLowerCase());
    const fees = value<{ entryRate: number }>(at(10));
    return {
      address: getAddress(address),
      isLagoon,
      name: value<string>(at(0)),
      decimals: value<number>(at(3)),
      version: value<string>(at(1)),
      asset: value<Address>(at(2)),
      paused: value<boolean>(at(4)),
      // isAllowed on v0.6, isWhitelisted before: the other one fails
      isAllowed: value<boolean>(at(5)) ?? value<boolean>(at(13)),
      maxCap: value<bigint>(at(6)),
      totalAssets: value<bigint>(at(7)),
      syncMode: value<number>(at(8)),
      navValid: value<boolean>(at(9)),
      entryRateBps: fees?.entryRate,
      pendingDeposit: value<bigint>(at(11)),
      allowance: value<bigint>(at(12)) ?? 0n,
    };
  });

  return {
    chainId: chain.chainId,
    blockNumber,
    timestamp: block.timestamp,
    balance,
    vaults,
  };
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

/** Decodes a revert into a Lagoon/ERC-20 error name, if known */
export function decodeRevert(data: Hex | undefined): string | undefined {
  if (!data || data === '0x') return undefined;
  try {
    return decodeErrorResult({ abi: [...vaultAbi, ...erc20Abi], data }).errorName;
  } catch {
    return undefined;
  }
}

export function issueCodeForRevert(errorName: string | undefined): IssueCode {
  return (errorName && REVERT_TO_ISSUE[errorName]) || 'SIMULATION_FAILED';
}

/** Replays the steps in order from the account, on the plan's block */
export async function simulatePlan(
  client: PublicClient,
  chainId: number,
  blockNumber: bigint,
  account: Address,
  steps: Array<{ id: string; execution: { to: Address; data: Hex } }>
): Promise<PlanSimulation & { revertName?: string }> {
  const { results } = await client.simulateCalls({
    account,
    blockNumber,
    calls: steps.map((s) => ({ to: s.execution.to, data: s.execution.data })),
  });

  let revertName: string | undefined;
  const calls = steps.map((step, i) => {
    const result = results[i];
    const success = result?.status === 'success';
    let error: string | undefined;
    if (!success) {
      const name = decodeRevert(result?.data);
      revertName ??= name;
      error = name ?? result?.error?.message?.split('\n')[0] ?? 'reverted';
    }
    return { stepId: step.id, success, gasUsed: (result?.gasUsed ?? 0n).toString(), error };
  });

  return {
    chainId,
    blockNumber: blockNumber.toString(),
    success: calls.every((c) => c.success),
    calls,
    revertName,
  };
}
