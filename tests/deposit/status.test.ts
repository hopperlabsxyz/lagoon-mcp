import { afterEach, describe, it, expect, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Address } from 'viem';
import { vaultAbi } from '../../src/deposit/abi';
import { DEPOSIT_CHAINS } from '../../src/deposit/config';

const eth = DEPOSIT_CHAINS[1];
const ACCOUNT = '0xa11ce00000000000000000000000000000000001' as Address;
const VAULT = '0x1000000000000000000000000000000000000001' as Address;
const FAKE = '0x2000000000000000000000000000000000000002' as Address;
const HASH = `0x${'ab'.repeat(32)}`;

/** A DepositRequest log of `emitter`, for request 7 of ACCOUNT */
const requestLog = (emitter: Address) => ({
  address: emitter,
  topics: encodeEventTopics({
    abi: vaultAbi,
    eventName: 'DepositRequest',
    args: { controller: ACCOUNT, owner: ACCOUNT, requestId: 7n },
  }),
  data: encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [ACCOUNT, 10_000_000n]),
  blockNumber: 100n,
  logIndex: 0,
  transactionIndex: 0,
  transactionHash: HASH,
  blockHash: HASH,
  removed: false,
});

interface Node {
  logs: ReturnType<typeof requestLog>[];
  pending?: bigint;
  /** What reading the cancel events does */
  cancelEvents: 'none' | 'found' | 'rangeTooLong' | 'broken';
}

async function status(node: Node) {
  vi.resetModules();
  vi.doMock('../../src/deposit/chain', async (original) => ({
    ...(await original<typeof import('../../src/deposit/chain')>()),
    clientFor: () => ({
      getBlock: () => Promise.resolve({ number: 200n, timestamp: 1000n }),
      getTransactionReceipt: () =>
        Promise.resolve({ status: 'success', to: VAULT, blockNumber: 100n, logs: node.logs }),
      // Only VAULT is from a Lagoon factory
      multicall: ({ contracts }: { contracts: Array<{ address: Address; args: Address[] }> }) =>
        Promise.resolve(
          contracts.map((c) => ({
            status: 'success',
            result: c.address === eth.factories[0] && c.args[0] === VAULT,
          }))
        ),
      readContract: ({ functionName }: { functionName: string }) =>
        Promise.resolve(
          functionName === 'name'
            ? 'Vault'
            : functionName === 'pendingDepositRequest'
              ? (node.pending ?? 0n)
              : 0n
        ),
      getContractEvents: ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        if (node.cancelEvents === 'broken') return Promise.reject(new Error('provider down'));
        if (node.cancelEvents === 'rangeTooLong' && toBlock - fromBlock > 50n)
          return Promise.reject(new Error('block range too large'));
        return Promise.resolve(
          node.cancelEvents === 'found' && fromBlock <= 150n && 150n <= toBlock ? [{}] : []
        );
      },
    }),
  }));
  const { depositStatus } = await import('../../src/deposit/status');
  return depositStatus({ account: ACCOUNT, txHashes: [{ chainId: 1, hash: HASH }] });
}

describe('deposit_status from a transaction hash', () => {
  afterEach(() => vi.doUnmock('../../src/deposit/chain'));

  it('follows a pending request of a Lagoon vault', async () => {
    const out = await status({
      logs: [requestLog(VAULT)],
      pending: 10_000_000n,
      cancelEvents: 'none',
    });
    expect(out.deposits).toMatchObject([
      { status: 'requested', requestId: '7', vault: { name: 'Vault' } },
    ]);
  });

  it('ignores deposit events emitted by a contract no Lagoon factory made', async () => {
    const out = await status({
      logs: [requestLog(FAKE)],
      pending: 10_000_000n,
      cancelEvents: 'none',
    });
    expect(out.deposits.map((d) => d.status)).toEqual(['notFound']);
  });

  it('tells a canceled request from a claimed one, reading long ranges in chunks', async () => {
    expect(
      (await status({ logs: [requestLog(VAULT)], cancelEvents: 'found' })).deposits[0].status
    ).toBe('canceled');
    expect(
      (await status({ logs: [requestLog(VAULT)], cancelEvents: 'rangeTooLong' })).deposits[0].status
    ).toBe('claimed');
  });

  it('says it cannot tell claimed from canceled when the cancel events cannot be read', async () => {
    const [deposit] = (await status({ logs: [requestLog(VAULT)], cancelEvents: 'broken' }))
      .deposits;
    expect(deposit.status).toBe('claimed');
    expect(deposit.next?.description).toContain('could not be read');
  });
});
