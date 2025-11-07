/**
 * Transaction Base Fragment
 *
 * Reusable fragment for common transaction fields across all transaction types.
 * Provides core transaction metadata and relationships.
 */

/**
 * GraphQL fragment for transaction base fields
 *
 * Usage:
 * ```graphql
 * transactions {
 *   ...TransactionBaseFragment
 *   ... additional type-specific fields
 * }
 * ```
 */
export const TRANSACTION_BASE_FRAGMENT = `
  fragment TransactionBaseFragment on Transaction {
    id
    type
    timestamp
    blockNumber
    hash
    logIndex
    chain {
      id
      name
    }
    vault {
      id
      address
      symbol
    }
  }
`;
