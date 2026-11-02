import { describe, it, expect } from 'vitest';
import { resolveAmounts } from '../../src/deposit/amounts';
import { buildPlan, type VaultReading } from '../../src/deposit/build-plan';
import { DEPOSIT_CHAINS } from '../../src/deposit/config';
import { chainRequest, groupByChain, mergePlans, validateRequest } from '../../src/deposit/prepare';
import type { PrepareDepositInput } from '../../src/utils/validators';

const ACCOUNT = '0xa11ce00000000000000000000000000000000001';
const A1 = '0x1000000000000000000000000000000000000001';
const A2 = '0x2000000000000000000000000000000000000002';
const B1 = '0x3000000000000000000000000000000000000003';
const usdc = (n: number) => BigInt(Math.round(n * 1e6));

// 100 USDC split 50/50 on Arc (A1, A2), 40 USDC all-in on Base (B1); input order interleaves chains
const input: PrepareDepositInput = {
  account: { address: ACCOUNT },
  source: { kind: 'wallet', asset: 'USDC' },
  totals: [
    { chainId: 5042, kind: 'amount', value: '100' },
    { chainId: 8453, kind: 'amount', value: '40' },
  ],
  allocations: [
    { vault: { chainId: 5042, address: A1 }, kind: 'bps', value: 5000 },
    { vault: { chainId: 8453, address: B1 }, kind: 'bps', value: 10000 },
    { vault: { chainId: 5042, address: A2 }, kind: 'bps', value: 5000 },
  ],
};

function vault(address: string, asset: `0x${string}`): VaultReading {
  return {
    address: address as `0x${string}`,
    isLagoon: true,
    name: `Vault ${address.slice(2, 3)}`,
    decimals: 18,
    version: 'v0.6.0',
    asset,
    paused: false,
    isAllowed: true,
    maxCap: usdc(1_000_000),
    totalAssets: 0n,
    syncMode: 0,
    navValid: false,
    entryRateBps: 0,
    allowance: 0n,
    pendingDeposit: 0n,
    state: 0,
  };
}

const context = { now: new Date('2026-10-28T10:00:00Z'), planId: 'plan' };

function chainPart(chainId: number, indexes: number[]) {
  const chain = DEPOSIT_CHAINS[chainId];
  const request = chainRequest(input, chainId, indexes, false);
  const vaults = request.allocations.map((a) => vault(a.vault.address, chain.usdc));
  const reading = {
    chainId,
    blockNumber: 10n,
    timestamp: 1_800_000_000n,
    balance: usdc(500),
    vaults,
  };
  const resolved = resolveAmounts(request, reading.balance, 6, usdc(1));
  const built = buildPlan(request, chain, reading, resolved, {
    ...context,
    minAllocation: usdc(1),
    gasReserve: usdc(1),
  });
  if (!built.ok) throw new Error(JSON.stringify(built.issues));
  const simulation = { chainId, blockNumber: '10', success: true, calls: [] };
  return { ok: true as const, chain, indexes, plan: built.plan, simulation };
}

describe('multi-chain plans', () => {
  it('groups allocations by vault chain, keeping input order', () => {
    expect([...groupByChain(input)]).toEqual([
      [5042, [0, 2]],
      [8453, [1]],
    ]);
  });

  it('applies each chain its own total', () => {
    const arc = chainRequest(input, 5042, [0, 2], false);
    expect(arc.total).toEqual({ kind: 'amount', value: '100' });
    expect(arc.allocations.map((a) => a.vault.address)).toEqual([A1, A2]);
    expect(chainRequest(input, 8453, [1], false).total).toEqual({ kind: 'amount', value: '40' });
  });

  it('accepts vaults on several chains when no source chain is pinned', () => {
    expect(validateRequest(input)).toEqual([]);
    expect(validateRequest({ ...input, source: { ...input.source, chainId: 5042 } })[0].code).toBe(
      'CROSS_CHAIN_NOT_SUPPORTED'
    );
  });

  it('merges into one plan: input order, global step ids, one batch and simulation per chain', () => {
    const plan = mergePlans([chainPart(5042, [0, 2]), chainPart(8453, [1])], context);

    expect(plan.allocations.map((a) => [a.vault.chainId, a.assets.formatted])).toEqual([
      [5042, '50.00'],
      [8453, '40.00'],
      [5042, '50.00'],
    ]);
    expect(plan.steps.map((s) => `${s.id}@${s.chainId}`)).toEqual([
      's1@5042',
      's2@5042',
      's3@5042',
      's4@5042',
      's5@8453',
      's6@8453',
    ]);
    // Dependencies stay inside their chain
    expect(plan.steps[4].dependsOn).toEqual([]);
    expect(plan.steps[5].dependsOn).toEqual(['s5']);
    expect(plan.batches).toEqual([
      { chainId: 5042, stepIds: ['s1', 's2', 's3', 's4'] },
      { chainId: 8453, stepIds: ['s5', 's6'] },
    ]);
    expect(plan.simulations.map((s) => s.chainId)).toEqual([5042, 8453]);
    expect(plan.stateAt.map((s) => s.chainId)).toEqual([5042, 8453]);
    expect(plan.summary).toContain('3 vaults on 2 chains, 6 transactions to sign');
    // Warnings point at the original allocation indexes
    expect(
      plan.warnings.filter((w) => w.code === 'ASYNC_DEPOSIT').map((w) => w.allocationIndex)
    ).toEqual([0, 2, 1]);
  });
});
