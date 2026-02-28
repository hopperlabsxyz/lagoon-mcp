/**
 * Vault List Fragment
 *
 * Minimal vault information for efficient list displays.
 * Use in search results and large dataset queries to minimize token usage.
 *
 * Token efficiency: ~70 tokens per vault (88% reduction from full fragment)
 *
 * APR Strategy: Includes liveAPR, monthlyApr, and inceptionApr (linearNetApr only).
 * Inception APR uses inline field (not full APRBreakdownFragment) to keep token cost low.
 * Professional users need track record data even in list views.
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
    inceptionApr: {
      linearNetApr: number;
    } | null;
  };
}

/**
 * GraphQL fragment for minimal vault data
 *
 * Includes only essential fields for list displays:
 * - Core identification (address, symbol, name)
 * - Chain context (id, name)
 * - TVL (totalAssetsUsd)
 * - APR data (liveAPR, monthlyApr, inceptionApr linearNetApr)
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
      inceptionApr {
        linearNetApr
      }
    }
  }
`;
