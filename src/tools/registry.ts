/**
 * Unified Tool Registry
 *
 * Single source of truth for all MCP tool definitions.
 * Eliminates duplication between tools/index.ts and server.ts registration.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodSchema, ZodObject, ZodRawShape, ZodEffects } from 'zod';

// Tool factory functions
import { createExecuteDiscoverTools, discoverToolsInputSchema } from './discover-tools.js';
import { createExecuteQueryGraphQL } from './query-graphql.js';
import { createExecuteGetVaultData } from './vault-data.js';
import { createExecuteGetUserPortfolio } from './user-portfolio.js';
import { createExecuteSearchVaults } from './search-vaults.js';
import { createExecuteGetVaultPerformance } from './vault-performance.js';
import { createExecuteGetTransactions } from './get-transactions.js';
import { createExecuteCompareVaults } from './compare-vaults.js';
import { createExecuteGetPriceHistory } from './get-price-history.js';
import { createExecuteExportData } from './export-data.js';
import { createExecuteAnalyzeRisk, createExecuteAnalyzeRisks } from './analyze-risk.js';
import { createExecutePredictYield } from './predict-yield.js';
import { createExecuteOptimizePortfolio } from './optimize-portfolio.js';
import { createExecuteSimulateVault, simulateVaultInputSchema } from './simulate-vault.js';
import { createExecuteGetVaultComposition } from './vault-composition.js';
import { createExecuteGetGlobalTvl } from './get-global-tvl.js';
import { createExecuteGetIndexingStatus } from './get-indexing-status.js';
import { createExecuteListChains } from './list-chains.js';
import { createExecuteListCurators } from './list-curators.js';
import { createExecuteGetCurator } from './get-curator.js';
import { createExecuteGetAsset } from './get-asset.js';
import { createExecuteGetHistoricalState } from './get-historical-state.js';

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
  analyzeRisksInputSchema,
  predictYieldInputSchema,
  optimizePortfolioInputSchema,
  getVaultCompositionInputSchema,
  getGlobalTvlInputSchema,
  getIndexingStatusInputSchema,
  listChainsInputSchema,
  listCuratorsInputSchema,
  getCuratorInputSchema,
  getAssetInputSchema,
  getHistoricalStateInputSchema,
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
    name: 'discover_tools',
    description:
      'Search and discover available Lagoon MCP tools by category or keyword. ' +
      'Categories: vault, portfolio, analytics, transactions, export. ' +
      'Use this to understand available capabilities before calling specific tools. ' +
      'Performance: ~100-200 tokens. No caching needed.',
    schema: discoverToolsInputSchema,
    executorFactory: () => createExecuteDiscoverTools(),
  },
  {
    name: 'query_graphql',
    description:
      'Execute raw GraphQL queries against the Lagoon backend. ' +
      'Use for custom queries with specific field selection, large datasets (20+ vaults), ' +
      'or advanced filtering. No caching - results are always fresh. ' +
      'Requires GraphQL query syntax knowledge. ' +
      'IMPORTANT SCHEMA INFO: ' +
      '(1) The vaults query returns VaultPage with items array - access fields through: vaults { items { address name ... } pageInfo { hasNextPage } }. ' +
      '(2) For chain ID, use nested "chain { id name }" NOT "chainId" field. ' +
      '(3) Fee fields are on VaultState as individual fields: state { managementFee performanceFee protocolFee } - there is NO "feeRates" or "configuration" field. ' +
      '(4) Required variables for vaults query: orderBy (use "totalAssetsUsd") and orderDirection (use "desc").',
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
      'Returns paginated results (default 20, max 1000) with sort options. ' +
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
      'Features 15-minute caching and pagination support (default 20, max 1000).',
    schema: getTransactionsInputSchema,
    executorFactory: createExecuteGetTransactions,
  },
  {
    name: 'compare_vaults',
    description:
      'Compare multiple vaults side-by-side with normalized metrics and rankings (2-20 vaults). ' +
      'Supports comparing vaults across different chains by passing chainIds array (or single chainId for backward compatibility). ' +
      'Cross-chain usage: provide chainIds array with one chain per vault address (positional mapping). ' +
      'Example: vaultAddresses=[A,B,C] with chainIds=[1,8453,42161] compares vault A on Ethereum, B on Base, C on Arbitrum. ' +
      'Provides comprehensive comparison including TVL, APR, overall performance scores, and percentile rankings. ' +
      'Calculates deltas from averages and identifies best/worst performers automatically. ' +
      'Returns formatted comparison table with summary statistics and individual vault rankings. ' +
      'Best for: evaluating investment opportunities, identifying top performers, risk-adjusted return analysis, portfolio construction. ' +
      'New: each vault output includes sustainableNetApr (linearNetAprWithoutExtraYields), incentiveContribution, and twrrNetApr. ' +
      'Set rankBy="sustainableApr" to rank by organic yield (excluding airdrops/incentives) — fair comparison when some vaults are incentive-heavy. ' +
      'Performance: ~300 tokens per vault. ' +
      'Features 15-minute caching based on vault address and chain combinations.',
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
      'Supports multiple data types: vaults (vault info with TVL/APR), transactions (deposit/redeem history), ' +
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
    name: 'analyze_risks',
    description:
      'Batch risk analysis for 2-20 vaults in a single operation. ' +
      'Significantly more efficient than multiple analyze_risk calls when analyzing multiple vaults. ' +
      'Supports both same-chain (single chainId) and cross-chain analysis (chainIds array with positional mapping). ' +
      'Cross-chain usage: provide chainIds array with one chain per vault address. ' +
      'Example: vaultAddresses=[A,B,C] with chainIds=[1,8453,42161] analyzes vault A on Ethereum, B on Base, C on Arbitrum. ' +
      'Returns comparative risk scores, summary statistics (lowest/highest/average risk), and top risk factors for each vault. ' +
      'Best for: portfolio risk assessment, comparing investment opportunities, batch due diligence. ' +
      'Performance: ~300-500 tokens total (vs ~400-600 per vault with individual calls). ' +
      'Features 15-minute caching for risk stability.',
    schema: analyzeRisksInputSchema,
    executorFactory: createExecuteAnalyzeRisks,
  },
  {
    name: 'predict_yield',
    description:
      'Predict vault yield with ML-based forecasting using trend analysis and historical performance. ' +
      'Analyzes APR trends using linear regression, exponential moving averages, and volatility analysis. ' +
      'Provides projected returns for multiple timeframes (7d, 30d, 90d, 1y) with confidence intervals. ' +
      'Returns current APR, predicted APR, trend direction, confidence score, and detailed insights. ' +
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
  {
    name: 'get_vault_composition',
    description:
      'Fetch vault DeFi protocol composition with diversification analysis from Octav API. ' +
      'Returns breakdown by protocol (e.g., Spark, Morpho, Yield Basis, Lagoon) with USD values. ' +
      'Calculates HHI (Herfindahl-Hirschman Index) for protocol diversification scoring. ' +
      '"wallet" protocol represents idle assets not deployed in DeFi (excluded from HHI, tracked as idleAssetsPercent). ' +
      'Diversification levels: High (HHI < 0.15), Medium (0.15-0.25), Low (> 0.25). ' +
      'Supports 3 response formats for token optimization: ' +
      'summary (totals + top 5 protocols ~100 tokens), ' +
      'protocols (all non-zero protocols ~200-500 tokens), ' +
      'full (all data including raw ~1000+ tokens). ' +
      'Best for: understanding DeFi protocol exposure, identifying concentration risks, capital efficiency analysis. ' +
      'Default: summary for token efficiency. ' +
      'Features 15-minute caching (backend caches Octav API data for 6 hours).',
    schema: getVaultCompositionInputSchema,
    executorFactory: createExecuteGetVaultComposition,
  },
  {
    name: 'get_global_tvl',
    description:
      'Live total value locked across all Lagoon vaults and chains, in USD. ' +
      'Single number, no arguments. Use for headline "how big is Lagoon" context. ' +
      'Performance: ~30 tokens. Cache: 5 minutes.',
    schema: getGlobalTvlInputSchema,
    executorFactory: createExecuteGetGlobalTvl,
  },
  {
    name: 'get_indexing_status',
    description:
      'Indexer health: last indexed block per chain. ' +
      'Use BEFORE running predict_yield / analyze_risk on a freshly active vault to detect ' +
      'stale data. If a chain is lagging far behind head, downstream analytics may report ' +
      'wrong APR/TVL. Optional `chainIds` filter; omit for all chains. ' +
      'Performance: ~100 tokens per chain. Cache: 60s.',
    schema: getIndexingStatusInputSchema,
    executorFactory: createExecuteGetIndexingStatus,
  },
  {
    name: 'list_chains',
    description:
      'Directory of Lagoon-supported chains with chainId, name, native token, factory address, ' +
      'and wrapped native token. Use to discover valid chain IDs instead of hardcoding. ' +
      'Optional `isVisible: true` filter restricts to chains exposed in the Lagoon frontend. ' +
      'Performance: ~80 tokens per chain. Cache: 24h.',
    schema: listChainsInputSchema,
    executorFactory: createExecuteListChains,
  },
  {
    name: 'list_curators',
    description:
      'Directory of vault curators on Lagoon (id, name, logo, description, website). ' +
      "Pair with `search_vaults` filter `curatorIds_contains` to enumerate a curator's vaults. " +
      'Optional `isVisible: true` for frontend-listed only. ' +
      'Performance: ~60 tokens per curator. Cache: 15 minutes.',
    schema: listCuratorsInputSchema,
    executorFactory: createExecuteListCurators,
  },
  {
    name: 'get_curator',
    description:
      'Single curator lookup by ID (returns name, description, logo, website, visibility). ' +
      'Use after `list_curators` to drill into one curator. ' +
      'Performance: ~80 tokens. Cache: 15 minutes.',
    schema: getCuratorInputSchema,
    executorFactory: createExecuteGetCurator,
  },
  {
    name: 'get_asset',
    description:
      'Single ERC20 asset metadata lookup by address + chainId (symbol, decimals, current USD price, chain). ' +
      'Useful when the asset is referenced outside a vault context. ' +
      'Inside vault queries the asset is already nested, so prefer `get_vault_data` there. ' +
      'Performance: ~120 tokens. Cache: 5 minutes (priceUsd ticks with the market).',
    schema: getAssetInputSchema,
    executorFactory: createExecuteGetAsset,
  },
  {
    name: 'get_historical_state',
    description:
      'Vault state at a specific Unix timestamp via `Vault.stateAt(timestamp)`. ' +
      'Returns the HistoricalVaultState (price-per-share, fees, totalAssets, roles, guardrails, ' +
      'pause/lock flags) AS OF the requested time. Far simpler than reconstructing state from ' +
      'TotalAssetsUpdated/RatesUpdated event streams. ' +
      'Use cases: "what was PPS on Jan 1?", "were fees lower at inception?", "was the vault paused during incident X?". ' +
      'Some fields may be null on vaults predating that configuration. ' +
      'Performance: ~300-500 tokens. Cache: 60 minutes (historical state is immutable once past).',
    schema: getHistoricalStateInputSchema,
    executorFactory: createExecuteGetHistoricalState,
  },
];

/**
 * Extract the raw shape from a Zod schema, handling ZodEffects wrappers.
 * ZodEffects is created by methods like .refine(), .transform(), .superRefine()
 *
 * @param schema - The Zod schema to extract the shape from
 * @param toolName - Tool name for error messages
 * @returns The raw shape definition for MCP registration
 */
function extractSchemaShape(schema: ZodSchema, toolName: string): ZodRawShape {
  // Direct ZodObject - get shape directly
  if (schema instanceof ZodObject) {
    return schema.shape as ZodRawShape;
  }

  // ZodEffects wrapper (from .refine(), .transform(), etc.) - unwrap inner schema recursively
  if (schema instanceof ZodEffects) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const innerSchema: unknown = schema._def.schema;
    // Recursively unwrap nested ZodEffects (from chained .refine() calls)
    if (innerSchema instanceof ZodEffects || innerSchema instanceof ZodObject) {
      return extractSchemaShape(innerSchema as ZodSchema, toolName);
    }
  }

  throw new Error(`Tool ${toolName} schema must be a ZodObject or ZodEffects wrapping a ZodObject`);
}

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

    // Extract raw shape from Zod schema for MCP registration
    // Handles both direct ZodObject and ZodEffects wrappers (from .refine(), etc.)
    const inputShape: ZodRawShape = extractSchemaShape(tool.schema, tool.name);

    // Register with server
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputShape,
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
