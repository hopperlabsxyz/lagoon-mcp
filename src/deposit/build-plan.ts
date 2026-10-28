/**
 * Builds a deposit plan from the request and the chain state already read.
 * Pure: no network calls, so every rule can be tested with plain objects.
 */

import { encodeFunctionData, getAddress, keccak256, toHex, zeroAddress, type Address } from 'viem';
import { erc20Abi, SYNC_MODE, vaultAbi } from './abi.js';
import { toAmount, type ResolvedAmounts } from './amounts.js';
import { PLAN_TTL_MS, SUPPORTED_VAULT_VERSION, type DepositChainConfig } from './config.js';
import type { Check, Issue, Plan, PlanExports, ResolvedAllocation, Step } from './types.js';
import type { PrepareDepositInput } from '../utils/validators.js';

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
  /** previewSyncDeposit(amount), when the deposit is sync */
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

const SYMBOL = 'USDC';

/** Whether a vault takes a deposit synchronously (spec §3, v0.6.0) */
export function depositModeOf(
  vault: Pick<VaultReading, 'syncMode' | 'navValid'>,
  requested: 'auto' | 'async' = 'auto'
): 'sync' | 'async' {
  const syncAllowed = vault.syncMode === SYNC_MODE.Both || vault.syncMode === SYNC_MODE.SyncDeposit;
  return requested === 'auto' && syncAllowed && vault.navValid === true ? 'sync' : 'async';
}

