import { afterEach, describe, it, expect, vi } from 'vitest';
import type { Address } from 'viem';
import { DEPOSIT_CHAINS } from '../../src/deposit/config';
import { CHAIN_MODULE, openVault, prepareWithChain } from '../helpers/deposit-chain';

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
  vaults: [openVault(VAULT, DEPOSIT_CHAINS[1].usdc)],
};

const prepareWith = (chain: Record<string, unknown>, chainId = 1) =>
  prepareWithChain(chain, input(chainId));

describe('prepareDeposit error paths', () => {
  afterEach(() => vi.doUnmock(CHAIN_MODULE));

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
