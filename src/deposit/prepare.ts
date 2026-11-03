/**
 * prepare_deposit: request → chain state → plan → simulation.
 *
 * Each vault is funded from the wallet on its own chain ("silo" mode, no
 * bridging). A plan may span several chains: each chain is read, planned and
 * simulated on its own block, then the parts are merged into one plan.
 */

import { getAddress } from 'viem';
import { resolveAmounts, parseDecimal, toAmount, type ResolvedAmounts } from './amounts.js';
import {
  buildExports,
  buildPlan,
  contentHashOf,
  depositModeOf,
  describeAllocation,
  plural,
  type ChainReading,
  type DraftPlan,
} from './build-plan.js';
import {
  clientFor,
  firstLine,
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
  // `total` is one chain's amount: on several chains it would be ignored
  const chains = new Set(input.allocations.map((a) => a.vault.chainId));
  if (input.total && chains.size > 1) {
    issues.push({
      code: 'INVALID_INPUT',
      severity: 'error',
      message:
        'The allocations are on several chains: give each chain its own total in `totals` (`total` is for one chain)',
    });
  }
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

/** One chain's total: its entry in `totals`, or `total` when the plan has a single chain */
function chainTotal(
  input: PlannedDepositInput,
  chainId: number,
  singleChain: boolean
): PlannedDepositInput['total'] {
  const perChain = input.totals?.find((t) => t.chainId === chainId);
  if (!perChain) return singleChain ? input.total : undefined;
  return perChain.kind === 'amount'
    ? { kind: 'amount', value: perChain.value }
    : { kind: 'max', keepForGas: perChain.keepForGas };
}

/** The part of the request that concerns one chain */
export function chainRequest(
  input: PlannedDepositInput,
  chainId: number,
  indexes: number[],
  singleChain: boolean
): PlannedDepositInput {
  return {
    ...input,
    source: { ...input.source, chainId },
    allocations: indexes.map((i) => input.allocations[i]),
    total: chainTotal(input, chainId, singleChain),
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

/** A chain's issues point to its own allocations: point them back to the request's */
const toRequestIndexes = (issues: Issue[], indexes: number[]): Issue[] =>
  issues.map((issue) =>
    issue.allocationIndex === undefined
      ? issue
      : { ...issue, allocationIndex: indexes[issue.allocationIndex] }
  );

/** Share estimates for the deposits that will be sync, read at the plan's block */
async function withSyncPreviews(
  client: NonNullable<ReturnType<typeof clientFor>>,
  request: PlannedDepositInput,
  reading: ChainReading,
  resolved: ResolvedAmounts
): Promise<void> {
  const previews = await readPreviews(
    client,
    reading.blockNumber,
    reading.vaults.map((vault, i) => {
      const family = vaultFamily(vault.version);
      const sync = depositModeOf(vault, request.options?.depositMode) === 'sync';
      const assets = resolved.amounts[i] ?? 0n;
      return vault.isLagoon && family !== undefined && sync && assets > 0n
        ? { vault: vault.address, assets, family }
        : undefined;
    })
  );
  reading.vaults.forEach((vault, i) => (vault.previewShares = previews[i]));
}

/** Reads, plans and simulates the part of the request on one chain */
async function prepareChain(
  input: PlannedDepositInput,
  chainId: number,
  indexes: number[],
  singleChain: boolean,
  context: { now: Date; planId: string }
): Promise<ChainResult> {
  const failure = (issues: Issue[], checks: Check[] = []): ChainResult => ({
    ok: false,
    indexes,
    issues,
    checks,
  });
  const unsupported = (message: string, reason: string): ChainResult =>
    failure(
      indexes.map((i) => ({
        code: 'UNSUPPORTED_CHAIN' as const,
        severity: 'error' as const,
        message,
        allocationIndex: i,
        details: { reason },
      }))
    );

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

  let reading: ChainReading;
  let built: ReturnType<typeof buildPlan>;
  try {
    reading = await readChainState(
      client,
      chain,
      account,
      request.allocations.map((a) => getAddress(a.vault.address))
    );
    const resolved = resolveAmounts(request, reading.balance, chain.usdcDecimals, gasReserve);
    await withSyncPreviews(client, request, reading, resolved);
    built = buildPlan(request, chain, reading, resolved, { ...context, minAllocation, gasReserve });
  } catch (error) {
    return failure([
      {
        code: 'STATE_UNAVAILABLE',
        severity: 'error',
        message: `Could not read ${chain.name}: ${firstLine(error, 'unknown error')}`,
      },
    ]);
  }
  if (!built.ok) return failure(toRequestIndexes(built.issues, indexes), built.checks);

  try {
    const { revertName, ...simulation } = await simulatePlan(
      client,
      chain.chainId,
      reading.blockNumber,
      account,
      built.plan.steps
    );
    return { ok: true, chain, indexes, plan: built.plan, simulation, revertName };
  } catch (error) {
    // The chain was read; it is the simulation that could not run
    return failure(
      [
        {
          code: 'SIMULATION_FAILED',
          severity: 'error',
          message: `Could not simulate the plan on ${chain.name}: ${firstLine(error, 'unknown error')}`,
        },
      ],
      built.plan.checks
    );
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
    const total = toAmount(raw, part.chain.usdcDecimals, 'USDC').formatted;
    return `${total} USDC on ${part.chain.name}: ${part.plan.allocations.map(describeAllocation).join(', ')}`;
  });
  const summary =
    `Deposit ${totalsByChain.join('; ')}. ` +
    `${plural(allocations.length, 'vault')} on ${plural(parts.length, 'chain')}, ` +
    `${plural(steps.length, 'transaction')} to sign.`;

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
    warnings: parts.flatMap((p) => toRequestIndexes(p.plan.warnings, p.indexes)),
    summary,
    simulations: parts.map((p) => p.simulation),
  };
}

const VAULT_PROBLEM_CODES: ReadonlySet<Issue['code']> = new Set([
  'NOT_A_LAGOON_VAULT',
  'ASSET_MISMATCH',
  'UNSUPPORTED_VAULT_VERSION',
  'VAULT_NOT_OPEN',
]);

/**
 * A problem with a vault itself, whoever deposits: the request is not worth
 * opening in the app (no signUrl). A chain deposits do not support is one;
 * a chain this server has no RPC for is not (the app has its own).
 */
export const isVaultProblem = (issue: Issue): boolean =>
  VAULT_PROBLEM_CODES.has(issue.code) ||
  (issue.code === 'UNSUPPORTED_CHAIN' && issue.details?.reason === 'notConfigured');

/** Reads vault state when no wallet is given; never a real account */
const PROBE_ACCOUNT = '0x000000000000000000000000000000000000dEaD';

/**
 * No plan without the wallet, but the vaults themselves are still checked:
 * read with a probe address, keeping only what is wrong with the vaults
 */
async function checkVaultsWithoutAccount(
  input: PrepareDepositInput
): Promise<PrepareDepositOutput> {
  const probe = await prepareDeposit({ ...input, account: { address: PROBE_ACCOUNT } });
  const vaultIssues = probe.ok
    ? []
    : probe.issues.filter(
        (i) => isVaultProblem(i) || i.code === 'UNSUPPORTED_CHAIN' || i.code === 'STATE_UNAVAILABLE'
      );
  return {
    ok: false,
    issues: [
      {
        code: 'ACCOUNT_REQUIRED',
        severity: 'error',
        message:
          'No wallet address given: the plan is checked against the wallet the user connects in the app (signUrl), or call again with account.address',
      },
      ...vaultIssues,
    ],
    checks: probe.ok ? [] : probe.checks.filter((c) => c.code.startsWith('VAULT_')),
  };
}

export async function prepareDeposit(input: PrepareDepositInput): Promise<PrepareDepositOutput> {
  const inputIssues = validateRequest(input);
  if (inputIssues.length > 0) return { ok: false, issues: inputIssues, checks: [] };
  if (!input.account) return checkVaultsWithoutAccount(input);
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
