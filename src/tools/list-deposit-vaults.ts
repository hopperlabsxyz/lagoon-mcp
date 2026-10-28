/**
 * list_deposit_vaults Tool
 *
 * The vaults `prepare_deposit` accepts: open Lagoon v0.6.0 vaults whose asset
 * is Circle USDC, on the chains deposit plans support. Includes vaults hidden
 * from the app's list (`listed: false`). Use it to pick vaults for a deposit.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEPOSIT_CHAINS, SUPPORTED_VAULT_VERSION } from '../deposit/config.js';
import type { ListDepositVaultsInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';

const QUERY = `
  query ListDepositVaults($first: Int!, $where: VaultFilterInput) {
    vaults(first: $first, where: $where) {
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
        v.state.version === SUPPORTED_VAULT_VERSION &&
        v.asset.address.toLowerCase() === chain.usdc.toLowerCase()
      );
    })
    .filter((v) => input.includeUnlisted !== false || v.isVisible)
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
    const data = await container.graphqlClient.request<{ vaults: { items: VaultItem[] } }>(QUERY, {
      first: 1000,
      where: { chainId_in: chainIds, state_in: ['Open'] },
    });
    const vaults = selectDepositVaults(data.vaults.items, input);
    const output = { count: vaults.length, vaults };
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output as unknown as Record<string, unknown>,
      isError: false,
    };
  };
}
