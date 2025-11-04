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
import {
  queryGraphQLInputSchema,
  getVaultDataInputSchema,
  getUserPortfolioInputSchema,
  searchVaultsInputSchema,
  getVaultPerformanceInputSchema,
  getTransactionsInputSchema,
} from './utils/validators.js';

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
    async (args) => {
      return await executeQueryGraphQL(args as never);
    }
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
    async (args) => {
      return await executeGetVaultData(args as never);
    }
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
    async (args) => {
      return await executeGetUserPortfolio(args as never);
    }
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
    async (args) => {
      return await executeSearchVaults(args as never);
    }
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
    async (args) => {
      return await executeGetVaultPerformance(args as never);
    }
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
    async (args) => {
      return await executeGetTransactions(args as never);
    }
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
