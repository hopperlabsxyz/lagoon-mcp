/**
 * prepare_deposit: request → chain state → plan → simulation.
 *
 * Each vault is funded from the wallet on its own chain ("silo" mode, no
 * bridging). A plan may span several chains: each chain is read, planned and
 * simulated on its own block, then the parts are merged into one plan.
 */

import { getAddress } from 'viem';
import { resolveAmounts, parseDecimal, toAmount } from './amounts.js';
import {
  buildExports,
  buildPlan,
  contentHashOf,
  depositModeOf,
  type DraftPlan,
} from './build-plan.js';
import {
  clientFor,
  issueCodeForRevert,
  readChainState,
  readPreviews,
  simulatePlan,
} from './chain.js';
import {
  DEFAULT_GAS_RESERVE,
  DEPOSIT_CHAINS,
  MIN_ALLOCATION,
  vaultFamily,
  type DepositChainConfig,
} from './config.js';
import type { Check, Issue, Plan, PlanSimulation, PrepareDepositOutput, Step } from './types.js';
import type { PlannedDepositInput, PrepareDepositInput } from '../utils/validators.js';

/** Time-ordered unique id (UUIDv7, RFC 9562) */
export function uuidv7(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = BigInt(now);
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Input rules that need no chain state (spec §4) */
export function validateRequest(input: PrepareDepositInput): Issue[] {
  const issues: Issue[] = [];
  if (input.account?.type === 'smartAccount') {
    issues.push({
      code: 'UNSUPPORTED_ACCOUNT_TYPE',
      severity: 'error',
      message: 'Smart accounts are not supported yet',
    });
  }
  const seen = new Set<string>();
  input.allocations.forEach((a, i) => {
    if (input.source.chainId !== undefined && a.vault.chainId !== input.source.chainId) {
      issues.push({
        code: 'CROSS_CHAIN_NOT_SUPPORTED',
        severity: 'error',
        message: `The vault is on chain ${a.vault.chainId} but the USDC is on chain ${input.source.chainId}`,
        allocationIndex: i,
      });
    }
    const key = `${a.vault.chainId}:${a.vault.address.toLowerCase()}`;
    if (seen.has(key)) {
      issues.push({
        code: 'DUPLICATE_VAULT',
        severity: 'error',
        message: 'The same vault appears twice',
        allocationIndex: i,
      });
    }
    seen.add(key);
  });
  return issues;
}

/** Allocation indexes grouped by vault chain, in input order */
export function groupByChain(input: PrepareDepositInput): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  input.allocations.forEach((a, i) => {
    groups.set(a.vault.chainId, [...(groups.get(a.vault.chainId) ?? []), i]);
  });
  return groups;
}

/** The part of the request that concerns one chain */
export function chainRequest(
  input: PlannedDepositInput,
  chainId: number,
  indexes: number[],
  singleChain: boolean
): PlannedDepositInput {
  const perChain = input.totals?.find((t) => t.chainId === chainId);
  const total = perChain
    ? perChain.kind === 'amount'
      ? { kind: 'amount' as const, value: perChain.value }
      : { kind: 'max' as const, keepForGas: perChain.keepForGas }
    : singleChain
      ? input.total
      : undefined;
  return {
    ...input,
    source: { ...input.source, chainId },
    allocations: indexes.map((i) => input.allocations[i]),
    total,
    totals: undefined,
  };
}

type ChainResult =
  | {
      ok: true;
      chain: DepositChainConfig;
      indexes: number[];
      plan: DraftPlan;
      simulation: PlanSimulation;
      revertName?: string;
    }
  | { ok: false; indexes: number[]; issues: Issue[]; checks: Check[] };

const remap = (issues: Issue[], indexes: number[]): Issue[] =>
  issues.map((issue) =>
    issue.allocationIndex === undefined
      ? issue
      : { ...issue, allocationIndex: indexes[issue.allocationIndex] }
  );

