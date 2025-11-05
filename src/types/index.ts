/**
 * Type exports for Lagoon MCP server
 *
 * Re-exports commonly used types from generated GraphQL types
 * and defines additional types for tool implementations
 */

/**
 * GraphQL Generated Types
 *
 * These types are generated from the Lagoon GraphQL schema introspection.
 * They provide type safety for working with transaction data from the API.
 */
export type {
  /** Transaction entity from the GraphQL schema */
  Transaction,
  /** Union type for transaction-specific data fields */
  TransactionData,
  /** Filter criteria for querying transactions */
  TransactionFilterInput,
  /** Available fields for ordering transaction results */
  TransactionOrderBy,
  /** Paginated transaction response with items and metadata */
  TransactionPage,
  /** Enum of all transaction types (SettleDeposit, SettleRedeem, etc.) */
  TransactionType,
} from './generated.js';

/**
 * Tool Input Validation Types
 *
 * These types are inferred from Zod validation schemas and represent
 * the validated input parameters for each MCP tool. They ensure type
 * safety between tool registration and implementation.
 */
export type {
  /** Input parameters for raw GraphQL query execution */
  QueryGraphQLInput,
  /** Input parameters for fetching detailed vault data */
  GetVaultDataInput,
  /** Input parameters for fetching user portfolio positions */
  GetUserPortfolioInput,
  /** Input parameters for searching and filtering vaults */
  SearchVaultsInput,
  /** Input parameters for analyzing vault performance over time */
  GetVaultPerformanceInput,
  /** Input parameters for querying vault transaction history */
  GetTransactionsInput,
} from '../utils/validators.js';
