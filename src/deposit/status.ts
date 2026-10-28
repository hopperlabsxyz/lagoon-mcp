/**
 * deposit_status: where each deposit stands, from its transaction hash
 * (preferred) or from the account's latest request in a vault.
 */

import { getAddress, parseEventLogs, type Address, type Hex, type PublicClient } from 'viem';
import { toAmount } from './amounts.js';
import { clientFor } from './chain.js';
import { vaultAbi } from './abi.js';
import { DEPOSIT_CHAINS, type DepositChainConfig } from './config.js';
import type { DepositStatus, DepositStatusOutput } from './types.js';
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

/** Whether the request was canceled after it was made (DepositRequestCanceled) */
async function wasCanceled(
  client: PublicClient,
  vault: Address,
  controller: Address,
  requestId: bigint,
  fromBlock: bigint,
  toBlock: bigint
): Promise<boolean> {
  try {
    const logs = await client.getContractEvents({
      address: vault,
      abi: vaultAbi,
      eventName: 'DepositRequestCanceled',
      args: { requestId, controller },
      fromBlock,
      toBlock,
    });
    return logs.length > 0;
  } catch {
    // Providers cap log ranges; without the answer, keep what the vault reports
    return false;
  }
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
  const amount = (raw: bigint) => toAmount(raw, chain.usdcDecimals, 'USDC');
  const zero = amount(0n);
  const without = (status: DepositStatus, address: Address): Deposit => ({
    vault: { chainId: chain.chainId, address, name: 'unknown' },
    txHash: hash,
    status,
    assets: zero,
    pending: zero,
    claimable: zero,
  });

  const receipt = await client.getTransactionReceipt({ hash }).catch(() => undefined);
  if (!receipt) return [without('notFound', account)];
  if (receipt.status === 'reverted') return [without('failed', getAddress(receipt.to ?? account))];

  const mine = (owner: Address | undefined) => owner?.toLowerCase() === account.toLowerCase();
  const events = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, strict: false }).filter(
    (l) => (l.eventName === 'DepositSync' || l.eventName === 'DepositRequest') && mine(l.args.owner)
  );
  if (events.length === 0) return [without('notFound', getAddress(receipt.to ?? account))];

  return Promise.all(
    events.map(async (event): Promise<Deposit> => {
      const vault = getAddress(event.address);
      if (event.eventName === 'DepositSync') {
        const name = await client.readContract({
          address: vault,
          abi: vaultAbi,
          functionName: 'name',
          blockNumber,
        });
        return {
          vault: { chainId: chain.chainId, address: vault, name },
          txHash: hash,
          status: 'synced',
          assets: amount(event.args.assets ?? 0n),
          pending: zero,
          claimable: zero,
        };
      }
      if (event.eventName !== 'DepositRequest' || event.args.requestId === undefined) {
        return without('notFound', vault);
      }
      const requestId = event.args.requestId;
      const state = await readRequest(client, vault, account, requestId, blockNumber);
      let status = requestStatus(state.pending, state.claimable);
      // A canceled request also reads 0 pending / 0 claimable: tell it apart by its event
      if (
        status === 'claimed' &&
        (await wasCanceled(client, vault, account, requestId, receipt.blockNumber, blockNumber))
      ) {
        status = 'canceled';
      }
      return {
        vault: { chainId: chain.chainId, address: vault, name: state.name },
        txHash: hash,
        requestId: requestId.toString(),
        status,
        assets: amount(event.args.assets ?? 0n),
        pending: amount(state.pending),
        claimable: amount(state.claimable),
        next: NEXT[status],
      };
    })
  );
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
    for (const vault of (input.vaults ?? []).filter(
      (v) => v.chainId === chainId && !tracked.has(v.address.toLowerCase())
    )) {
      // requestId 0 = the account's latest request in this vault
      const address = getAddress(vault.address);
      const state = await readRequest(client, address, account, 0n, block.number);
      const status =
        state.pending === 0n && state.claimable === 0n
          ? 'notFound'
          : requestStatus(state.pending, state.claimable);
      const amount = (raw: bigint) => toAmount(raw, chain.usdcDecimals, 'USDC');
      output.deposits.push({
        vault: { chainId, address, name: state.name },
        status,
        assets: amount(state.pending + state.claimable),
        pending: amount(state.pending),
        claimable: amount(state.claimable),
        next: NEXT[status],
      });
    }
  }
  return output;
}
