/**
 * prepare_deposit: request → chain state → plan → simulation.
 */

import { getAddress } from 'viem';
import { resolveAmounts, parseDecimal } from './amounts.js';
import { buildPlan } from './build-plan.js';
import {
  clientFor,
  issueCodeForRevert,
  readChainState,
  readPreviews,
  simulatePlan,
} from './chain.js';
import { DEFAULT_GAS_RESERVE, DEPOSIT_CHAINS, MIN_ALLOCATION, rpcUrlFor } from './config.js';
import type { Issue, PrepareDepositOutput } from './types.js';
import type { PrepareDepositInput } from '../utils/validators.js';

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

const fail = (issues: Issue[]): PrepareDepositOutput => ({ ok: false, issues, checks: [] });

/** Input rules that need no chain state (spec §4) */
export function validateRequest(input: PrepareDepositInput): Issue[] {
  const issues: Issue[] = [];
  if (input.account.type === 'smartAccount') {
    issues.push({
      code: 'UNSUPPORTED_ACCOUNT_TYPE',
      severity: 'error',
      message: 'Smart accounts are not supported yet',
    });
  }
  const seen = new Set<string>();
  input.allocations.forEach((a, i) => {
    if (a.vault.chainId !== input.source.chainId) {
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

export async function prepareDeposit(input: PrepareDepositInput): Promise<PrepareDepositOutput> {
  const chain = DEPOSIT_CHAINS[input.source.chainId];
  if (!chain) {
    return fail([
      {
        code: 'UNSUPPORTED_CHAIN',
        severity: 'error',
        message: `Chain ${input.source.chainId} is not supported for deposits`,
        details: { reason: 'notConfigured' },
      },
    ]);
  }
  const client = clientFor(chain);
  if (!client || !rpcUrlFor(chain.chainId)) {
    return fail([
      {
        code: 'UNSUPPORTED_CHAIN',
        severity: 'error',
        message: `No RPC is configured for ${chain.name}`,
        details: { reason: 'rpcNotConfigured' },
      },
    ]);
  }

  const inputIssues = validateRequest(input);
  if (inputIssues.length > 0) return fail(inputIssues);

  const account = getAddress(input.account.address);
  const gasReserve = parseDecimal(DEFAULT_GAS_RESERVE, chain.usdcDecimals) ?? 0n;
  const minAllocation = parseDecimal(MIN_ALLOCATION, chain.usdcDecimals) ?? 0n;

  try {
    const reading = await readChainState(
      client,
      chain,
      account,
      input.allocations.map((a) => getAddress(a.vault.address))
    );
    const resolved = resolveAmounts(input, reading.balance, chain.usdcDecimals, gasReserve);

    // Share estimates for the deposits that will be sync, at the same block
    const previews = await readPreviews(
      client,
      reading.blockNumber,
      reading.vaults.map((v, i) =>
        v.isLagoon && v.navValid && (resolved.amounts[i] ?? 0n) > 0n
          ? { vault: v.address, assets: resolved.amounts[i] }
          : undefined
      )
    );
    reading.vaults.forEach((v, i) => (v.previewShares = previews[i]));

    const now = new Date();
    const built = buildPlan(input, chain, reading, resolved, {
      now,
      planId: uuidv7(now.getTime()),
      minAllocation,
      gasReserve,
    });
    if (!built.ok) return built;

    const simulation = await simulatePlan(
      client,
      chain.chainId,
      reading.blockNumber,
      account,
      built.plan.steps
    );
    const { revertName, ...simulationResult } = simulation;
    const checks = [
      ...built.plan.checks,
      {
        code: 'PLAN_SIMULATED' as const,
        passed: simulation.success,
        observed: {
          blockNumber: simulation.blockNumber,
          calls: String(simulation.calls.length),
          ...(revertName ? { revert: revertName } : {}),
        },
        source: 'simulation' as const,
      },
    ];

    if (!simulation.success) {
      const failed = simulation.calls.find((c) => !c.success);
      const step = built.plan.steps.find((s) => s.id === failed?.stepId);
      const allocationIndex =
        step && 'vault' in step
          ? input.allocations.findIndex(
              (a) => a.vault.address.toLowerCase() === step.vault.address.toLowerCase()
            )
          : undefined;
      return {
        ok: false,
        checks,
        issues: [
          {
            code: issueCodeForRevert(revertName),
            severity: 'error',
            message: `The plan would fail on chain: "${step?.description ?? failed?.stepId}" reverts with ${failed?.error ?? 'an unknown error'}`,
            allocationIndex:
              allocationIndex !== undefined && allocationIndex >= 0 ? allocationIndex : undefined,
            details: { step: failed?.stepId ?? '', revert: failed?.error ?? '' },
          },
        ],
      };
    }

    return {
      ok: true,
      plan: { ...built.plan, checks, simulation: simulationResult },
      ...(built.exports ? { exports: built.exports } : {}),
    };
  } catch (error) {
    return fail([
      {
        code: 'STATE_UNAVAILABLE',
        severity: 'error',
        message: `Could not read ${chain.name}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`,
      },
    ]);
  }
}