/** keccak256 of canonical JSON (sorted keys; values are strings and integers only) */
export function contentHashOf(value: unknown): `0x${string}` {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`;
    }
    return JSON.stringify(v);
  };
  return keccak256(toHex(canonical(value)));
}

export function buildPlan(
  input: PrepareDepositInput,
  chain: DepositChainConfig,
  reading: ChainReading,
  resolved: ResolvedAmounts,
  context: { now: Date; planId: string; minAllocation: bigint; gasReserve: bigint }
): BuildResult {
  const decimals = chain.usdcDecimals;
  const amount = (raw: bigint) => toAmount(raw, decimals, SYMBOL);
  const account = getAddress(input.account.address);
  const issues: Issue[] = [...resolved.issues];
  const warnings: Issue[] = [];
  const checks: Check[] = [];

  // ── Per-vault checks ────────────────────────────────────────────────────
  input.allocations.forEach((allocation, i) => {
    const vault = reading.vaults[i];
    const target = { chainId: chain.chainId, address: getAddress(allocation.vault.address) };
    const label = vault.name ?? target.address;
    const fail = (code: Issue['code'], message: string, details?: Record<string, string>) =>
      issues.push({ code, severity: 'error', message, allocationIndex: i, details });

    checks.push({
      code: 'VAULT_FROM_LAGOON_FACTORY',
      target,
      passed: vault.isLagoon,
      observed: { factories: chain.factories.join(','), isInstance: String(vault.isLagoon) },
      source: 'onchain',
    });
    if (!vault.isLagoon) {
      fail(
        'NOT_A_LAGOON_VAULT',
        `${target.address} was not created by a Lagoon factory on ${chain.name}`
      );
      return;
    }

    const versionOk = vault.version === SUPPORTED_VAULT_VERSION;
    checks.push({
      code: 'VAULT_VERSION_SUPPORTED',
      target,
      passed: versionOk,
      observed: { version: vault.version ?? 'unknown' },
      source: 'onchain',
    });
    if (!versionOk) {
      fail(
        'UNSUPPORTED_VAULT_VERSION',
        `${label} runs ${vault.version ?? 'an unknown version'}; only ${SUPPORTED_VAULT_VERSION} is supported`
      );
    }

    const assetOk = vault.asset?.toLowerCase() === chain.usdc.toLowerCase();
    checks.push({
      code: 'VAULT_ASSET_IS_USDC',
      target,
      passed: assetOk,
      observed: { asset: vault.asset ?? 'unknown', usdc: chain.usdc },
      source: 'onchain',
    });
    if (!assetOk) fail('ASSET_MISMATCH', `${label} does not take USDC`);

    checks.push({
      code: 'VAULT_NOT_PAUSED',
      target,
      passed: vault.paused === false,
      observed: { paused: String(vault.paused) },
      source: 'onchain',
    });
    if (vault.paused !== false) fail('VAULT_PAUSED', `${label} is paused`);

    checks.push({
      code: 'ACCOUNT_ALLOWED',
      target,
      passed: vault.isAllowed === true,
      observed: { isAllowed: String(vault.isAllowed) },
      source: 'onchain',
    });
    if (vault.isAllowed !== true) {
      fail(
        'ACCESS_DENIED',
        `${account} is not allowed to deposit into ${label} (whitelist, blacklist or sanctions list)`
      );
    }

    // Upper bound: pending deposits held in the silo are not readable here;
    // the simulation is the final word on MaxCapReached.
    const deposit = resolved.amounts[i] ?? 0n;
    const room =
      vault.maxCap !== undefined && vault.totalAssets !== undefined
        ? vault.maxCap > vault.totalAssets
          ? vault.maxCap - vault.totalAssets
          : 0n
        : undefined;
    const underCap = room === undefined || deposit <= room;
    checks.push({
      code: 'UNDER_MAX_CAP',
      target,
      passed: underCap,
      observed: {
        maxCap: vault.maxCap?.toString() ?? 'unknown',
        totalAssets: vault.totalAssets?.toString() ?? 'unknown',
        note: 'excludes deposits still pending; the simulation checks the exact cap',
      },
      source: 'onchain',
    });
    if (!underCap && room !== undefined) {
      fail('MAX_CAP_REACHED', `${label} has room for ${amount(room).formatted} USDC only`, {
        remainingCapacity: amount(room).formatted,
      });
    }

    if (deposit < context.minAllocation && resolved.issues.length === 0) {
      fail(
        'AMOUNT_TOO_SMALL',
        `The deposit into ${label} is below ${amount(context.minAllocation).formatted} USDC`
      );
    }

    if ((vault.pendingDeposit ?? 0n) > 0n) {
      warnings.push({
        code: 'PENDING_DEPOSIT_EXISTS',
        severity: 'warning',
        message: `You already have ${amount(vault.pendingDeposit ?? 0n).formatted} USDC waiting for settlement in ${label}. The vault refuses a new request while an older one is unsettled; the simulation tells which case applies.`,
        allocationIndex: i,
      });
    }
  });

  // ── Balance ─────────────────────────────────────────────────────────────
  const needed = resolved.amounts.reduce((sum, a) => sum + a, 0n);
  const enough = reading.balance >= needed;
  checks.push({
    code: 'BALANCE_SUFFICIENT',
    passed: enough,
    observed: { balance: amount(reading.balance).formatted, needed: amount(needed).formatted },
    source: 'onchain',
  });
  if (!enough) {
    issues.push({
      code: 'INSUFFICIENT_BALANCE',
      severity: 'error',
      message: `You have ${amount(reading.balance).formatted} USDC on ${chain.name}, the plan needs ${amount(needed).formatted} USDC`,
      details: {
        chainId: String(chain.chainId),
        balance: amount(reading.balance).formatted,
        missing: amount(needed - reading.balance).formatted,
      },
    });
  }
  // Only where USDC also pays the fees (Arc)
  if (chain.usdcIsGas) {
    const left = reading.balance - needed;
    const gasOk = left >= context.gasReserve;
    checks.push({
      code: 'GAS_RESERVE',
      passed: gasOk,
      observed: {
        leftAfterPlan: amount(left > 0n ? left : 0n).formatted,
        recommended: amount(context.gasReserve).formatted,
      },
      source: 'onchain',
    });
    if (enough && !gasOk) {
      warnings.push({
        code: 'LOW_GAS_RESERVE',
        severity: 'warning',
        message: `Only ${amount(left).formatted} USDC would be left to pay transaction fees on ${chain.name}`,
        details: { chainId: String(chain.chainId) },
      });
    }
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, issues, checks };
  }

  // ── Steps, vault by vault ───────────────────────────────────────────────
  const steps: Step[] = [];
  const allocations: ResolvedAllocation[] = [];
  const nextId = () => `s${steps.length + 1}`;

  input.allocations.forEach((allocation, i) => {
    const vault = reading.vaults[i];
    const vaultRef = { chainId: chain.chainId, address: getAddress(allocation.vault.address) };
    const name = vault.name ?? vaultRef.address;
    const assets = resolved.amounts[i];
    const mode = depositModeOf(vault, input.options?.depositMode);
    const previous = steps.at(-1)?.id;

    checks.push({
      code: 'SYNC_ALLOWED',
      target: vaultRef,
      passed: mode === 'sync',
      observed: { syncMode: String(vault.syncMode), navValid: String(vault.navValid), mode },
      source: 'onchain',
    });

    if (vault.allowance >= assets) {
      warnings.push({
        code: 'EXISTING_ALLOWANCE_USED',
        severity: 'info',
        message: `${name} is already allowed to take ${amount(vault.allowance).formatted} USDC; no approval needed`,
        allocationIndex: i,
      });
    } else {
      const id = nextId();
      steps.push({
        id,
        kind: 'erc20.approve',
        chainId: chain.chainId,
        dependsOn: previous ? [previous] : [],
        description: `Approve ${name} to spend ${amount(assets).formatted} USDC`,
        decoded: {
          contract: 'USDC',
          function: 'approve',
          args: { spender: vaultRef.address, amount: assets.toString() },
        },
        execution: {
          type: 'evmCall',
          to: chain.usdc,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [vaultRef.address, assets],
          }),
          value: '0',
        },
        preconditions: [
          {
            kind: 'minBalance',
            token: { chainId: chain.chainId, address: chain.usdc },
            holder: account,
            amount: amount(assets),
          },
        ],
        expectedEffects: [
          {
            kind: 'allowance',
            token: { chainId: chain.chainId, address: chain.usdc },
            owner: account,
            spender: vaultRef.address,
            amount: amount(assets),
          },
        ],
        token: { chainId: chain.chainId, address: chain.usdc },
        spender: vaultRef.address,
        amount: amount(assets),
      });
    }

    const dependsOn = steps.at(-1)?.id;
    if (mode === 'sync') {
      steps.push({
        id: nextId(),
        kind: 'lagoon.syncDeposit',
        chainId: chain.chainId,
        dependsOn: dependsOn ? [dependsOn] : [],
        description: `Deposit ${amount(assets).formatted} USDC into ${name}`,
        decoded: {
          contract: name,
          function: 'syncDeposit',
          args: { assets: assets.toString(), receiver: account, referral: zeroAddress },
        },
        execution: {
          type: 'evmCall',
          to: vaultRef.address,
          data: encodeFunctionData({
            abi: vaultAbi,
            functionName: 'syncDeposit',
            args: [assets, account, zeroAddress],
          }),
          value: '0',
        },
        preconditions: [
          {
            kind: 'minAllowance',
            token: { chainId: chain.chainId, address: chain.usdc },
            owner: account,
            spender: vaultRef.address,
            amount: amount(assets),
          },
        ],
        expectedEffects: [
          {
            kind: 'balanceDelta',
            token: { chainId: chain.chainId, address: chain.usdc },
            holder: account,
            delta: amount(assets),
            sign: '-',
          },
        ],
        vault: vaultRef,
        assets: amount(assets),
      });
    } else {
      steps.push({
        id: nextId(),
        kind: 'lagoon.requestDeposit',
        chainId: chain.chainId,
        dependsOn: dependsOn ? [dependsOn] : [],
        description: `Request a deposit of ${amount(assets).formatted} USDC into ${name}`,
        decoded: {
          contract: name,
          function: 'requestDeposit',
          args: { assets: assets.toString(), controller: account, owner: account },
        },
        execution: {
          type: 'evmCall',
          to: vaultRef.address,
          data: encodeFunctionData({
            abi: vaultAbi,
            functionName: 'requestDeposit',
            args: [assets, account, account],
          }),
          value: '0',
        },
        preconditions: [
          {
            kind: 'minAllowance',
            token: { chainId: chain.chainId, address: chain.usdc },
            owner: account,
            spender: vaultRef.address,
            amount: amount(assets),
          },
        ],
        expectedEffects: [
          {
            kind: 'balanceDelta',
            token: { chainId: chain.chainId, address: chain.usdc },
            holder: account,
            delta: amount(assets),
            sign: '-',
          },
          { kind: 'pendingDeposit', vault: vaultRef, controller: account, assets: amount(assets) },
        ],
        vault: vaultRef,
        assets: amount(assets),
      });
      warnings.push({
        code: 'ASYNC_DEPOSIT',
        severity: 'info',
        message: `${name}: your shares arrive after the curator's next settlement`,
        allocationIndex: i,
      });
    }

    allocations.push({
      vault: { ...vaultRef, name, version: vault.version ?? 'unknown' },
      assets: amount(assets),
      mode,
      entryRateBps: vault.entryRateBps ?? 0,
      estimatedShares:
        mode === 'sync' && vault.previewShares !== undefined
          ? toAmount(vault.previewShares, vault.decimals ?? 18, 'shares')
          : null,
      sharesAvailability: mode === 'sync' ? 'immediate' : 'afterSettlement',
    });
  });

  const accountRef = {
    address: account,
    type: input.account.type === 'safe' ? 'safe' : 'eoa',
  } as const;
  const parts = allocations.map(
    (a) =>
      `${a.vault.name} ${a.assets.formatted} USDC (${a.mode === 'sync' ? 'immediate' : 'after settlement'})`
  );
  const summary =
    `Deposit ${amount(needed).formatted} USDC into ${allocations.length} vault${allocations.length > 1 ? 's' : ''} on ${chain.name}: ` +
    `${parts.join(', ')}. ${steps.length} transaction${steps.length > 1 ? 's' : ''} to sign.`;

  const plan: DraftPlan = {
    specVersion: '1',
    planId: context.planId,
    contentHash: contentHashOf({ account: accountRef, steps }),
    createdAt: context.now.toISOString(),
    validUntil: new Date(context.now.getTime() + PLAN_TTL_MS).toISOString(),
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
    checks,
    warnings,
    summary,
  };

  return { ok: true, plan };
}

/** Wallet payloads for a (possibly multi-chain) plan: one batch per chain */
export function buildExports(
  input: PrepareDepositInput,
  plan: Pick<Plan, 'planId' | 'createdAt' | 'summary' | 'steps'>
): PlanExports | undefined {
  const wanted = new Set(input.options?.exports ?? []);
  if (input.account.type === 'safe') wanted.add('safeTxBuilder');
  if (wanted.size === 0) return undefined;

  const chainIds = [...new Set(plan.steps.map((s) => s.chainId))];
  const stepsOn = (chainId: number) => plan.steps.filter((s) => s.chainId === chainId);
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
