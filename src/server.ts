/**
 * Lagoon MCP Server
 *
 * Modern implementation using McpServer API for:
 * - Automatic capability management
 * - Clean tool/resource/prompt registration
 * - Future-proof architecture
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { config } from './config.js';
import { checkBackendHealth } from './graphql/client.js';

// Tool imports
import { executeQueryGraphQL } from './tools/query-graphql.js';
import { executeGetVaultData } from './tools/vault-data.js';
import { executeGetUserPortfolio } from './tools/user-portfolio.js';
import { executeSearchVaults } from './tools/search-vaults.js';
import { executeGetVaultPerformance } from './tools/vault-performance.js';
import { executeGetTransactions } from './tools/get-transactions.js';
import { executeCompareVaults } from './tools/compare-vaults.js';
import { executeGetPriceHistory } from './tools/get-price-history.js';
import { executeExportData } from './tools/export-data.js';
import { executeAnalyzeRisk } from './tools/analyze-risk.js';
import { executePredictYield } from './tools/predict-yield.js';
import { executeOptimizePortfolio } from './tools/optimize-portfolio.js';
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
} from './utils/validators.js';
import { createToolHandler } from './utils/tool-handler.js';

// Resource imports
import { getGraphQLSchema } from './resources/schema.js';
import { getDefiGlossary } from './resources/glossary.js';

// Prompt imports
import { getFinancialAnalysisPrompt } from './prompts/financial-analysis.js';

/**
 * Create and configure the MCP server instance
 *
 * Uses modern McpServer API for automatic capability management
 * and clean registration patterns.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'lagoon-mcp',
    version: '0.1.0',
  });

  // ==========================================
  // Tool Registration
  // ==========================================

  // Create type-safe tool handlers
  const queryGraphQLHandler = createToolHandler(executeQueryGraphQL, queryGraphQLInputSchema);
  const getVaultDataHandler = createToolHandler(executeGetVaultData, getVaultDataInputSchema);
  const getUserPortfolioHandler = createToolHandler(
    executeGetUserPortfolio,
    getUserPortfolioInputSchema
  );
  const searchVaultsHandler = createToolHandler(executeSearchVaults, searchVaultsInputSchema);
  const getVaultPerformanceHandler = createToolHandler(
    executeGetVaultPerformance,
    getVaultPerformanceInputSchema
  );
  const getTransactionsHandler = createToolHandler(
    executeGetTransactions,
    getTransactionsInputSchema
  );
  const compareVaultsHandler = createToolHandler(executeCompareVaults, compareVaultsInputSchema);
  const getPriceHistoryHandler = createToolHandler(executeGetPriceHistory, priceHistoryInputSchema);
  const exportDataHandler = createToolHandler(executeExportData, exportDataInputSchema);
  const analyzeRiskHandler = createToolHandler(executeAnalyzeRisk, analyzeRiskInputSchema);
  const predictYieldHandler = createToolHandler(executePredictYield, predictYieldInputSchema);
  const optimizePortfolioHandler = createToolHandler(
    executeOptimizePortfolio,
    optimizePortfolioInputSchema
  );

  server.registerTool(
    'query_graphql',
    {
      description:
        'Execute raw GraphQL queries against the Lagoon backend. ' +
        'Use for custom queries with specific field selection, large datasets (20+ vaults), ' +
        'or advanced filtering. No caching - results are always fresh. ' +
        'Requires GraphQL query syntax knowledge.',
      inputSchema: {
        query: queryGraphQLInputSchema.shape.query,
        variables: queryGraphQLInputSchema.shape.variables,
      },
    },
    queryGraphQLHandler
  );

  server.registerTool(
    'get_vault_data',
    {
      description:
        'Fetch complete vault information with 15-minute caching. ' +
        'Optimized for detailed analysis of 1-5 vaults. ' +
        'Returns all vault fields including asset info, financial metrics, curator details, and metadata. ' +
        'Best for: small vault sets, repeated queries, comprehensive analysis. ' +
        'Performance: ~500 tokens per vault.',
      inputSchema: {
        vaultAddress: getVaultDataInputSchema.shape.vaultAddress,
        chainId: getVaultDataInputSchema.shape.chainId,
      },
    },
    getVaultDataHandler
  );

  server.registerTool(
    'get_user_portfolio',
    {
      description:
        'Fetch user portfolio with 5-minute caching. ' +
        'Automatically queries all supported chains via the users API. ' +
        'Returns sorted positions by USD value with complete vault data for each position. ' +
        'Best for: multi-chain portfolio analysis, user position tracking, portfolio value aggregation. ' +
        'Performance: ~300-800 tokens per user (varies with position count).',
      inputSchema: {
        userAddress: getUserPortfolioInputSchema.shape.userAddress,
      },
    },
    getUserPortfolioHandler
  );

  server.registerTool(
    'search_vaults',
    {
      description:
        'Search and filter vaults with advanced criteria and 10-minute caching. ' +
        'Supports 20+ filter options including asset, chain, TVL, curator, visibility. ' +
        'Returns paginated results (default 100, max 1000) with sort options. ' +
        'Best for: vault discovery, filtering by criteria, TVL-sorted lists, multi-vault analysis. ' +
        'Performance: ~300-500 tokens per page. ' +
        'Cache key based on filter hash for efficient repeated searches.',
      inputSchema: {
        filters: searchVaultsInputSchema.shape.filters,
        pagination: searchVaultsInputSchema.shape.pagination,
        orderBy: searchVaultsInputSchema.shape.orderBy,
        orderDirection: searchVaultsInputSchema.shape.orderDirection,
      },
    },
    searchVaultsHandler
  );

  server.registerTool(
    'get_vault_performance',
    {
      description:
        'Analyze vault performance metrics over time with 30-minute caching. ' +
        'Tracks historical data points including TVL, transactions, and key events. ' +
        'Best for: performance tracking, trend analysis, TVL history, inflection point identification. ' +
        'Performance: ~400-600 tokens per vault per time range. ' +
        'Fetches up to 1000 transactions per query.',
      inputSchema: {
        vaultAddress: getVaultPerformanceInputSchema.shape.vaultAddress,
        chainId: getVaultPerformanceInputSchema.shape.chainId,
        timeRange: getVaultPerformanceInputSchema.shape.timeRange,
      },
    },
    getVaultPerformanceHandler
  );

  server.registerTool(
    'get_transactions',
    {
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
      inputSchema: {
        vaultAddress: getTransactionsInputSchema.shape.vaultAddress,
        chainId: getTransactionsInputSchema.shape.chainId,
        transactionTypes: getTransactionsInputSchema.shape.transactionTypes,
        pagination: getTransactionsInputSchema.shape.pagination,
        orderBy: getTransactionsInputSchema.shape.orderBy,
        orderDirection: getTransactionsInputSchema.shape.orderDirection,
      },
    },
    getTransactionsHandler
  );

  server.registerTool(
    'compare_vaults',
    {
      description:
        'Compare multiple vaults side-by-side with normalized metrics and rankings (2-10 vaults). ' +
        'Provides comprehensive comparison including TVL, APY, overall performance scores, and percentile rankings. ' +
        'Calculates deltas from averages and identifies best/worst performers automatically. ' +
        'Returns formatted comparison table with summary statistics and individual vault rankings. ' +
        'Best for: evaluating investment opportunities, identifying top performers, risk-adjusted return analysis, portfolio construction. ' +
        'Performance: ~300 tokens per vault. ' +
        'Features 15-minute caching based on vault address combinations.',
      inputSchema: {
        vaultAddresses: compareVaultsInputSchema.shape.vaultAddresses,
        chainId: compareVaultsInputSchema.shape.chainId,
      },
    },
    compareVaultsHandler
  );

  server.registerTool(
    'get_price_history',
    {
      description:
        'Fetch historical price data for vault shares with OHLCV (Open, High, Low, Close, Volume) time-series analysis. ' +
        'Aggregates price data by day for cleaner visualization and provides comprehensive price statistics. ' +
        'Calculates volatility (standard deviation), percent changes, and identifies price trends over time. ' +
        'Returns formatted price history table with daily OHLCV data and statistical summary. ' +
        'Best for: price trend analysis, volatility assessment, historical price point identification, entry/exit decision support. ' +
        'Performance: ~300-500 tokens per vault per time range. ' +
        'Features 30-minute caching for historical data. ' +
        'Time ranges: 7d (7 days), 30d (30 days), 90d (90 days), 1y (1 year), all (complete history).',
      inputSchema: {
        vaultAddress: priceHistoryInputSchema.shape.vaultAddress,
        chainId: priceHistoryInputSchema.shape.chainId,
        timeRange: priceHistoryInputSchema.shape.timeRange,
      },
    },
    getPriceHistoryHandler
  );

  server.registerTool(
    'export_data',
    {
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
      inputSchema: {
        vaultAddresses: exportDataInputSchema.shape.vaultAddresses,
        chainId: exportDataInputSchema.shape.chainId,
        dataType: exportDataInputSchema.shape.dataType,
        format: exportDataInputSchema.shape.format,
      },
    },
    exportDataHandler
  );

  server.registerTool(
    'analyze_risk',
    {
      description:
        'Analyze vault risk with multi-factor scoring across TVL, concentration, volatility, age, and curator reputation. ' +
        'Provides comprehensive risk assessment with individual factor breakdowns and overall risk level (Low/Medium/High/Critical). ' +
        'Evaluates: TVL risk (liquidity and market validation), concentration risk (protocol-wide exposure), ' +
        'volatility risk (price stability), age risk (operational track record), curator risk (reputation and experience). ' +
        'Returns detailed risk analysis with scores (0-1 scale), risk levels with emoji indicators, and factor explanations. ' +
        'Best for: investment decision-making, due diligence, portfolio risk monitoring, comparative vault analysis. ' +
        'Performance: ~400-600 tokens per analysis. ' +
        'Features 15-minute caching for risk stability.',
      inputSchema: {
        vaultAddress: analyzeRiskInputSchema.shape.vaultAddress,
        chainId: analyzeRiskInputSchema.shape.chainId,
      },
    },
    analyzeRiskHandler
  );

  server.registerTool(
    'predict_yield',
    {
      description:
        'Predict vault yield with ML-based forecasting using trend analysis and historical performance. ' +
        'Analyzes APY trends using linear regression, exponential moving averages, and volatility analysis. ' +
        'Provides projected returns for multiple timeframes (7d, 30d, 90d, 1y) with confidence intervals. ' +
        'Returns current APY, predicted APY, trend direction, confidence score, and detailed insights. ' +
        'Best for: investment planning, yield farming optimization, return projections, performance trend analysis. ' +
        'Performance: ~400-600 tokens per prediction. ' +
        'Features 60-minute caching for prediction stability.',
      inputSchema: {
        vaultAddress: predictYieldInputSchema.shape.vaultAddress,
        chainId: predictYieldInputSchema.shape.chainId,
        timeRange: predictYieldInputSchema.shape.timeRange,
      },
    },
    predictYieldHandler
  );

  server.registerTool(
    'optimize_portfolio',
    {
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
      inputSchema: {
        vaultAddresses: optimizePortfolioInputSchema.shape.vaultAddresses,
        chainId: optimizePortfolioInputSchema.shape.chainId,
        currentPositions: optimizePortfolioInputSchema.shape.currentPositions,
        strategy: optimizePortfolioInputSchema.shape.strategy,
        rebalanceThreshold: optimizePortfolioInputSchema.shape.rebalanceThreshold,
      },
    },
    optimizePortfolioHandler
  );

  // ==========================================
  // Resource Registration
  // ==========================================

  server.registerResource(
    'graphql-schema',
    'lagoon://graphql-schema',
    {
      title: 'GraphQL Schema',
      description:
        'Complete GraphQL schema in SDL format. ' +
        'Includes all types, queries, and mutations for the Lagoon API. ' +
        'Cached for 24 hours.',
      mimeType: 'text/plain',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/plain',
          text: await getGraphQLSchema(),
        },
      ],
    })
  );

  server.registerResource(
    'defi-glossary',
    'lagoon://defi-glossary',
    {
      title: 'DeFi Glossary',
      description:
        'Comprehensive terminology guide for Lagoon DeFi Protocol. ' +
        'Explains vault concepts, financial metrics, transaction types, and calculations. ' +
        'Essential reference for understanding vault data and analysis.',
      mimeType: 'text/markdown',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: getDefiGlossary(),
        },
      ],
    })
  );

  // ==========================================
  // Prompt Registration
  // ==========================================

  server.registerPrompt(
    'financial-analysis',
    {
      title: 'Financial Analysis',
      description:
        'Guidance for analyzing DeFi vault data and generating financial insights. ' +
        'Includes analysis patterns for portfolio review, vault performance, and vault discovery. ' +
        'Provides frameworks for risk assessment, metrics interpretation, and report structure.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getFinancialAnalysisPrompt(),
          },
        },
      ],
    })
  );

  return server;
}

/**
 * Run the MCP server
 */
export async function runServer(): Promise<void> {
  // Validate configuration
  console.error('Starting Lagoon MCP Server...');
  console.error(`GraphQL Endpoint: ${config.graphql.endpoint}`);
  console.error(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Check backend health
  console.error('Checking backend connection...');
  try {
    const isHealthy = await checkBackendHealth();
    if (isHealthy) {
      console.error('✓ Backend connection successful');
    } else {
      console.error('⚠ Backend health check failed, continuing anyway...');
    }
  } catch (error) {
    console.error('⚠ Cannot reach backend, continuing anyway...');
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Create and start server
  const server = createServer();
  const transport = new StdioServerTransport();

  console.error('Connecting to stdio transport...');
  await server.connect(transport);

  console.error('✓ Lagoon MCP Server is running');
  console.error('  Server: McpServer (modern API)');
  console.error('  Capabilities: Auto-managed');
}
