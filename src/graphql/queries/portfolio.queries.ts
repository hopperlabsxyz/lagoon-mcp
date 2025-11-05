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
 * GraphQL query for portfolio optimization data
 *
 * Fetches vault data with historical price and performance metrics
 * for portfolio optimization calculations.
 *
 * Used by: optimize_portfolio tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<PortfolioOptimizationResponse>(
 *   PORTFOLIO_OPTIMIZATION_QUERY,
 *   {
 *     vaultAddresses: ['0x...', '0x...'],
 *     chainId: 1,
 *     timestamp_gte: '1234567890'
 *   }
 * );
 * ```
 */
export const PORTFOLIO_OPTIMIZATION_QUERY = `
  query PortfolioOptimization($vaultAddresses: [Address!]!, $chainId: Int!, $timestamp_gte: BigInt!) {
    vaults(where: { address_in: $vaultAddresses, chainId: $chainId }) {
      items {
        ...VaultFragment
      }
    }

    # Get price history for volatility calculation
    priceHistory: transactions(
      where: {
        vault_in: $vaultAddresses,
        timestamp_gte: $timestamp_gte,
        type: "TotalAssetsUpdated"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        vault
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
        timestamp_gte: $timestamp_gte,
        type: "PeriodSummary"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        vault
        timestamp
        data {
          ... on PeriodSummary {
            apy
          }
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;
