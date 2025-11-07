/**
 * Portfolio Queries
 *
 * GraphQL queries for user portfolio operations.
 * Includes user portfolio data and portfolio optimization queries.
 */

import { VAULT_FRAGMENT, VAULT_LIST_FRAGMENT, VAULT_SUMMARY_FRAGMENT } from '../fragments/index.js';

/**
 * Response format type for user portfolio query
 */
export type PortfolioResponseFormat = 'list' | 'summary' | 'full';

/**
 * Get fragment and fragment name based on response format for portfolio queries
 */
function getFragmentForPortfolioResponseFormat(responseFormat: PortfolioResponseFormat): {
  fragment: string;
  fragmentName: string;
} {
  switch (responseFormat) {
    case 'list':
      return { fragment: VAULT_LIST_FRAGMENT, fragmentName: 'VaultListFragment' };
    case 'summary':
      return { fragment: VAULT_SUMMARY_FRAGMENT, fragmentName: 'VaultSummaryFragment' };
    case 'full':
      return { fragment: VAULT_FRAGMENT, fragmentName: 'VaultFragment' };
    default:
      return { fragment: VAULT_SUMMARY_FRAGMENT, fragmentName: 'VaultSummaryFragment' };
  }
}

/**
 * Create user portfolio GraphQL query with dynamic fragment selection
 *
 * Fetches complete user portfolio with vault positions and metadata.
 * Fragment selection optimizes token usage based on required detail level.
 *
 * Used by: get_user_portfolio tool
 *
 * @param responseFormat - Detail level: 'list' (~60 tokens/vault), 'summary' (~170 tokens/vault), 'full' (~600 tokens/vault)
 * @returns GraphQL query string with appropriate fragment
 *
 * Usage:
 * ```typescript
 * const query = createGetUserPortfolioQuery('summary'); // Balanced data
 * const data = await graphqlClient.request<UserPortfolioResponse>(
 *   query,
 *   { where: { user_eq: '0x...' } }
 * );
 * ```
 *
 * Token optimization:
 * - list: ~60 tokens/position (minimal vault data)
 * - summary: ~170 tokens/position (balanced - includes curators, descriptions)
 * - full: ~600 tokens/position (complete vault data)
 *
 * For a user with 10 positions:
 * - list: 600 tokens (90% reduction)
 * - summary: 1,700 tokens (72% reduction)
 * - full: 6,000 tokens (current behavior)
 */
export function createGetUserPortfolioQuery(
  responseFormat: PortfolioResponseFormat = 'summary'
): string {
  const { fragment, fragmentName } = getFragmentForPortfolioResponseFormat(responseFormat);

  return `
    query GetUserPortfolio($where: UserFilterInput) {
      users(where: $where) {
        items {
          state {
            totalSharesUsd
          }
          vaultPositions {
            vault {
              ...${fragmentName}
            }
            state {
              assets
              shares
              sharesUsd
            }
          }
        }
      }
    }
    ${fragment}
  `;
}

/**
 * User portfolio GraphQL query (legacy - uses full fragment)
 *
 * @deprecated Use createGetUserPortfolioQuery('full') instead for explicit fragment selection
 *
 * This maintains backward compatibility for existing code.
 * Consider migrating to createGetUserPortfolioQuery() for better token efficiency.
 */
export const GET_USER_PORTFOLIO_QUERY = createGetUserPortfolioQuery('full');

/**
 * GraphQL query for single vault optimization data
 *
 * Fetches one vault with its historical price and performance metrics
 * for portfolio optimization calculations. Used in parallel queries.
 *
 * Used by: optimize_portfolio tool (per-vault queries)
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<SingleVaultOptimizationResponse>(
 *   SINGLE_VAULT_OPTIMIZATION_QUERY,
 *   { vaultAddress: '0x...', chainId: 1 }
 * );
 * ```
 */
export const SINGLE_VAULT_OPTIMIZATION_QUERY = `
  query SingleVaultOptimization($vaultAddress: Address!, $chainId: Int!) {
    vault: vaultByAddress(address: $vaultAddress, chainId: $chainId) {
      ...VaultFragment
    }

    # Get price history for volatility calculation
    priceHistory: transactions(
      where: {
        vault_in: [$vaultAddress],
        type_in: [TotalAssetsUpdated]
      },
      orderBy: timestamp,
      orderDirection: asc,
      first: 1000
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
            totalSupply
          }
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for portfolio optimization data (DEPRECATED)
 *
 * This query is deprecated in favor of SINGLE_VAULT_OPTIMIZATION_QUERY
 * executed in parallel for each vault. Multi-vault queries cannot
 * distinguish which transactions belong to which vault.
 *
 * @deprecated Use SINGLE_VAULT_OPTIMIZATION_QUERY with Promise.all instead
 */
export const PORTFOLIO_OPTIMIZATION_QUERY = `
  query PortfolioOptimization($vaultAddresses: [Address!]!, $chainId: Int!) {
    vaults(where: { address_in: $vaultAddresses, chainId_eq: $chainId }) {
      items {
        ...VaultFragment
      }
    }

    # Get price history for volatility calculation
    priceHistory: transactions(
      where: {
        vault_in: $vaultAddresses,
        type_in: ["TotalAssetsUpdated"]
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            pricePerShareUsd
          }
        }
      }
    }

    # Get APY data for return estimation
    performanceData: transactions(
      where: {
        vault_in: $vaultAddresses,
        type_in: ["PeriodSummary"]
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        timestamp
        data {
          ... on PeriodSummary {
            linearNetApr
          }
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;
