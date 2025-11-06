/**
 * Export Queries
 *
 * GraphQL queries for data export operations.
 * Supports exporting vaults, transactions, price history, and performance metrics.
 */

import { VAULT_FRAGMENT, TRANSACTION_BASE_FRAGMENT } from '../fragments/index.js';

/**
 * GraphQL query for vault data export
 *
 * Fetches complete vault data for CSV or JSON export.
 *
 * Used by: export_data tool (dataType: 'vaults')
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaults: VaultData[] }>(
 *   EXPORT_VAULTS_QUERY,
 *   { addresses: ['0x...', '0x...'], chainId: 1 }
 * );
 * ```
 */
export const EXPORT_VAULTS_QUERY = `
  query ExportVaults($addresses: [String!]!, $chainId: Int!) {
    vaults(where: { address_in: $addresses, chainId_eq: $chainId }) {
      items {
        ...VaultFragment
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for transaction export
 *
 * Fetches transaction data with essential fields for export.
 * Includes deposit, redeem, and request transactions.
 *
 * Used by: export_data tool (dataType: 'transactions')
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<TransactionsExportResponse>(
 *   EXPORT_TRANSACTIONS_QUERY,
 *   { vault_in: ['0x...'], chainId: 1, first: 1000 }
 * );
 * ```
 */
export const EXPORT_TRANSACTIONS_QUERY = `
  query ExportTransactions($vault_in: [Address!]!, $chainId: Int!, $first: Int!) {
    transactions(
      where: { vault_in: $vault_in, chainId_eq: $chainId },
      orderBy: "timestamp",
      orderDirection: "desc",
      first: $first
    ) {
      items {
        ...TransactionBaseFragment
        data {
          ... on SettleDeposit {
            user
            assets
            shares
          }
          ... on SettleRedeem {
            user
            assets
            shares
          }
          ... on DepositRequest {
            user
            assets
          }
          ... on RedeemRequest {
            user
            shares
          }
        }
      }
    }
  }
  ${TRANSACTION_BASE_FRAGMENT}
`;

/**
 * GraphQL query for price history export
 *
 * Fetches historical price data for OHLCV export.
 *
 * Used by: export_data tool (dataType: 'price_history')
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<PriceHistoryExportResponse>(
 *   EXPORT_PRICE_HISTORY_QUERY,
 *   { vault_in: ['0x...'], first: 1000 }
 * );
 * ```
 */
export const EXPORT_PRICE_HISTORY_QUERY = `
  query ExportPriceHistory($vault_in: [Address!]!, $first: Int!) {
    transactions(
      where: { vault_in: $vault_in, type_in: ["TotalAssetsUpdated"] },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            pricePerShareUsd
            totalAssetsUsd
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for performance metrics export
 *
 * Fetches TVL history for performance metric export.
 *
 * Used by: export_data tool (dataType: 'performance')
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<PerformanceExportResponse>(
 *   EXPORT_PERFORMANCE_QUERY,
 *   { vault_in: ['0x...'], first: 1000 }
 * );
 * ```
 */
export const EXPORT_PERFORMANCE_QUERY = `
  query ExportPerformance($vault_in: [Address!]!, $first: Int!) {
    transactions(
      where: { vault_in: $vault_in, type_in: ["TotalAssetsUpdated"] },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        timestamp
        blockNumber
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
          }
        }
      }
    }
  }
`;
