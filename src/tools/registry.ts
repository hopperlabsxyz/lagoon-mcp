/**
 * Unified Tool Registry
 *
 * Single source of truth for all MCP tool definitions.
 * Eliminates duplication between tools/index.ts and server.ts registration.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Tool factory functions
import { createExecuteQueryGraphQL } from './query-graphql.js';
import { createExecuteGetVaultData } from './vault-data.js';
import { createExecuteGetUserPortfolio } from './user-portfolio.js';
import { createExecuteSearchVaults } from './search-vaults.js';
import { createExecuteGetVaultPerformance } from './vault-performance.js';
import { createExecuteGetTransactions } from './get-transactions.js';
import { createExecuteCompareVaults } from './compare-vaults.js';
import { createExecuteGetPriceHistory } from './get-price-history.js';
import { createExecuteExportData } from './export-data.js';
import { createExecuteAnalyzeRisk } from './analyze-risk.js';
import { createExecutePredictYield } from './predict-yield.js';
import { createExecuteOptimizePortfolio } from './optimize-portfolio.js';
import { createExecuteSimulateVault, simulateVaultInputSchema } from './simulate-vault.js';

// Service container
import { ServiceContainer } from '../core/container.js';

// Input schemas
import {
  queryGraphQLInputSchema,
  getVaultDataInputSchema,
  getUserPortfolioInputSchema,
  searchVaultsInputSchema,
  getVaultPerformanceInputSchema,
  getTransactionsInputSchema,
  compareVaultsInputSchema,
  priceHistoryInputSchema,
  exportDataInputSchema,
  analyzeRiskInputSchema,
  predictYieldInputSchema,
  optimizePortfolioInputSchema,
} from '../utils/validators.js';

// Tool utilities
import { createToolHandler } from '../utils/tool-handler.js';

/**
 * Tool definition with type safety
 * Now uses factory functions that accept ServiceContainer
 */
export interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  schema: ZodSchema<TInput>;
  executorFactory: (container: ServiceContainer) => (input: TInput) => Promise<CallToolResult>;
}

