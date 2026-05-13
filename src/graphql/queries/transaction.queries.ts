/**
 * Transaction Queries
 *
 * GraphQL queries for transaction data operations.
 * Includes transaction history and price history queries.
 */

import { TRANSACTION_BASE_FRAGMENT, PAGEINFO_FULL_FRAGMENT } from '../fragments/index.js';

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
 * Aliases: AccessModeUpdated.newMode and SyncModeUpdated.newMode return
 * different enum types (AccessMode! vs SyncMode!) — they're aliased to
 * `newAccessMode` and `newSyncMode`/`oldSyncMode` so both can appear in the
 * same selection set without a GraphQL field-conflict error.
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
            vault {
              id
              address
              symbol
            }
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
            vault {
              id
              address
              symbol
            }
          }
          ... on DepositRequest {
            controller
            owner
            requestId
            sender
            assets
            assetsUsd
            vault {
              id
              address
              symbol
            }
          }
          ... on RedeemRequest {
            controller
            owner
            requestId
            sender
            shares
            sharesUsd
            vault {
              id
              address
              symbol
            }
          }
          ... on NewTotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            vault {
              id
              address
              symbol
            }
          }
          ... on TotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            vault {
              id
              address
              symbol
            }
          }
          ... on PeriodSummary {
            duration
            netTotalSupplyAtEnd
            totalAssetsAtEnd
            totalAssetsAtStart
            totalSupplyAtEnd
            totalSupplyAtStart
            vault {
              id
              address
              symbol
            }
          }
          ... on DepositSync {
            owner
            sender
            shares
            assets
            assetsUsd
            vault {
              id
              address
              symbol
            }
          }
          ... on DepositRequestCanceled {
            controller
            requestId
            vault {
              id
              address
              symbol
            }
          }
          ... on RatesUpdated {
            newRates {
              performanceRate
              managementRate
              entryRate
              exitRate
              haircutRate
            }
            vault {
              id
              address
              symbol
            }
          }
          ... on StateUpdated {
            state
            vault {
              id
              address
              symbol
            }
          }
          ... on Deposit {
            owner
            sender
            assets
            shares
            vault {
              id
              address
              symbol
            }
          }
          ... on Withdraw {
            owner
            sender
            receiver
            assets
            shares
            vault {
              id
              address
              symbol
            }
          }
          ... on WithdrawSync {
            owner
            sender
            receiver
            assets
            shares
            vault {
              id
              address
              symbol
            }
          }
          ... on RedeemRequestCanceled {
            controller
            requestId
            requestedAmount
            vault {
              id
              address
              symbol
            }
          }
          ... on FeeTaken {
            feeType
            shares
            managerShares
            protocolShares
            rate
            contextId
            vault {
              id
              address
              symbol
            }
          }
          ... on HaircutTaken {
            owner
            shares
            rate
            vault {
              id
              address
              symbol
            }
          }
          ... on PreMint {
            sender
            receiver
            assets
            shares
            vault {
              id
              address
              symbol
            }
          }
          ... on AccessModeUpdated {
            newAccessMode: newMode
            vault {
              id
              address
              symbol
            }
          }
          ... on AsyncOnlyActivated {
            vault {
              id
              address
              symbol
            }
          }
          ... on NameUpdated {
            previousName
            newName
            vault {
              id
              address
              symbol
            }
          }
          ... on SymbolUpdated {
            previousSymbol
            newSymbol
            vault {
              id
              address
              symbol
            }
          }
          ... on MaxCapUpdated {
            previousMaxCap
            maxCap
            vault {
              id
              address
              symbol
            }
          }
          ... on SyncModeUpdated {
            oldSyncMode: oldMode
            newSyncMode: newMode
            vault {
              id
              address
              symbol
            }
          }
          ... on SafeUpdated {
            oldSafe
            newSafe
            vault {
              id
              address
              symbol
            }
          }
          ... on SecurityCouncilUpdated {
            oldSecurityCouncil
            newSecurityCouncil
            vault {
              id
              address
              symbol
            }
          }
          ... on SuperOperatorUpdated {
            oldSuperOperator
            newSuperOperator
            vault {
              id
              address
              symbol
            }
          }
          ... on TotalAssetsExpirationUpdated {
            oldExpiration
            newExpiration
            vault {
              id
              address
              symbol
            }
          }
          ... on ProxyDeployed {
            deployer
            factoryAddress
            proxy
            vault {
              id
              address
              symbol
            }
          }
          ... on BlacklistUpdated {
            account
            blacklisted
            vault {
              id
              address
              symbol
            }
          }
          ... on WhitelistUpdated {
            account
            authorized
            vault {
              id
              address
              symbol
            }
          }
          ... on ExternalSanctionsListUpdated {
            oldExternalSanctionList
            newExternalSanctionList
            vault {
              id
              address
              symbol
            }
          }
          ... on GuardrailsUpdated {
            oldLowerRate
            newLowerRate
            oldUpperRate
            newUpperRate
            vault {
              id
              address
              symbol
            }
          }
          ... on GuardrailsStatusUpdated {
            activated
            vault {
              id
              address
              symbol
            }
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
