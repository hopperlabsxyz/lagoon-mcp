/**
 * Builds a deposit plan from the request and the chain state already read.
 * Pure: no network calls, so every rule can be tested with plain objects.
 */

import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  keccak256,
  toHex,
  zeroAddress,
  type Address,
} from 'viem';
import { erc20Abi, SYNC_MODE, vaultAbi } from './abi.js';
import { toAmount, type ResolvedAmounts } from './amounts.js';
import { PLAN_TTL_MS, SUPPORTED_VERSIONS, vaultFamily, type DepositChainConfig } from './config.js';
import type {
  Amount,
  ChainRef,
  Check,
  Issue,
  Plan,
  PlanExports,
  ResolvedAllocation,
  Step,
} from './types.js';
import type { PlannedDepositInput } from '../utils/validators.js';

/** What was read on chain for one target vault, at the plan's block */
export interface VaultReading {
  address: Address;
  isLagoon: boolean;
  name?: string;
  /** Share token decimals */
  decimals?: number;
  version?: string;
  asset?: Address;
  paused?: boolean;
  isAllowed?: boolean;
  maxCap?: bigint;
  totalAssets?: bigint;
  syncMode?: number;
  navValid?: boolean;
  entryRateBps?: number;
  allowance: bigint;
  pendingDeposit?: bigint;
  /** Stored state, an index into VAULT_STATE_NAMES */
  state?: number;
  /** When the NAV expires (unix seconds), on v0.5 and v0.6 */
  navExpiration?: bigint;
  /** Shares a sync deposit of the planned amount mints */
  previewShares?: bigint;
}

export interface ChainReading {
  chainId: number;
  blockNumber: bigint;
  timestamp: bigint;
  balance: bigint;
  /** Same order as the input allocations */
  vaults: VaultReading[];
}

export type DraftPlan = Omit<Plan, 'simulations'>;

export type BuildResult =
  | { ok: true; plan: DraftPlan }
  | { ok: false; issues: Issue[]; checks: Check[] };

type DepositMode = ResolvedAllocation['mode'];

/** Vault states as stored on chain (0, 1, 2); only an Open vault settles deposits */
const VAULT_STATE_NAMES = ['Open', 'Closing', 'Closed'];
const OPEN = 0;

/**
 * Above this, an allowance means "unlimited": max uint256, or close to it
 * since some tokens decrement even a max allowance as it is spent.
 */
const UNLIMITED_ALLOWANCE = 2n ** 128n;

const isUnlimited = (allowance: bigint): boolean => allowance >= UNLIMITED_ALLOWANCE;

/**
 * Whether a vault takes a deposit synchronously (spec §3):
 * - v0.6: when its syncMode allows it and the NAV is valid, unless the
 *   request asks for async;
 * - v0.5: exactly while the NAV is valid. The contract decides, not the
 *   request: a valid NAV refuses requests (OnlySyncDepositAllowed), an
 *   invalid one refuses sync deposits;
 * - older versions only take requests.
 */
export function depositModeOf(
  vault: Pick<VaultReading, 'syncMode' | 'navValid' | 'version'>,
  requested: 'auto' | 'async' = 'auto'
): DepositMode {
  const family = vaultFamily(vault.version);
  if (family === 'v0.5') return vault.navValid === true ? 'sync' : 'async';
  const syncAllowed =
    family === 'v0.6' &&
    (vault.syncMode === SYNC_MODE.Both || vault.syncMode === SYNC_MODE.SyncDeposit);
  return requested === 'auto' && syncAllowed && vault.navValid === true ? 'sync' : 'async';
}

/** JSON with sorted keys and no undefined values (values are strings and integers only) */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentHashOf(value: unknown): `0x${string}` {
  return keccak256(toHex(canonicalJson(value)));
}

