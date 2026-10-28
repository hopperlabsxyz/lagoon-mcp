import { describe, it, expect } from 'vitest';
import { decodeFunctionData } from 'viem';
import { resolveAmounts, toAmount } from '../../src/deposit/amounts';
import {
  buildPlan,
  contentHashOf,
  depositModeOf,
  type ChainReading,
  type VaultReading,
} from '../../src/deposit/build-plan';
import { DEPOSIT_CHAINS } from '../../src/deposit/config';
import { validateRequest, uuidv7 } from '../../src/deposit/prepare';
import { requestStatus } from '../../src/deposit/status';
import { erc20Abi, vaultAbi } from '../../src/deposit/abi';
import type { PrepareDepositInput } from '../../src/utils/validators';

const arc = DEPOSIT_CHAINS[5042];
const ACCOUNT = '0xa11ce00000000000000000000000000000000001';
const V1 = '0x1000000000000000000000000000000000000001';
const V2 = '0x2000000000000000000000000000000000000002';
const V3 = '0x3000000000000000000000000000000000000003';
const usdc = (n: number) => BigInt(Math.round(n * 1e6));

function vault(address: string, overrides: Partial<VaultReading> = {}): VaultReading {
  return {
    address: address as `0x${string}`,
    isLagoon: true,
    name: `Vault ${address.slice(2, 3)}`,
    decimals: 18,
    version: 'v0.6.0',
    asset: arc.usdc,
    paused: false,
    isAllowed: true,
    maxCap: usdc(10_000_000),
    totalAssets: usdc(1_000_000),
    syncMode: 0,
    navValid: false,
    entryRateBps: 0,
    allowance: 0n,
    pendingDeposit: 0n,
    ...overrides,
  };
}

function request(
  allocations: PrepareDepositInput['allocations'],
  total?: PrepareDepositInput['total']
): PrepareDepositInput {
  return {
    account: { address: ACCOUNT },
    source: { kind: 'wallet', chainId: 5042, asset: 'USDC' },
    allocations,
    ...(total ? { total } : {}),
  };
}

function plan(input: PrepareDepositInput, vaults: VaultReading[], balance = usdc(1_000_050)) {
  const reading: ChainReading = {
    chainId: 5042,
    blockNumber: 100n,
    timestamp: 1_800_000_000n,
    balance,
    vaults,
  };
  const resolved = resolveAmounts(input, balance, 6, usdc(1));
  return buildPlan(input, arc, reading, resolved, {
    now: new Date('2026-10-28T10:00:00Z'),
    planId: 'test-plan',
    minAllocation: usdc(1),
    gasReserve: usdc(1),
  });
}

const twentyThirtyFifty = request(
  [
    { vault: { chainId: 5042, address: V1 }, kind: 'bps', value: 2000 },
    { vault: { chainId: 5042, address: V2 }, kind: 'bps', value: 3000 },
    { vault: { chainId: 5042, address: V3 }, kind: 'bps', value: 5000 },
  ],
  { kind: 'amount', value: '1000000' }
);

describe('amounts', () => {
  it('formats base units with grouping', () => {
    expect(toAmount(usdc(1_234_567.5), 6, 'USDC').formatted).toBe('1,234,567.50');
    expect(toAmount(580763n, 6, 'USDC').formatted).toBe('0.580763');
  });

  it('splits bps, rounding down and giving the dust to the last allocation', () => {
    const input = request(
      [
        { vault: { chainId: 5042, address: V1 }, kind: 'bps', value: 3333 },
        { vault: { chainId: 5042, address: V2 }, kind: 'bps', value: 6667 },
      ],
      { kind: 'amount', value: '0.000010' }
    );
    const { amounts } = resolveAmounts(input, 0n, 6, 0n);
    expect(amounts).toEqual([3n, 7n]);
    expect(amounts[0] + amounts[1]).toBe(10n);
  });

  it('keeps the gas reserve with total: max', () => {
    const input = request([{ vault: { chainId: 5042, address: V1 }, kind: 'bps', value: 10000 }], {
      kind: 'max',
    });
    expect(resolveAmounts(input, usdc(5), 6, usdc(1)).amounts).toEqual([usdc(4)]);
  });

  it('rejects percentages above 100% and amounts with too many decimals', () => {
    const over = request(
      [
        { vault: { chainId: 5042, address: V1 }, kind: 'bps', value: 6000 },
        { vault: { chainId: 5042, address: V2 }, kind: 'bps', value: 5000 },
      ],
      { kind: 'amount', value: '10' }
    );
    expect(resolveAmounts(over, 0n, 6, 0n).issues[0].code).toBe('BPS_SUM_INVALID');
    const precise = request([
      { vault: { chainId: 5042, address: V1 }, kind: 'amount', value: '1.0000001' },
    ]);
    expect(resolveAmounts(precise, 0n, 6, 0n).issues[0].code).toBe('INVALID_INPUT');
  });
});

