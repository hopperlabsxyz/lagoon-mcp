/**
 * Vault List Fragment
 *
 * Minimal vault information for efficient list displays.
 * Use in search results and large dataset queries to minimize token usage.
 *
 * Token efficiency: ~60 tokens per vault (90% reduction from full fragment)
 *
 * APR Strategy: Includes both liveAPR and monthlyApr since vaults use different
 * tracking methods. Claude will use whichever field is populated.
 */

/**
 * Minimal vault data type matching the vault list fragment
 */
export interface VaultListData {
  address: string;
  symbol: string | null;
  name: string | null;
  chain: {
    id: number;
    name: string;
  };
  state: {
    totalAssetsUsd: number;
    liveAPR: {
      netApr: number;
    } | null;
    monthlyApr: {
      linearNetApr: number;
    };
  };
}

/**
 * GraphQL fragment for minimal vault data
 *
 * Includes only essential fields for list displays:
 * - Core identification (address, symbol, name)
 * - Chain context (id, name)
 * - TVL (totalAssetsUsd)
 * - APR data (liveAPR or monthlyApr, whichever is available)
 *
 * Usage:
 * ```graphql
 * query SearchVaults {
 *   vaults {
 *     ...VaultListFragment
 *   }
 * }
 * ${VAULT_LIST_FRAGMENT}
 * ```
 */
export const VAULT_LIST_FRAGMENT = `
  fragment VaultListFragment on Vault {
    address
    symbol
    name
    chain {
      id
      name
    }
    state {
      totalAssetsUsd
      liveAPR {
        netApr
      }
      monthlyApr {
        linearNetApr
      }
    }
  }
`;
