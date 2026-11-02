import { afterEach, describe, it, expect, vi } from 'vitest';
import type { Address } from 'viem';
import { DEPOSIT_CHAINS } from '../../src/deposit/config';

const ACCOUNT = '0xa11ce00000000000000000000000000000000001' as Address;
const VAULT = '0x1000000000000000000000000000000000000001' as Address;
const input = (chainId: number) =>
  ({
    account: { address: ACCOUNT },
    source: { kind: 'wallet', asset: 'USDC' },
    total: { kind: 'amount', value: '10' },
    allocations: [{ vault: { chainId, address: VAULT }, kind: 'bps', value: 10000 }],
  }) as never;

const reading = {
  chainId: 1,
  blockNumber: 1n,
  timestamp: 1n,
  balance: 100_000_000n,
  vaults: [
    {
      address: VAULT,
      isLagoon: true,
      name: 'Vault',
      decimals: 18,
      version: 'v0.6.0',
      asset: DEPOSIT_CHAINS[1].usdc,
      paused: false,
      isAllowed: true,
      state: 0,
      syncMode: 0,
      navValid: false,
      allowance: 0n,
    },
  ],
};

async function prepareWith(chain: Partial<Record<string, unknown>>, chainId = 1) {
  vi.resetModules();
  vi.doMock('../../src/deposit/chain', async (original) => ({
    ...(await original<typeof import('../../src/deposit/chain')>()),
    clientFor: () => ({}),
    readPreviews: () => Promise.resolve([]),
    ...chain,
  }));
  const { prepareDeposit } = await import('../../src/deposit/prepare');
  return prepareDeposit(input(chainId));
}

describe('prepareDeposit error paths', () => {
  afterEach(() => vi.doUnmock('../../src/deposit/chain'));

  it('says the chain could not be read when the reads fail', async () => {
    const out = await prepareWith({
      readChainState: () => Promise.reject(new Error('HTTP 429')),
    });
    expect(!out.ok && out.issues[0]).toMatchObject({
      code: 'STATE_UNAVAILABLE',
      message: 'Could not read Ethereum: HTTP 429',
    });
  });

  it('says the simulation could not run, not the chain, when only it fails', async () => {
    const out = await prepareWith({
      readChainState: () => Promise.resolve(reading),
      simulatePlan: () => Promise.reject(new Error('timeout')),
    });
    expect(!out.ok && out.issues[0]).toMatchObject({
      code: 'SIMULATION_FAILED',
      message: 'Could not simulate the plan on Ethereum: timeout',
    });
  });

  it('reports a chain without RPC, and an unsupported chain, per allocation', async () => {
    const noRpc = await prepareWith({ clientFor: () => undefined });
    expect(!noRpc.ok && noRpc.issues[0]).toMatchObject({
      code: 'UNSUPPORTED_CHAIN',
      details: { reason: 'rpcNotConfigured' },
    });
    const unsupported = await prepareWith({}, 56);
    expect(!unsupported.ok && unsupported.issues[0]).toMatchObject({
      code: 'UNSUPPORTED_CHAIN',
      details: { reason: 'notConfigured' },
    });
  });
});