export const plural = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? 's' : ''}`;

/** "Vault A 10.00 USDC (immediate)", as the plan summary lists each allocation */
export const describeAllocation = (a: ResolvedAllocation): string =>
  `${a.vault.name} ${a.assets.formatted} USDC (${a.mode === 'sync' ? 'immediate' : 'after settlement'})`;

const usdcAmount = (chain: DepositChainConfig, raw: bigint): Amount =>
  toAmount(raw, chain.usdcDecimals, 'USDC');

/** What the checks found, in the order they ran */
interface Findings {
  issues: Issue[];
  warnings: Issue[];
  checks: Check[];
}

const stateName = (state: number | undefined): string =>
  state === undefined ? 'unknown' : (VAULT_STATE_NAMES[state] ?? `${state}`);

/** Room left under the vault's cap (v0.6 only); undefined when the vault has no cap */
function remainingCapacity(vault: VaultReading): bigint | undefined {
  if (vault.maxCap === undefined || vault.totalAssets === undefined) return undefined;
  return vault.maxCap > vault.totalAssets ? vault.maxCap - vault.totalAssets : 0n;
}

/** Every rule a vault must pass before anything is built for it */
function checkVault(
  found: Findings,
  chain: DepositChainConfig,
  account: Address,
  vault: VaultReading,
  target: ChainRef,
  index: number,
  deposit: bigint,
  minAllocation: bigint | undefined
): void {
  const label = vault.name ?? target.address;
  const amount = (raw: bigint): Amount => usdcAmount(chain, raw);
  const check = (code: Check['code'], passed: boolean, observed: Check['observed']): void => {
    found.checks.push({ code, target, passed, observed, source: 'onchain' });
  };
  const fail = (code: Issue['code'], message: string, details?: Record<string, string>): void => {
    found.issues.push({ code, severity: 'error', message, allocationIndex: index, details });
  };

  check('VAULT_FROM_LAGOON_FACTORY', vault.isLagoon, {
    factories: chain.factories.join(','),
    knownToLagoon: String(vault.isLagoon),
    note: 'created by a Lagoon factory, or a listed legacy Lagoon vault',
  });
  if (!vault.isLagoon) {
    fail(
      'NOT_A_LAGOON_VAULT',
      `${target.address} is not a Lagoon vault (no Lagoon factory created it and it is not a known legacy vault) on ${chain.name}`
    );
    return;
  }

  const versionOk = vaultFamily(vault.version) !== undefined;
  check('VAULT_VERSION_SUPPORTED', versionOk, {
    version: vault.version ?? 'none (v0.1 or v0.2)',
    supported: SUPPORTED_VERSIONS,
  });
  if (!versionOk) {
    fail(
      'UNSUPPORTED_VAULT_VERSION',
      `${label} runs ${vault.version}; deposits support Lagoon vaults ${SUPPORTED_VERSIONS}`
    );
  }

  const assetOk = vault.asset?.toLowerCase() === chain.usdc.toLowerCase();
  check('VAULT_ASSET_IS_USDC', assetOk, { asset: vault.asset ?? 'unknown', usdc: chain.usdc });
  if (!assetOk) fail('ASSET_MISMATCH', `${label} does not take USDC`);

  // v0.6 still takes requests while closing, but they would never be settled
  const state = stateName(vault.state);
  check('VAULT_OPEN', vault.state === OPEN, { state });
  if (vault.state !== OPEN) {
    fail(
      'VAULT_NOT_OPEN',
      vault.state === undefined
        ? `Could not read whether ${label} is open`
        : `${label} is ${state.toLowerCase()}: it no longer takes deposits`,
      { state }
    );
  }

  check('VAULT_NOT_PAUSED', vault.paused === false, { paused: String(vault.paused) });
  if (vault.paused !== false) fail('VAULT_PAUSED', `${label} is paused`);

  check('ACCOUNT_ALLOWED', vault.isAllowed === true, { isAllowed: String(vault.isAllowed) });
  if (vault.isAllowed !== true) {
    fail(
      'ACCESS_DENIED',
      `${account} is not allowed to deposit into ${label} (whitelist, blacklist or sanctions list)`
    );
  }

  // Deposits still pending in the silo are not readable here: the
  // simulation has the final word on MaxCapReached
  const room = remainingCapacity(vault);
  const underCap = room === undefined || deposit <= room;
  check('UNDER_MAX_CAP', underCap, {
    maxCap: vault.maxCap?.toString() ?? 'unknown',
    totalAssets: vault.totalAssets?.toString() ?? 'unknown',
    note: 'excludes deposits still pending; the simulation checks the exact cap',
  });
  if (room !== undefined && !underCap) {
    fail('MAX_CAP_REACHED', `${label} has room for ${amount(room).formatted} USDC only`, {
      // A plain decimal, usable as the amount of a new request
      remainingCapacity: formatUnits(room, chain.usdcDecimals),
    });
  }

  if (minAllocation !== undefined && deposit < minAllocation) {
    fail(
      'AMOUNT_TOO_SMALL',
      `The deposit into ${label} would be ${amount(deposit).formatted} USDC, below the minimum of ${amount(minAllocation).formatted} USDC`
    );
  }

  const pending = vault.pendingDeposit ?? 0n;
  if (pending > 0n) {
    found.warnings.push({
      code: 'PENDING_DEPOSIT_EXISTS',
      severity: 'warning',
      message: `You already have ${amount(pending).formatted} USDC waiting for settlement in ${label}. The vault refuses a new request while an older one is unsettled; the simulation tells which case applies.`,
      allocationIndex: index,
    });
  }
}

/** The wallet holds what the plan spends, and on Arc what pays the fees after it */
function checkBalance(
  found: Findings,
  chain: DepositChainConfig,
  balance: bigint,
  needed: bigint,
  gasReserve: bigint
): void {
  const amount = (raw: bigint): Amount => usdcAmount(chain, raw);
  const enough = balance >= needed;
  found.checks.push({
    code: 'BALANCE_SUFFICIENT',
    passed: enough,
    observed: { balance: amount(balance).formatted, needed: amount(needed).formatted },
    source: 'onchain',
  });
  if (!enough) {
    found.issues.push({
      code: 'INSUFFICIENT_BALANCE',
      severity: 'error',
      message: `You have ${amount(balance).formatted} USDC on ${chain.name}, the plan needs ${amount(needed).formatted} USDC`,
      details: {
        chainId: String(chain.chainId),
        balance: amount(balance).formatted,
        missing: amount(needed - balance).formatted,
      },
    });
  }

  if (!chain.usdcIsGas) return;
  const left = balance - needed;
  const gasOk = left >= gasReserve;
  found.checks.push({
    code: 'GAS_RESERVE',
    passed: gasOk,
    observed: {
      leftAfterPlan: amount(left > 0n ? left : 0n).formatted,
      recommended: amount(gasReserve).formatted,
    },
    source: 'onchain',
  });
  if (enough && !gasOk) {
    found.warnings.push({
      code: 'LOW_GAS_RESERVE',
      severity: 'warning',
      message: `Only ${amount(left).formatted} USDC would be left to pay transaction fees on ${chain.name}`,
      details: { chainId: String(chain.chainId) },
    });
  }
}

/** Each step waits for the one before it, in plan order */
const afterLastStep = (steps: Step[]): string[] => {
  const last = steps.at(-1)?.id;
  return last ? [last] : [];
};

function approveStep(
  id: string,
  dependsOn: string[],
  chain: DepositChainConfig,
  account: Address,
  vault: ChainRef,
  name: string,
  assets: bigint
): Step {
  const usdc = { chainId: chain.chainId, address: chain.usdc };
  const amount = usdcAmount(chain, assets);
  return {
    id,
    kind: 'erc20.approve',
    chainId: chain.chainId,
    dependsOn,
    description: `Approve ${name} to spend ${amount.formatted} USDC`,
    decoded: {
      contract: 'USDC',
      function: 'approve',
      args: { spender: vault.address, amount: assets.toString() },
    },
    execution: {
      type: 'evmCall',
      to: chain.usdc,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [vault.address, assets],
      }),
      value: '0',
    },
    preconditions: [{ kind: 'minBalance', token: usdc, holder: account, amount }],
    expectedEffects: [
      { kind: 'allowance', token: usdc, owner: account, spender: vault.address, amount },
    ],
    token: usdc,
    spender: vault.address,
    amount,
  };
}

/** What must still hold when the deposit is sent (spec §5) */
function depositPreconditions(
  chain: DepositChainConfig,
  account: Address,
  vault: ChainRef,
  reading: VaultReading,
  mode: DepositMode,
  amount: Amount
): Step['preconditions'] {
  const preconditions: Step['preconditions'] = [
    {
      kind: 'minAllowance',
      token: { chainId: chain.chainId, address: chain.usdc },
      owner: account,
      spender: vault.address,
      amount,
    },
    { kind: 'vaultState', vault, state: 'Open', paused: false },
  ];
  if (mode === 'sync' && reading.navExpiration !== undefined && reading.navExpiration > 0n) {
    preconditions.push({
      kind: 'navValid',
      vault,
      until: new Date(Number(reading.navExpiration) * 1000).toISOString(),
    });
  }
  if (reading.maxCap !== undefined) {
    preconditions.push({ kind: 'capacity', vault, atLeast: amount });
  }
  return preconditions;
}

/** A syncDeposit (shares now) or a requestDeposit (shares after the next settlement) */
function depositStep(
  id: string,
  dependsOn: string[],
  chain: DepositChainConfig,
  account: Address,
  vault: ChainRef,
  reading: VaultReading,
  name: string,
  assets: bigint,
  mode: DepositMode
): Step {
  const sync = mode === 'sync';
  const amount = usdcAmount(chain, assets);
  const spent = {
    kind: 'balanceDelta',
    token: { chainId: chain.chainId, address: chain.usdc },
    holder: account,
    delta: amount,
    sign: '-',
  };
  return {
    id,
    kind: sync ? 'lagoon.syncDeposit' : 'lagoon.requestDeposit',
    chainId: chain.chainId,
    dependsOn,
    description: sync
      ? `Deposit ${amount.formatted} USDC into ${name}`
      : `Request a deposit of ${amount.formatted} USDC into ${name}`,
    decoded: {
      contract: name,
      function: sync ? 'syncDeposit' : 'requestDeposit',
      args: sync
        ? { assets: assets.toString(), receiver: account, referral: zeroAddress }
        : { assets: assets.toString(), controller: account, owner: account },
    },
    execution: {
      type: 'evmCall',
      to: vault.address,
      data: sync
        ? encodeFunctionData({
            abi: vaultAbi,
            functionName: 'syncDeposit',
            args: [assets, account, zeroAddress],
          })
        : encodeFunctionData({
            abi: vaultAbi,
            functionName: 'requestDeposit',
            args: [assets, account, account],
          }),
      value: '0',
    },
    preconditions: depositPreconditions(chain, account, vault, reading, mode, amount),
    expectedEffects: sync
      ? [spent]
      : [spent, { kind: 'pendingDeposit', vault, controller: account, assets: amount }],
    vault,
    assets: amount,
  };
}

/** The approval (unless an existing one covers it) and the deposit, for each vault */
function buildSteps(
  found: Findings,
  input: PlannedDepositInput,
  chain: DepositChainConfig,
  account: Address,
  reading: ChainReading,
  amounts: bigint[]
): { steps: Step[]; allocations: ResolvedAllocation[] } {
  const steps: Step[] = [];
  const allocations: ResolvedAllocation[] = [];
  const nextId = (): string => `s${steps.length + 1}`;
  const requestedMode = input.options?.depositMode;

  input.allocations.forEach((allocation, i) => {
    const vault = reading.vaults[i];
    const vaultRef = { chainId: chain.chainId, address: getAddress(allocation.vault.address) };
    const name = vault.name ?? vaultRef.address;
    const assets = amounts[i];
    const mode = depositModeOf(vault, requestedMode);

    found.checks.push({
      code: 'SYNC_ALLOWED',
      target: vaultRef,
      // Informational: async is a vault mode, not a failure (the observed mode says which)
      passed: true,
      observed: { syncMode: String(vault.syncMode), navValid: String(vault.navValid), mode },
      source: 'onchain',
    });
    if (requestedMode === 'async' && mode === 'sync') {
      found.warnings.push({
        code: 'SYNC_ONLY_VAULT',
        severity: 'warning',
        message: `${name} only takes instant deposits while its NAV is valid, so this deposit is instant, not a request`,
        allocationIndex: i,
      });
    }

    if (vault.allowance >= assets) {
      const unlimited = isUnlimited(vault.allowance);
      const allowance = usdcAmount(chain, vault.allowance).formatted;
      found.warnings.push({
        code: 'EXISTING_ALLOWANCE_USED',
        severity: 'info',
        message: unlimited
          ? `${name} already has an unlimited approval on your USDC; no approval needed`
          : `${name} is already allowed to take ${allowance} USDC; no approval needed`,
        allocationIndex: i,
        details: { allowance: unlimited ? 'unlimited' : allowance },
      });
    } else {
      steps.push(
        approveStep(nextId(), afterLastStep(steps), chain, account, vaultRef, name, assets)
      );
    }

    steps.push(
      depositStep(
        nextId(),
        afterLastStep(steps),
        chain,
        account,
        vaultRef,
        vault,
        name,
        assets,
        mode
      )
    );
    if (mode === 'async') {
      found.warnings.push({
        code: 'ASYNC_DEPOSIT',
        severity: 'info',
        message: `${name}: your shares arrive after the curator's next settlement`,
        allocationIndex: i,
      });
    }

    allocations.push({
      vault: { ...vaultRef, name, version: vault.version ?? 'unknown' },
      assets: usdcAmount(chain, assets),
      mode,
      entryRateBps: vault.entryRateBps ?? 0,
      estimatedShares:
        mode === 'sync' && vault.previewShares !== undefined
          ? toAmount(vault.previewShares, vault.decimals ?? 18, 'shares')
          : null,
      sharesAvailability: mode === 'sync' ? 'immediate' : 'afterSettlement',
    });
  });

  return { steps, allocations };
}

