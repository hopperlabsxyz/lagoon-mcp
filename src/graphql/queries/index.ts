/**
 * GraphQL Queries Index
 *
 * Central export point for all GraphQL queries.
 * Import from this file for convenience: `import { GET_VAULT_DATA_QUERY } from '../graphql/queries'`
 */

// Vault Queries
export {
  GET_VAULT_DATA_QUERY,
  GET_VAULT_FOR_APR_QUERY,
  COMPARE_VAULTS_QUERY,
} from './vault.queries.js';

// Transaction Queries
export { TRANSACTIONS_QUERY, PRICE_HISTORY_QUERY } from './transaction.queries.js';

// Performance Queries
export { GET_VAULT_PERFORMANCE_QUERY, GET_PERIOD_SUMMARIES_QUERY } from './performance.queries.js';

// Portfolio Queries
export {
  GET_USER_PORTFOLIO_QUERY,
  createGetUserPortfolioQuery,
  type PortfolioResponseFormat,
  SINGLE_VAULT_OPTIMIZATION_QUERY,
  PORTFOLIO_OPTIMIZATION_QUERY,
} from './portfolio.queries.js';

// Risk Queries
export { RISK_ANALYSIS_QUERY } from './risk.queries.js';

// Prediction Queries
export {
  YIELD_PREDICTION_QUERY,
  createYieldPredictionQuery,
  type PredictionResponseFormat,
} from './prediction.queries.js';

// Export Queries
export {
  EXPORT_VAULTS_QUERY,
  EXPORT_TRANSACTIONS_QUERY,
  EXPORT_PRICE_HISTORY_QUERY,
  EXPORT_PERFORMANCE_QUERY,
} from './export.queries.js';

// Search Queries
export {
  SEARCH_VAULTS_QUERY,
  createSearchVaultsQuery,
  type SearchVaultsResponseFormat,
} from './search.queries.js';

// Composition Queries
export { GET_VAULT_COMPOSITION_QUERY } from './composition.queries.js';
