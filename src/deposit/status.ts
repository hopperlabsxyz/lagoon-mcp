/**
 * deposit_status: where each deposit stands, from its transaction hash
 * (preferred) or from the account's latest request in a vault.
 */

import { getAddress, parseEventLogs, type Address, type Hex, type PublicClient } from 'viem';
import { toAmount } from './amounts.js';
import { areLagoonVaults, clientFor } from './chain.js';
import { vaultAbi } from './abi.js';
import { DEPOSIT_CHAINS, type DepositChainConfig } from './config.js';
import type { Amount, DepositStatus, DepositStatusOutput } from './types.js';
import type { DepositStatusInput } from '../utils/validators.js';

type Deposit = DepositStatusOutput['deposits'][number];

const NEXT: Partial<Record<DepositStatus, Deposit['next']>> = {
  requested: { description: "Waiting for the curator's next settlement" },
  canceled: { description: 'The request was canceled and the USDC returned to the wallet' },
  claimable: {
    description:
      'Settled: your shares can be claimed, or are claimed automatically with your next deposit request',
    action: 'lagoon.claim',
  },
};

/** Status of a request from what the vault reports for it (pure) */
export function requestStatus(pending: bigint, claimable: bigint): DepositStatus {
  if (pending > 0n) return 'requested';
  if (claimable > 0n) return 'claimable';
  return 'claimed';
}

async function readRequest(
  client: PublicClient,
  vault: Address,
  account: Address,
  requestId: bigint,
  blockNumber: bigint
): Promise<{ name: string; pending: bigint; claimable: bigint }> {
  const [name, pending, claimable] = await Promise.all([
    client.readContract({ address: vault, abi: vaultAbi, functionName: 'name', blockNumber }),
    client.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: 'pendingDepositRequest',
      args: [requestId, account],
      blockNumber,
    }),
    client.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: 'claimableDepositRequest',
      args: [requestId, account],
      blockNumber,
    }),
  ]);
  return { name, pending, claimable };
}

/** Log ranges tried when a provider refuses a long one, and how far back */
const LOG_CHUNK = 2_000n;
const MAX_LOG_CHUNKS = 100n;

/**
 * Whether the request was canceled after it was made (DepositRequestCanceled);
 * undefined when the logs cannot be read (providers cap log ranges: the range
 * is then read in chunks, up to MAX_LOG_CHUNKS of them).
 */
async function wasCanceled(
  client: PublicClient,
  vault: Address,
  controller: Address,
  requestId: bigint,
  fromBlock: bigint,
  toBlock: bigint
): Promise<boolean | undefined> {
  const hasCancel = async (from: bigint, to: bigint): Promise<boolean> => {
    const events = await client.getContractEvents({
      address: vault,
      abi: vaultAbi,
      eventName: 'DepositRequestCanceled',
      args: { requestId, controller },
      fromBlock: from,
      toBlock: to,
    });
    return events.length > 0;
  };
  try {
    return await hasCancel(fromBlock, toBlock);
  } catch {
    // The provider refused the whole range: read it in chunks, if not too many
  }
  if (toBlock - fromBlock > LOG_CHUNK * MAX_LOG_CHUNKS) return undefined;
  try {
    for (let from = fromBlock; from <= toBlock; from += LOG_CHUNK) {
      const chunkEnd = from + LOG_CHUNK - 1n;
      if (await hasCancel(from, chunkEnd < toBlock ? chunkEnd : toBlock)) return true;
    }
    return false;
  } catch {
    return undefined;
  }
}

const usdcAmount = (chain: DepositChainConfig, raw: bigint): Amount =>
  toAmount(raw, chain.usdcDecimals, 'USDC');

/** A deposit entry with no amounts: not found, or a failed transaction */
function emptyDeposit(
  chain: DepositChainConfig,
  hash: Hex,
  status: DepositStatus,
  vault: Address
): Deposit {
  const zero = usdcAmount(chain, 0n);
  return {
    vault: { chainId: chain.chainId, address: vault, name: 'unknown' },
    txHash: hash,
    status,
    assets: zero,
    pending: zero,
    claimable: zero,
  };
}

/** An instant deposit: shares were minted in the transaction itself */
async function syncedDeposit(
  client: PublicClient,
  chain: DepositChainConfig,
  hash: Hex,
  vault: Address,
  assets: bigint,
  blockNumber: bigint
): Promise<Deposit> {
  const name = await client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'name',
    blockNumber,
  });
  const zero = usdcAmount(chain, 0n);
  return {
    vault: { chainId: chain.chainId, address: vault, name },
    txHash: hash,
    status: 'synced',
    assets: usdcAmount(chain, assets),
    pending: zero,
    claimable: zero,
  };
}

