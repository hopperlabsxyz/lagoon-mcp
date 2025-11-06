/**
 * Portfolio Queries
 *
 * GraphQL queries for user portfolio operations.
 * Includes user portfolio data and portfolio optimization queries.
 */

import { VAULT_FRAGMENT } from '../fragments/index.js';

/**
 * User portfolio GraphQL query for all chains
 *
 * Fetches complete user portfolio with vault positions and metadata.
 * Includes all vault data via VaultFragment for comprehensive analysis.
 *
 * Used by: get_user_portfolio tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<UserPortfolioResponse>(
 *   GET_USER_PORTFOLIO_QUERY,
 *   { where: { user_eq: '0x...' } }
 * );
 * ```
 */
export const GET_USER_PORTFOLIO_QUERY = `
  query GetUserPortfolio($where: UserFilterInput) {
    users(where: $where) {
      items {
        state {
          totalSharesUsd
        }
        vaultPositions {
          vault {
            ...VaultFragment
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
  ${VAULT_FRAGMENT}
`;

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
        vault_in: [$vaultAddress],
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