/** When the plan expires: after PLAN_TTL_MS, or earlier when a sync deposit's NAV expires */
function planExpiry(now: Date, allocations: ResolvedAllocation[], vaults: VaultReading[]): string {
  const navExpiries = allocations.flatMap((a, i) => {
    const expiration = vaults[i]?.navExpiration;
    return a.mode === 'sync' && expiration !== undefined && expiration > 0n
      ? [Number(expiration) * 1000]
      : [];
  });
  return new Date(Math.min(now.getTime() + PLAN_TTL_MS, ...navExpiries)).toISOString();
}

export function buildPlan(
  input: PlannedDepositInput,
  chain: DepositChainConfig,
  reading: ChainReading,
  resolved: ResolvedAmounts,
  context: { now: Date; planId: string; minAllocation: bigint; gasReserve: bigint }
): BuildResult {
  const account = getAddress(input.account.address);
  const found: Findings = { issues: [...resolved.issues], warnings: [], checks: [] };

  input.allocations.forEach((allocation, i) => {
    checkVault(
      found,
      chain,
      account,
      reading.vaults[i],
      { chainId: chain.chainId, address: getAddress(allocation.vault.address) },
      i,
      resolved.amounts[i] ?? 0n,
      // Too small only means something once the amounts themselves are valid
      resolved.issues.length === 0 ? context.minAllocation : undefined
    );
  });
  const needed = resolved.amounts.reduce((sum, a) => sum + a, 0n);
  checkBalance(found, chain, reading.balance, needed, context.gasReserve);

  if (found.issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, issues: found.issues, checks: found.checks };
  }

  const { steps, allocations } = buildSteps(
    found,
    input,
    chain,
    account,
    reading,
    resolved.amounts
  );
  const accountRef = {
    address: account,
    type: input.account.type === 'safe' ? 'safe' : 'eoa',
  } as const;
  const summary =
    `Deposit ${usdcAmount(chain, needed).formatted} USDC into ${plural(allocations.length, 'vault')} on ${chain.name}: ` +
    `${allocations.map(describeAllocation).join(', ')}. ${plural(steps.length, 'transaction')} to sign.`;

  return {
    ok: true,
    plan: {
      specVersion: '1',
      planId: context.planId,
      contentHash: contentHashOf({ account: accountRef, steps }),
      createdAt: context.now.toISOString(),
      validUntil: planExpiry(context.now, allocations, reading.vaults),
      account: accountRef,
      stateAt: [
        {
          chainId: chain.chainId,
          blockNumber: reading.blockNumber.toString(),
          timestamp: new Date(Number(reading.timestamp) * 1000).toISOString(),
        },
      ],
      allocations,
      steps,
      batches: [{ chainId: chain.chainId, stepIds: steps.map((s) => s.id) }],
      checks: found.checks,
      warnings: found.warnings,
      summary,
    },
  };
}

