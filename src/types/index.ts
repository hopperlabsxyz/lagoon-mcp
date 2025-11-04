/**
 * Type exports for Lagoon MCP server
 *
 * Re-exports commonly used types from generated GraphQL types
 * and defines additional types for tool implementations
 */

// Re-export generated types
export type {
  Transaction,
  TransactionData,
  TransactionFilterInput,
  TransactionOrderBy,
  TransactionPage,
  TransactionType,
} from './generated.js';

// Re-export validator input types
export type {
  QueryGraphQLInput,
  GetVaultDataInput,
  GetUserPortfolioInput,
  SearchVaultsInput,
  GetVaultPerformanceInput,
  GetTransactionsInput,
} from '../utils/validators.js';