/**
 * Complete tool registry
 * Single source of truth for tool metadata and handlers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOL_REGISTRY: ToolDefinition<any>[] = [
  {
    name: 'query_graphql',
    description:
      'Execute raw GraphQL queries against the Lagoon backend. ' +
      'Use for custom queries with specific field selection, large datasets (20+ vaults), ' +
      'or advanced filtering. No caching - results are always fresh. ' +
      'Requires GraphQL query syntax knowledge.',
    schema: queryGraphQLInputSchema,
    executorFactory: createExecuteQueryGraphQL,
  },
  {
    name: 'get_vault_data',
    description:
      'Fetch complete vault information with 15-minute caching. ' +
      'Optimized for detailed analysis of 1-5 vaults. ' +
      'Returns all vault fields including asset info, financial metrics, curator details, and metadata. ' +
      'Best for: small vault sets, repeated queries, comprehensive analysis. ' +
      'Performance: ~500 tokens per vault.',
    schema: getVaultDataInputSchema,
    executorFactory: createExecuteGetVaultData,
  },
  {
    name: 'get_user_portfolio',
    description:
      'Fetch user portfolio with 5-minute caching. ' +
      'Automatically queries all supported chains via the users API. ' +
      'Returns sorted positions by USD value with complete vault data for each position. ' +
      'Best for: multi-chain portfolio analysis, user position tracking, portfolio value aggregation. ' +
      'Performance: ~300-800 tokens per user (varies with position count).',
    schema: getUserPortfolioInputSchema,
    executorFactory: createExecuteGetUserPortfolio,
  },
  {
    name: 'search_vaults',
    description:
      'Search and filter vaults with advanced criteria and 10-minute caching. ' +
      'Supports 20+ filter options including asset, chain, TVL, curator, visibility. ' +
      'Returns paginated results (default 100, max 1000) with sort options. ' +
      'Best for: vault discovery, filtering by criteria, TVL-sorted lists, multi-vault analysis. ' +
      'Performance: ~300-500 tokens per page. ' +
      'Cache key based on filter hash for efficient repeated searches.',
    schema: searchVaultsInputSchema,
    executorFactory: createExecuteSearchVaults,
  },
  {
    name: 'get_vault_performance',
    description:
      'Historical metrics and trend analysis for vaults with 30-minute caching. ' +
      'Aggregates transaction data (TotalAssetsUpdated, PeriodSummary) for time-series analysis. ' +
      'Supports 4 time ranges: 7d, 30d, 90d, 1y. ' +
      'Returns metrics array with timestamps and TVL, plus summary statistics (start/end value, % change, volume). ' +
      'Best for: performance tracking, trend analysis, TVL history, inflection point identification. ' +
      'Performance: ~400-600 tokens per vault per time range. ' +
      'Fetches up to 1000 transactions per query.',
    schema: getVaultPerformanceInputSchema,
    executorFactory: createExecuteGetVaultPerformance,
  },
  {
    name: 'get_transactions',
    description:
      'Query vault transaction history with flexible filtering, pagination, and ordering. ' +
      'Supports all transaction types: deposits (SettleDeposit, DepositRequest, DepositSync), ' +
      'redemptions (SettleRedeem, RedeemRequest, DepositRequestCanceled), ' +
      'state changes (TotalAssetsUpdated, NewTotalAssetsUpdated, PeriodSummary), ' +
      'and configuration updates (RatesUpdated, StateUpdated). ' +
      'Returns detailed transaction data with timestamps, block numbers, hashes, and type-specific fields. ' +
      'Best for: analyzing historical vault activity, tracking user deposits/withdrawals, monitoring state changes, generating transaction reports. ' +
      'Performance: ~400-600 tokens per query (varies with transaction count). ' +
      'Features 15-minute caching and pagination support (default 100, max 1000).',
    schema: getTransactionsInputSchema,
    executorFactory: createExecuteGetTransactions,
  },
  {
    name: 'compare_vaults',
    description:
      'Compare multiple vaults side-by-side with normalized metrics and rankings (2-10 vaults). ' +
      'Provides comprehensive comparison including TVL, APY, overall performance scores, and percentile rankings. ' +
      'Calculates deltas from averages and identifies best/worst performers automatically. ' +
      'Returns formatted comparison table with summary statistics and individual vault rankings. ' +
      'Best for: evaluating investment opportunities, identifying top performers, risk-adjusted return analysis, portfolio construction. ' +
      'Performance: ~300 tokens per vault. ' +
      'Features 15-minute caching based on vault address combinations.',
    schema: compareVaultsInputSchema,
    executorFactory: createExecuteCompareVaults,
  },
  {
    name: 'get_price_history',
    description:
      'Fetch historical price data for vault shares with OHLCV (Open, High, Low, Close, Volume) time-series analysis. ' +
      'Aggregates price data by day for cleaner visualization and provides comprehensive price statistics. ' +
      'Calculates volatility (standard deviation), percent changes, and identifies price trends over time. ' +
      'Returns formatted price history table with daily OHLCV data and statistical summary. ' +
      'Best for: price trend analysis, volatility assessment, historical price point identification, entry/exit decision support. ' +
      'Performance: ~300-500 tokens per vault per time range. ' +
      'Features 30-minute caching for historical data. ' +
      'Time ranges: 7d (7 days), 30d (30 days), 90d (90 days), 1y (1 year), all (complete history).',
    schema: priceHistoryInputSchema,
    executorFactory: createExecuteGetPriceHistory,
  },
  {
    name: 'export_data',
    description:
      'Export vault data, transactions, price history, or performance metrics in CSV or JSON format for external analysis. ' +
      'Supports multiple data types: vaults (vault info with TVL/APY), transactions (deposit/redeem history), ' +
      'price_history (OHLCV time-series), performance (TVL metrics over time). ' +
      'Formats: CSV (RFC 4180 compliant with proper escaping) or JSON (structured objects). ' +
      'Returns formatted data ready for import into spreadsheets, databases, or analytics tools. ' +
      'Best for: spreadsheet analysis, reporting, custom analytics, data integration with external tools, accounting records. ' +
      'Performance: ~200-400 tokens per export depending on data size. ' +
      'No caching (exports generated on-demand with latest data). ' +
      'Up to 1000 records per export.',
    schema: exportDataInputSchema,
    executorFactory: createExecuteExportData,
  },
  {
    name: 'analyze_risk',
    description:
      'Analyze vault risk with multi-factor scoring across TVL, concentration, volatility, age, and curator reputation. ' +
      'Provides comprehensive risk assessment with individual factor breakdowns and overall risk level (Low/Medium/High/Critical). ' +
      'Evaluates: TVL risk (liquidity and market validation), concentration risk (protocol-wide exposure), ' +
      'volatility risk (price stability), age risk (operational track record), curator risk (reputation and experience). ' +
      'Returns detailed risk analysis with scores (0-1 scale), risk levels with emoji indicators, and factor explanations. ' +
      'Best for: investment decision-making, due diligence, portfolio risk monitoring, comparative vault analysis. ' +
      'Performance: ~400-600 tokens per analysis. ' +
      'Features 15-minute caching for risk stability.',
    schema: analyzeRiskInputSchema,
    executorFactory: createExecuteAnalyzeRisk,
  },
  {
    name: 'predict_yield',
    description:
      'Predict vault yield with ML-based forecasting using trend analysis and historical performance. ' +
      'Analyzes APY trends using linear regression, exponential moving averages, and volatility analysis. ' +
      'Provides projected returns for multiple timeframes (7d, 30d, 90d, 1y) with confidence intervals. ' +
      'Returns current APY, predicted APY, trend direction, confidence score, and detailed insights. ' +
      'Best for: investment planning, yield farming optimization, return projections, performance trend analysis. ' +
      'Performance: ~400-600 tokens per prediction. ' +
      'Features 60-minute caching for prediction stability.',
    schema: predictYieldInputSchema,
    executorFactory: createExecutePredictYield,
  },
  {
    name: 'optimize_portfolio',
    description:
      'Optimize portfolio allocation with rebalancing recommendations using multiple strategies. ' +
      'Analyzes current holdings and provides optimal allocation based on selected strategy: ' +
      'equal_weight (maximum diversification), risk_parity (balanced risk contribution), ' +
      'max_sharpe (risk-adjusted returns), min_variance (minimized volatility). ' +
      'Returns target allocations, rebalancing actions, portfolio metrics (expected return, risk, Sharpe ratio, diversification). ' +
      'Calculates exact buy/sell amounts and identifies positions requiring adjustment. ' +
      'Best for: portfolio rebalancing, risk-adjusted allocation, diversification improvement, performance optimization. ' +
      'Performance: ~600-800 tokens per optimization. ' +
      'Features 30-minute caching for optimization stability.',
    schema: optimizePortfolioInputSchema,
    executorFactory: createExecuteOptimizePortfolio,
  },
  {
    name: 'simulate_vault',
    description:
      'Simulate vault behavior with different parameters for scenario analysis and planning. ' +
      'Tests various scenarios including deposit/redemption amounts, fee structures, and yield rates. ' +
      'Provides projected outcomes for investment strategies and risk scenarios. ' +
      'Returns detailed simulation results with before/after comparisons and key metrics. ' +
      'Best for: strategy testing, investment planning, fee impact analysis, "what-if" scenarios. ' +
      'Performance: ~300-500 tokens per simulation. ' +
      'No caching (simulations are scenario-specific).',
    schema: simulateVaultInputSchema,
    executorFactory: createExecuteSimulateVault,
  },
];

/**
 * Register all tools with the MCP server
 * Converts registry entries to MCP tool registrations
 *
 * @param server - MCP server instance
 * @param container - Service container with dependencies (GraphQL client, cache, config)
 */
export function registerTools(server: McpServer, container: ServiceContainer): void {
  for (const tool of TOOL_REGISTRY) {
    // Create executor from factory with injected container
    const executor = tool.executorFactory(container);

    // Create wrapped handler with validation
    const handler = createToolHandler(executor, tool.schema);

    // Convert Zod schema to JSON schema for MCP
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const jsonSchema = zodToJsonSchema(tool.schema) as any;

    // Register with server
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        inputSchema: jsonSchema,
      },
      handler
    );
  }
}

/**
 * Get tool names for listing
 */
export function getToolNames(): string[] {
  return TOOL_REGISTRY.map((tool) => tool.name);
}

/**
 * Find tool by name
 */
export function findTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((tool) => tool.name === name);
}