async function prepareChain(
  input: PlannedDepositInput,
  chainId: number,
  indexes: number[],
  singleChain: boolean,
  context: { now: Date; planId: string }
): Promise<ChainResult> {
  const unsupported = (message: string, reason: string): ChainResult => ({
    ok: false,
    indexes,
    checks: [],
    issues: indexes.map((i) => ({
      code: 'UNSUPPORTED_CHAIN' as const,
      severity: 'error' as const,
      message,
      allocationIndex: i,
      details: { reason },
    })),
  });

  const chain = DEPOSIT_CHAINS[chainId];
  if (!chain) return unsupported(`Chain ${chainId} is not supported for deposits`, 'notConfigured');
  const client = clientFor(chain);
  if (!client) return unsupported(`No RPC is configured for ${chain.name}`, 'rpcNotConfigured');

  const request = chainRequest(input, chainId, indexes, singleChain);
  const account = getAddress(input.account.address);
  const gasReserve = chain.usdcIsGas
    ? (parseDecimal(DEFAULT_GAS_RESERVE, chain.usdcDecimals) ?? 0n)
    : 0n;
  const minAllocation = parseDecimal(MIN_ALLOCATION, chain.usdcDecimals) ?? 0n;

  try {
    const reading = await readChainState(
      client,
      chain,
      account,
      request.allocations.map((a) => getAddress(a.vault.address))
    );
    const resolved = resolveAmounts(request, reading.balance, chain.usdcDecimals, gasReserve);
    // Share estimates for the deposits that will be sync, at the same block
    const previews = await readPreviews(
      client,
      reading.blockNumber,
      reading.vaults.map((v, i) => {
        const family = vaultFamily(v.version);
        return v.isLagoon &&
          family !== undefined &&
          depositModeOf(v, request.options?.depositMode) === 'sync' &&
          (resolved.amounts[i] ?? 0n) > 0n
          ? { vault: v.address, assets: resolved.amounts[i], family }
          : undefined;
      })
    );
    reading.vaults.forEach((v, i) => (v.previewShares = previews[i]));

    const built = buildPlan(request, chain, reading, resolved, {
      ...context,
      minAllocation,
      gasReserve,
    });
    if (!built.ok)
      return { ok: false, indexes, issues: remap(built.issues, indexes), checks: built.checks };

    const { revertName, ...simulation } = await simulatePlan(
      client,
      chain.chainId,
      reading.blockNumber,
      account,
      built.plan.steps
    );
    return { ok: true, chain, indexes, plan: built.plan, simulation, revertName };
  } catch (error) {
    return {
      ok: false,
      indexes,
      checks: [],
      issues: [
        {
          code: 'STATE_UNAVAILABLE',
          severity: 'error',
          message: `Could not read ${chain.name}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`,
        },
      ],
    };
  }
}

/** Issue for the first failing call of a chain's simulation */
function simulationIssue(
  part: Extract<ChainResult, { ok: true }>,
  input: PlannedDepositInput
): Issue {
  const failed = part.simulation.calls.find((c) => !c.success);
  const step = part.plan.steps.find((s) => s.id === failed?.stepId);
  const allocationIndex =
    step && 'vault' in step
      ? input.allocations.findIndex(
          (a) =>
            a.vault.chainId === step.chainId &&
            a.vault.address.toLowerCase() === step.vault.address.toLowerCase()
        )
      : -1;
  return {
    code: issueCodeForRevert(part.revertName),
    severity: 'error',
    message: `The plan would fail on ${part.chain.name}: "${step?.description ?? failed?.stepId}" reverts with ${failed?.error ?? 'an unknown error'}`,
    allocationIndex: allocationIndex >= 0 ? allocationIndex : undefined,
    details: {
      chainId: String(part.chain.chainId),
      step: failed?.stepId ?? '',
      revert: failed?.error ?? '',
    },
  };
}

const simulatedCheck = (simulation: PlanSimulation, revertName?: string): Check => ({
  code: 'PLAN_SIMULATED',
  target: undefined,
  passed: simulation.success,
  observed: {
    chainId: String(simulation.chainId),
    blockNumber: simulation.blockNumber,
    calls: String(simulation.calls.length),
    ...(revertName ? { revert: revertName } : {}),
  },
  source: 'simulation',
});

