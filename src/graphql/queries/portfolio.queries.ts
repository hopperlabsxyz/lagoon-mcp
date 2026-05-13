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
 * Aliases: `state.sharesUsd: usd` — backend deprecated
 * `VaultPositionState.sharesUsd` (schema.gql:2466) in favor of `usd`. The alias
 * keeps the downstream TS field name stable while reading the canonical field.
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
              sharesUsd: usd
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
  query SingleVaultOptimization(
    $vaultAddress: Address!,
    $chainId: Int!,
    $options: TimeRangeOptions
  ) {
    vault: vaultByAddress(address: $vaultAddress, chainId: $chainId) {
      ...VaultFragment
      stateHistory {
        pricePerShareUsd(options: $options) {
          x
          y
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for single vault composition data
 *
 * Fetches cross-chain composition data for a vault from Octav API.
 * Returns a JSONObject with chain keys containing composition metrics.
 *
 * Note: Backend API changed - now uses `walletAddress` parameter and returns
 * JSONObject type (no fragment needed). Response contains chains as keys with
 * value, chainId, name, etc.
 *
 * Used by: get_user_portfolio tool (for composition aggregation)
 *         compare_vaults tool (for diversification analysis)
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaultComposition: RawVaultComposition | null }>(
 *   SINGLE_VAULT_COMPOSITION_QUERY,
 *   { walletAddress: '0x...' }
 * );
 * ```
 */
export const SINGLE_VAULT_COMPOSITION_QUERY = `
  query SingleVaultComposition($walletAddress: Address!) {
    vaultComposition(walletAddress: $walletAddress)
  }
`;