/** Wallet payloads for a (possibly multi-chain) plan: one batch per chain */
export function buildExports(
  input: PlannedDepositInput,
  plan: Pick<Plan, 'planId' | 'createdAt' | 'summary' | 'steps'>
): PlanExports | undefined {
  const wanted = new Set(input.options?.exports ?? []);
  if (input.account.type === 'safe') wanted.add('safeTxBuilder');
  if (wanted.size === 0) return undefined;

  const chainIds = [...new Set(plan.steps.map((s) => s.chainId))];
  const stepsOn = (chainId: number): Step[] => plan.steps.filter((s) => s.chainId === chainId);
  const exports: PlanExports = {};
  if (wanted.has('eip5792')) {
    exports.eip5792 = chainIds.map((chainId) => ({
      chainId: toHex(chainId),
      calls: stepsOn(chainId).map((s) => ({
        to: s.execution.to,
        data: s.execution.data,
        value: '0x0' as const,
      })),
    }));
  }
  if (wanted.has('safeTxBuilder')) {
    // The Safe Transaction Builder imports one file per chain
    exports.safeTxBuilder = chainIds.map((chainId) => ({
      version: '1.0',
      chainId: String(chainId),
      createdAt: new Date(plan.createdAt).getTime(),
      meta: { name: `Lagoon deposit plan ${plan.planId}`, description: plan.summary },
      transactions: stepsOn(chainId).map((s) => ({
        to: s.execution.to,
        value: s.execution.value,
        data: s.execution.data,
        contractMethod: null,
        contractInputsValues: null,
      })),
    }));
  }
  return exports;
}
