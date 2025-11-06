/**
 * Transaction Queries
 *
 * GraphQL queries for transaction data operations.
 * Includes transaction history and price history queries.
 */

import {
  TRANSACTION_BASE_FRAGMENT,
  PAGEINFO_FULL_FRAGMENT,
  PAGEINFO_MINIMAL_FRAGMENT,
} from '../fragments/index.js';

/**
 * GraphQL query for fetching vault transactions with all union type variants
 *
 * Fetches comprehensive transaction history with support for all transaction types:
 * - SettleDeposit, SettleRedeem
 * - DepositRequest, RedeemRequest
 * - NewTotalAssetsUpdated, TotalAssetsUpdated
 * - PeriodSummary
 * - DepositSync
 * - DepositRequestCanceled
 *
 * Used by: get_transactions tool
 *
 * Usage:
 * ```typescript
 * const response = await graphqlClient.request<TransactionsResponse>(
 *   TRANSACTIONS_QUERY,
 *   {
 *     first: 100,
 *     skip: 0,
 *     where: { chainId_eq: 1, vault_in: ['0x...'] },
 *     orderBy: 'blockNumber',
 *     orderDirection: 'desc'
 *   }
 * );
 * ```
 */
export const TRANSACTIONS_QUERY = `
  query GetTransactions(
    $first: Int!
    $skip: Int!
    $where: TransactionFilterInput
    $orderBy: TransactionOrderBy!
    $orderDirection: OrderDirection
  ) {
    transactions(
      first: $first
      skip: $skip
      where: $where
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...TransactionBaseFragment
        data {
          ... on SettleDeposit {
            epochId
            settledId
            totalAssets
            totalAssetsUsd
            totalSupply
            assetsDeposited
            assetsDepositedUsd
            sharesMinted
          }
          ... on SettleRedeem {
            epochId
            settledId
            totalAssets
            totalAssetsUsd
            totalSupply
            assetsWithdrawed
            assetsWithdrawedUsd
            sharesBurned
          }
          ... on DepositRequest {
            controller
            owner
            requestId
            sender
            assets
            assetsUsd
          }
          ... on RedeemRequest {
            controller
            owner
            requestId
            sender
            shares
            sharesUsd
          }
          ... on NewTotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            totalSupply
          }
          ... on TotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            totalSupply
          }
          ... on PeriodSummary {
            duration
            netTotalSupplyAtEnd
            totalAssetsAtEnd
            totalAssetsAtStart
            totalSupplyAtEnd
            totalSupplyAtStart
          }
          ... on DepositSync {
            owner
            sender
            shares
            assets
            assetsUsd
          }
          ... on DepositRequestCanceled {
            controller
            requestId
          }
          ... on RatesUpdated {
            newRates {
              performanceRate
              managementRate
            }
          }
          ... on StateUpdated {
            state
          }
        }
      }
      pageInfo {
        ...PageInfoFullFragment
      }
    }
  }
  ${TRANSACTION_BASE_FRAGMENT}
  ${PAGEINFO_FULL_FRAGMENT}
`;

/**
 * GraphQL query for historical price data
 *
 * Fetches TotalAssetsUpdated transactions to build price history time-series.
 * Provides OHLCV (Open, High, Low, Close, Volume) data for price analysis.
 *
 * Used by: get_price_history tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<PriceHistoryResponse>(
 *   PRICE_HISTORY_QUERY,
 *   {
 *     vault_in: ['0x...'],
 *     timestamp_gte: '1234567890',
 *     first: 2000
 *   }
 * );
 * ```
 */
export const PRICE_HISTORY_QUERY = `
  query GetPriceHistory(
    $vault_in: [Address!]!,
    $first: Int!
  ) {
    transactions(
      where: {
        vault_in: $vault_in,
        type_in: ["TotalAssetsUpdated"]
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        ...TransactionBaseFragment
        data {
          ... on TotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            pricePerShare
            pricePerShareUsd
          }
        }
      }
      pageInfo {
        ...PageInfoMinimalFragment
      }
    }
  }
  ${TRANSACTION_BASE_FRAGMENT}
  ${PAGEINFO_MINIMAL_FRAGMENT}
`;
