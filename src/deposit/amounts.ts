/**
 * Amount helpers for deposit plans. All math in BigInt base units.
 */

import { formatUnits, parseUnits } from 'viem';
import type { Amount, Issue } from './types.js';
import type { PrepareDepositInput } from '../utils/validators.js';

export function toAmount(raw: bigint, decimals: number, symbol: string): Amount {
  const [whole, fraction = ''] = formatUnits(raw, decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return {
    raw: raw.toString(),
    formatted: `${grouped}.${fraction.padEnd(2, '0')}`,
    decimals,
    symbol,
  };
}

/** Parses a human decimal string; more decimals than the token has is an error */
export function parseDecimal(value: string, decimals: number): bigint | null {
  const fraction = value.split('.')[1] ?? '';
  if (fraction.length > decimals) return null;
  return parseUnits(value, decimals);
}

export interface ResolvedAmounts {
  total: bigint;
  amounts: bigint[];
  issues: Issue[];
}

/**
 * Turns the allocations into exact amounts (spec §6): fixed amounts as given,
 * each bps share of the total rounded down, and when the allocations cover
 * exactly the total, the rounding dust goes to the last bps allocation (or
 * the largest with remainder: 'largest'). Fixed amounts plus shares may not
 * exceed the total.
 */
export function resolveAmounts(
  input: PrepareDepositInput,
  balance: bigint,
  decimals: number,
  gasReserve: bigint
): ResolvedAmounts {
  const issues: Issue[] = [];
  const invalid = (message: string, allocationIndex?: number): ResolvedAmounts => ({
    total: 0n,
    amounts: [],
    issues: [...issues, { code: 'INVALID_INPUT', severity: 'error', message, allocationIndex }],
  });

  // Total
  let total: bigint | null = null;
  if (input.total?.kind === 'amount') {
    total = parseDecimal(input.total.value, decimals);
    if (total === null) return invalid(`total has more than ${decimals} decimals`);
  } else if (input.total?.kind === 'max') {
    const reserve =
      input.total.keepForGas !== undefined
        ? parseDecimal(input.total.keepForGas, decimals)
        : gasReserve;
    if (reserve === null) return invalid(`keepForGas has more than ${decimals} decimals`);
    total = balance > reserve ? balance - reserve : 0n;
  }

  // Fixed amounts
  const amounts: bigint[] = [];
  let fixedSum = 0n;
  for (const [i, allocation] of input.allocations.entries()) {
    if (allocation.kind !== 'amount') {
      amounts.push(0n);
      continue;
    }
    const value = parseDecimal(allocation.value, decimals);
    if (value === null) return invalid(`amount has more than ${decimals} decimals`, i);
    amounts.push(value);
    fixedSum += value;
  }

  const overTotal = (): ResolvedAmounts => ({
    total: total ?? 0n,
    amounts,
    issues: [
      ...issues,
      {
        code: 'BPS_SUM_INVALID',
        severity: 'error',
        message: 'The fixed amounts and percentages add up to more than the total',
      },
    ],
  });

  const bpsIndexes = input.allocations.flatMap((a, i) => (a.kind === 'bps' ? [i] : []));
  if (bpsIndexes.length === 0) {
    if (total !== null && fixedSum > total) return overTotal();
    return { total: total ?? fixedSum, amounts, issues };
  }

  const bpsSum = bpsIndexes.reduce((sum, i) => {
    const allocation = input.allocations[i];
    return sum + (allocation.kind === 'bps' ? allocation.value : 0);
  }, 0);
  if (total === null) {
    issues.push({
      code: 'BPS_SUM_INVALID',
      severity: 'error',
      message: 'Percentages need a total amount',
    });
    return { total: 0n, amounts, issues };
  }
  if (bpsSum > 10_000) {
    issues.push({
      code: 'BPS_SUM_INVALID',
      severity: 'error',
      message: `Percentages add up to ${bpsSum / 100}%, more than 100%`,
    });
    return { total, amounts, issues };
  }
  // Each percentage is a share of the total (spec §4), not of what the fixed
  // amounts leave
  let assigned = 0n;
  for (const i of bpsIndexes) {
    const allocation = input.allocations[i];
    if (allocation.kind !== 'bps') continue;
    amounts[i] = (total * BigInt(allocation.value)) / 10_000n;
    assigned += amounts[i];
  }
  // Exact shares (no rounding) must fit in the total with the fixed amounts
  if (fixedSum * 10_000n + total * BigInt(bpsSum) > total * 10_000n) return overTotal();
  // Rounding dust: only when the allocations cover exactly the total
  if (fixedSum * 10_000n + total * BigInt(bpsSum) === total * 10_000n) {
    const dust = total - fixedSum - assigned;
    const target =
      input.options?.remainder === 'largest'
        ? bpsIndexes.reduce((best, i) => (amounts[i] > amounts[best] ? i : best), bpsIndexes[0])
        : bpsIndexes[bpsIndexes.length - 1];
    amounts[target] += dust;
  }

  return { total, amounts, issues };
}
