import { vi } from 'vitest';
import type { Address } from 'viem';
import type { VaultReading } from '../../src/deposit/build-plan';

export const CHAIN_MODULE = '../../src/deposit/chain';

/** One open v0.6 Lagoon vault, as `readChainState` returns it */
export function openVault(address: Address, usdc: Address, overrides: Partial<VaultReading> = {}) {
  return {
    address,
    isLagoon: true,
    name: 'Vault',
    decimals: 18,
    version: 'v0.6.0',
    asset: usdc,
    paused: false,
    isAllowed: true,
    state: 0,
    syncMode: 0,
    navValid: false,
    allowance: 0n,
    ...overrides,
  };
}

/**
 * Runs `prepareDeposit` with parts of the chain module replaced (no RPC by
 * default). Call `vi.doUnmock(CHAIN_MODULE)` after each test.
 */
export async function prepareWithChain(chain: Record<string, unknown>, input: unknown) {
  vi.resetModules();
  vi.doMock(CHAIN_MODULE, async (original) => ({
    ...(await original<typeof import('../../src/deposit/chain')>()),
    clientFor: () => ({}),
    readPreviews: () => Promise.resolve([]),
    ...chain,
  }));
  const { prepareDeposit } = await import('../../src/deposit/prepare');
  return prepareDeposit(input as never);
}