describe('buildPlan — worked example (spec §9)', () => {
  const result = plan(twentyThirtyFifty, [vault(V1, { navValid: true }), vault(V2), vault(V3)]);

  it('builds approve + deposit per vault, in order, sync where the NAV is valid', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { steps, allocations } = result.plan;
    expect(steps.map((s) => s.kind)).toEqual([
      'erc20.approve',
      'lagoon.syncDeposit',
      'erc20.approve',
      'lagoon.requestDeposit',
      'erc20.approve',
      'lagoon.requestDeposit',
    ]);
    expect(allocations.map((a) => a.assets.raw)).toEqual([
      '200000000000',
      '300000000000',
      '500000000000',
    ]);
    expect(steps.map((s) => s.dependsOn)).toEqual([[], ['s1'], ['s2'], ['s3'], ['s4'], ['s5']]);
  });

  it('encodes exact approvals and deposits to the account, never a nonce', () => {
    if (!result.ok) return;
    const [approve, syncDeposit, , requestDeposit] = result.plan.steps;
    expect(decodeFunctionData({ abi: erc20Abi, data: approve.execution.data }).args).toEqual([
      expect.stringMatching(/^0x1000/i),
      200_000_000_000n,
    ]);
    expect(
      String(
        decodeFunctionData({ abi: vaultAbi, data: syncDeposit.execution.data }).args?.[1]
      ).toLowerCase()
    ).toBe(ACCOUNT);
    expect(
      decodeFunctionData({ abi: vaultAbi, data: requestDeposit.execution.data }).functionName
    ).toBe('requestDeposit');
    expect(Object.keys(approve.execution).sort()).toEqual(['data', 'to', 'type', 'value']);
  });

  it('is stable: the same steps give the same content hash', () => {
    const again = plan(twentyThirtyFifty, [vault(V1, { navValid: true }), vault(V2), vault(V3)]);
    if (!result.ok || !again.ok) return;
    expect(again.plan.contentHash).toBe(result.plan.contentHash);
  });
});

describe('buildPlan — failures (all reported together)', () => {
  it('reports capacity, access and balance problems at once, with hints', () => {
    const result = plan(
      twentyThirtyFifty,
      [vault(V1), vault(V2, { maxCap: usdc(1_120_000) }), vault(V3, { isAllowed: false })],
      usdc(900_000)
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.issues.map((i) => [i.code, i.allocationIndex]);
    expect(codes).toContainEqual(['MAX_CAP_REACHED', 1]);
    expect(codes).toContainEqual(['ACCESS_DENIED', 2]);
    expect(codes).toContainEqual(['INSUFFICIENT_BALANCE', undefined]);
    expect(
      result.issues.find((i) => i.code === 'MAX_CAP_REACHED')?.details?.remainingCapacity
    ).toBe('120,000.00');
  });

  it('refuses an address the factory did not create', () => {
    const result = plan(
      request([{ vault: { chainId: 5042, address: V1 }, kind: 'amount', value: '10' }]),
      [vault(V1, { isLagoon: false })]
    );
    expect(!result.ok && result.issues[0].code).toBe('NOT_A_LAGOON_VAULT');
  });

  it('skips the approval when the allowance already covers the deposit', () => {
    const result = plan(
      request([{ vault: { chainId: 5042, address: V1 }, kind: 'amount', value: '10' }]),
      [vault(V1, { allowance: usdc(50) })]
    );
    expect(result.ok && result.plan.steps.map((s) => s.kind)).toEqual(['lagoon.requestDeposit']);
  });
});

describe('request rules and helpers', () => {
  it('refuses duplicates and cross-chain vaults', () => {
    const issues = validateRequest(
      request([
        { vault: { chainId: 5042, address: V1 }, kind: 'amount', value: '1' },
        { vault: { chainId: 5042, address: V1 }, kind: 'amount', value: '1' },
        { vault: { chainId: 8453, address: V2 }, kind: 'amount', value: '1' },
      ])
    );
    expect(issues.map((i) => i.code)).toEqual(['DUPLICATE_VAULT', 'CROSS_CHAIN_NOT_SUPPORTED']);
  });

  it('picks sync only when allowed and the NAV is valid', () => {
    expect(depositModeOf({ syncMode: 0, navValid: true })).toBe('sync');
    expect(depositModeOf({ syncMode: 0, navValid: false })).toBe('async');
    expect(depositModeOf({ syncMode: 3, navValid: true })).toBe('async');
    expect(depositModeOf({ syncMode: 1, navValid: true }, 'async')).toBe('async');
  });

  it('reads a request status from pending and claimable amounts', () => {
    expect(requestStatus(5n, 0n)).toBe('requested');
    expect(requestStatus(0n, 5n)).toBe('claimable');
    expect(requestStatus(0n, 0n)).toBe('claimed');
  });

  it('makes time-ordered UUIDv7 ids and order-independent hashes', () => {
    expect(uuidv7(1_800_000_000_000)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(uuidv7(1) < uuidv7(2)).toBe(true);
    expect(contentHashOf({ a: '1', b: '2' })).toBe(contentHashOf({ b: '2', a: '1' }));
  });
});