/** Merges the per-chain plans into one, in input order, with global step ids */
export function mergePlans(
  parts: Array<Extract<ChainResult, { ok: true }>>,
  context: { now: Date; planId: string }
): Plan {
  const steps: Step[] = [];
  const batches: Plan['batches'] = [];
  for (const part of parts) {
    const ids = new Map<string, string>();
    for (const step of part.plan.steps) {
      const id = `s${steps.length + 1}`;
      ids.set(step.id, id);
      steps.push({ ...step, id, dependsOn: step.dependsOn.map((d) => ids.get(d) ?? d) });
    }
    batches.push({
      chainId: part.chain.chainId,
      stepIds: part.plan.steps.map((s) => ids.get(s.id)!),
    });
  }

  const allocations: Plan['allocations'] = [];
  for (const part of parts) {
    part.indexes.forEach((original, k) => (allocations[original] = part.plan.allocations[k]));
  }

  const totalsByChain = parts.map((part) => {
    const raw = part.plan.allocations.reduce((sum, a) => sum + BigInt(a.assets.raw), 0n);
    const list = part.plan.allocations
      .map(
        (a) =>
          `${a.vault.name} ${a.assets.formatted} USDC (${a.mode === 'sync' ? 'immediate' : 'after settlement'})`
      )
      .join(', ');
    return `on ${part.chain.name}, ${toAmount(raw, part.chain.usdcDecimals, 'USDC').formatted} USDC into ${list}`;
  });
  const vaultCount = allocations.length;
  const summary =
    `Deposit ${totalsByChain.join('; ')}. ` +
    `${vaultCount} vault${vaultCount > 1 ? 's' : ''} on ${parts.length} chain${parts.length > 1 ? 's' : ''}, ` +
    `${steps.length} transaction${steps.length > 1 ? 's' : ''} to sign.`;

  const account = parts[0].plan.account;
  return {
    specVersion: '1',
    planId: context.planId,
    contentHash: contentHashOf({ account, steps }),
    createdAt: context.now.toISOString(),
    validUntil: parts.map((p) => p.plan.validUntil).sort()[0],
    account,
    stateAt: parts.flatMap((p) => p.plan.stateAt),
    allocations,
    steps,
    batches,
    checks: parts.flatMap((p) => [...p.plan.checks, simulatedCheck(p.simulation, p.revertName)]),
    warnings: parts.flatMap((p) => remap(p.plan.warnings, p.indexes)),
    summary,
    simulations: parts.map((p) => p.simulation),
  };
}

export async function prepareDeposit(input: PrepareDepositInput): Promise<PrepareDepositOutput> {
  const inputIssues = validateRequest(input);
  if (inputIssues.length > 0) return { ok: false, issues: inputIssues, checks: [] };
  if (!input.account) {
    return {
      ok: false,
      issues: [
        {
          code: 'ACCOUNT_REQUIRED',
          severity: 'error',
          message:
            'No wallet address given: the plan is checked against the wallet the user connects in the app (signUrl), or call again with account.address',
        },
      ],
      checks: [],
    };
  }
  const planned: PlannedDepositInput = { ...input, account: input.account };

  const now = new Date();
  const context = { now, planId: uuidv7(now.getTime()) };
  const groups = groupByChain(planned);
  const results = await Promise.all(
    [...groups].map(([chainId, indexes]) =>
      prepareChain(planned, chainId, indexes, groups.size === 1, context)
    )
  );

  // All-or-nothing (D1): every problem on every chain, at once
  const failed = results.filter((r): r is Extract<ChainResult, { ok: false }> => !r.ok);
  const parts = results.filter((r): r is Extract<ChainResult, { ok: true }> => r.ok);
  const simulationFailures = parts.filter((p) => !p.simulation.success);
  if (failed.length > 0 || simulationFailures.length > 0) {
    return {
      ok: false,
      issues: [
        ...failed.flatMap((r) => r.issues),
        ...simulationFailures.map((p) => simulationIssue(p, planned)),
      ],
      checks: [
        ...failed.flatMap((r) => r.checks),
        ...parts.flatMap((p) => [...p.plan.checks, simulatedCheck(p.simulation, p.revertName)]),
      ],
    };
  }

  const plan = mergePlans(parts, context);
  const exports = buildExports(planned, plan);
  return { ok: true, plan, ...(exports ? { exports } : {}) };
}