/** A deposit request: where it stands now, told apart from a cancel by its event */
async function requestedDeposit(
  client: PublicClient,
  chain: DepositChainConfig,
  account: Address,
  hash: Hex,
  vault: Address,
  requestId: bigint,
  assets: bigint,
  requestBlock: bigint,
  blockNumber: bigint
): Promise<Deposit> {
  const state = await readRequest(client, vault, account, requestId, blockNumber);
  let status = requestStatus(state.pending, state.claimable);
  let next = NEXT[status];
  // A canceled request also reads 0 pending / 0 claimable
  if (status === 'claimed') {
    const canceled = await wasCanceled(
      client,
      vault,
      account,
      requestId,
      requestBlock,
      blockNumber
    );
    if (canceled === true) {
      status = 'canceled';
      next = NEXT.canceled;
    } else if (canceled === undefined) {
      next = {
        description:
          'Settled and claimed, or canceled: the cancel events could not be read to tell which',
      };
    }
  }
  return {
    vault: { chainId: chain.chainId, address: vault, name: state.name },
    txHash: hash,
    requestId: requestId.toString(),
    status,
    assets: usdcAmount(chain, assets),
    pending: usdcAmount(chain, state.pending),
    claimable: usdcAmount(chain, state.claimable),
    next,
  };
}

/**
 * The deposits of `account` in one transaction: one entry per DepositRequest or
 * DepositSync event, since a batched (EIP-5792) transaction can hold several.
 */
async function fromTxHash(
  client: PublicClient,
  chain: DepositChainConfig,
  account: Address,
  hash: Hex,
  blockNumber: bigint
): Promise<Deposit[]> {
  const receipt = await client.getTransactionReceipt({ hash }).catch(() => undefined);
  if (!receipt) return [emptyDeposit(chain, hash, 'notFound', account)];
  const target = getAddress(receipt.to ?? account);
  if (receipt.status === 'reverted') return [emptyDeposit(chain, hash, 'failed', target)];

  const mine = (owner: Address | undefined): boolean =>
    owner?.toLowerCase() === account.toLowerCase();
  const events = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, strict: false }).filter(
    (l) => (l.eventName === 'DepositSync' || l.eventName === 'DepositRequest') && mine(l.args.owner)
  );
  // Any contract can emit an event of this shape: keep those a Lagoon vault emitted
  const lagoon = await areLagoonVaults(
    client,
    chain,
    events.map((e) => getAddress(e.address)),
    blockNumber
  );
  const fromVaults = events.filter((_, i) => lagoon[i]);
  if (fromVaults.length === 0) return [emptyDeposit(chain, hash, 'notFound', target)];

  return Promise.all(
    fromVaults.map((event): Promise<Deposit> => {
      const vault = getAddress(event.address);
      if (event.eventName === 'DepositSync') {
        return syncedDeposit(client, chain, hash, vault, event.args.assets ?? 0n, blockNumber);
      }
      if (event.eventName !== 'DepositRequest' || event.args.requestId === undefined) {
        return Promise.resolve(emptyDeposit(chain, hash, 'notFound', vault));
      }
      return requestedDeposit(
        client,
        chain,
        account,
        hash,
        vault,
        event.args.requestId,
        event.args.assets ?? 0n,
        receipt.blockNumber,
        blockNumber
      );
    })
  );
}

/** The account's latest request in a vault (requestId 0 means "the latest") */
async function latestRequest(
  client: PublicClient,
  chain: DepositChainConfig,
  account: Address,
  vault: Address,
  blockNumber: bigint
): Promise<Deposit> {
  const state = await readRequest(client, vault, account, 0n, blockNumber);
  const status =
    state.pending === 0n && state.claimable === 0n
      ? 'notFound'
      : requestStatus(state.pending, state.claimable);
  return {
    vault: { chainId: chain.chainId, address: vault, name: state.name },
    status,
    assets: usdcAmount(chain, state.pending + state.claimable),
    pending: usdcAmount(chain, state.pending),
    claimable: usdcAmount(chain, state.claimable),
    next: NEXT[status],
  };
}

export async function depositStatus(input: DepositStatusInput): Promise<DepositStatusOutput> {
  const account = getAddress(input.account);
  const chainIds = new Set([
    ...(input.txHashes ?? []).map((t) => t.chainId),
    ...(input.vaults ?? []).map((v) => v.chainId),
  ]);

  const output: DepositStatusOutput = { stateAt: [], deposits: [] };
  for (const chainId of chainIds) {
    const chain = DEPOSIT_CHAINS[chainId];
    const client = chain && clientFor(chain);
    if (!chain || !client)
      throw new Error(`Chain ${chainId} is not supported (no config or no RPC)`);

    const block = await client.getBlock({ blockTag: 'latest' });
    output.stateAt.push({
      chainId,
      blockNumber: block.number.toString(),
      timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    });

    for (const tx of (input.txHashes ?? []).filter((t) => t.chainId === chainId)) {
      output.deposits.push(
        ...(await fromTxHash(client, chain, account, tx.hash as Hex, block.number))
      );
    }
    // A vault already followed through a transaction hash is not listed again
    const tracked = new Set(
      output.deposits
        .filter((d) => d.vault.chainId === chainId)
        .map((d) => d.vault.address.toLowerCase())
    );
    const vaults = (input.vaults ?? []).filter(
      (v) => v.chainId === chainId && !tracked.has(v.address.toLowerCase())
    );
    for (const vault of vaults) {
      output.deposits.push(
        await latestRequest(client, chain, account, getAddress(vault.address), block.number)
      );
    }
  }
  return output;
}
