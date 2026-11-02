/**
 * list_deposit_vaults Tool
 *
 * The vaults `prepare_deposit` accepts: open Lagoon vaults (v0.1 to v0.6)
 * whose asset is Circle USDC, on the chains deposit plans support. Vaults
 * hidden from the app (`listed: false`) only on request, except on Arc
 * (testnet), which only has test vaults. Use it to pick vaults for a deposit.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEPOSIT_CHAINS, vaultFamily } from '../deposit/config.js';
import type { ListDepositVaultsInput } from '../utils/validators.js';
import { createStructuredResponse } from '../utils/tool-response.js';
import { ServiceContainer } from '../core/container.js';

const PAGE = 1000;
/** A bound on the pages read, far above today's ~1,100 open vaults */
const MAX_VAULTS = 20_000;

const QUERY = `
  query ListDepositVaults($first: Int!, $skip: Int!, $where: VaultFilterInput) {
    vaults(first: $first, skip: $skip, where: $where) {
      items {
        address
        name
        symbol
        isVisible
        chain { id }
        asset { address }
        curators { name }
        state { version totalAssetsUsd }
      }
    }
  }
`;

interface VaultItem {
  address: string;
  name: string;
  symbol: string;
  isVisible: boolean;
  chain: { id: string };
  asset: { address: string };
  curators: Array<{ name: string }>;
  state: { version: string | null; totalAssetsUsd: number | null };
}

export interface DepositVault {
  chainId: number;
  chain: string;
  address: string;
  name: string;
  symbol: string;
  curators: string[];
  tvlUsd: number;
  /** false: hidden from the app's vault list (e.g. a test vault) */
  listed: boolean;
}

/** Networks whose hidden vaults are listed by default: Arc only has test vaults */
const UNLISTED_BY_DEFAULT = new Set([5042]);

const includeUnlisted = (input: ListDepositVaultsInput, chainId: number): boolean =>
  input.includeUnlisted ?? UNLISTED_BY_DEFAULT.has(chainId);

/** Keeps the vaults prepare_deposit accepts, matching the optional filters (pure) */
export function selectDepositVaults(
  items: VaultItem[],
  input: ListDepositVaultsInput
): DepositVault[] {
  const words = (input.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .filter((v) => {
      const chain = DEPOSIT_CHAINS[Number(v.chain.id)];
      return (
        chain !== undefined &&
        vaultFamily(v.state.version ?? undefined) !== undefined &&
        v.asset.address.toLowerCase() === chain.usdc.toLowerCase()
      );
    })
    .filter((v) => v.isVisible || includeUnlisted(input, Number(v.chain.id)))
    .map((v) => ({
      chainId: Number(v.chain.id),
      chain: DEPOSIT_CHAINS[Number(v.chain.id)].name,
      address: v.address,
      name: v.name,
      symbol: v.symbol,
      curators: v.curators.map((c) => c.name),
      tvlUsd: Math.round(v.state.totalAssetsUsd ?? 0),
      listed: v.isVisible,
    }))
    .filter((v) => {
      const text = `${v.name} ${v.symbol} ${v.curators.join(' ')}`.toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => Number(b.listed) - Number(a.listed) || b.tvlUsd - a.tvlUsd)
    .slice(0, input.limit ?? 20);
}

export function createExecuteListDepositVaults(
  container: ServiceContainer
): (input: ListDepositVaultsInput) => Promise<CallToolResult> {
  return async (input) => {
    const chainIds =
      input.chainId !== undefined ? [input.chainId] : Object.keys(DEPOSIT_CHAINS).map(Number);
    // Every page: there are more than 1000 open vaults across the chains
    const items: VaultItem[] = [];
    for (let skip = 0; ; skip += PAGE) {
      const data = await container.graphqlClient.request<{ vaults: { items: VaultItem[] } }>(
        QUERY,
        {
          first: PAGE,
          skip,
          where: { chainId_in: chainIds, state_in: ['Open'] },
        }
      );
      items.push(...data.vaults.items);
      if (data.vaults.items.length < PAGE || skip >= MAX_VAULTS) break;
    }
    const vaults = selectDepositVaults(items, input);
    return createStructuredResponse({ count: vaults.length, vaults });
  };
}
