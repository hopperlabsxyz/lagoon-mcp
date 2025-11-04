/**
 * Tool Registry
 *
 * Central registry for all MCP tools.
 * Tools will be implemented in Phase 2.
 */

import { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { executeQueryGraphQL } from './query-graphql.js';
import { executeGetVaultData } from './vault-data.js';
import { executeGetUserPortfolio } from './user-portfolio.js';
import { executeSearchVaults } from './search-vaults.js';
import { executeGetVaultPerformance } from './vault-performance.js';
import { executeGetTransactions } from './get-transactions.js';
import {
  queryGraphQLInputSchema,
  getVaultDataInputSchema,
  getUserPortfolioInputSchema,
  searchVaultsInputSchema,
  getVaultPerformanceInputSchema,
  getTransactionsInputSchema,
} from '../utils/validators.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool Registry
 * Add tools here as they are implemented in Phase 2
 */
export const tools: Tool[] = [
  {
    name: 'query_graphql',
    description:
      'Execute raw GraphQL queries against the Lagoon backend. ' +
      'Use for custom queries with specific field selection, large datasets (20+ vaults), ' +
      'or advanced filtering. No caching - results are always fresh. ' +
      'Requires GraphQL query syntax knowledge.',
    inputSchema: zodToJsonSchema(queryGraphQLInputSchema) as Tool['inputSchema'],
  },
  {
    name: 'get_vault_data',
    description:
      'Fetch complete vault information with 15-minute caching. ' +
      'Optimized for detailed analysis of 1-5 vaults. ' +
      'Returns all vault fields including asset info, financial metrics, curator details, and metadata. ' +
      'Best for: small vault sets, repeated queries, comprehensive analysis. ' +
      'Performance: ~500 tokens per vault.',
    inputSchema: zodToJsonSchema(getVaultDataInputSchema) as Tool['inputSchema'],
  },
  {
    name: 'get_user_portfolio',
    description:
      'Fetch user portfolio with 5-minute caching. ' +
      'Automatically queries all supported chains via the users API. ' +
      'Returns sorted positions by USD value with complete vault data for each position. ' +
      'Best for: multi-chain portfolio analysis, user position tracking, portfolio value aggregation. ' +
      'Performance: ~300-800 tokens per user (varies with position count).',
    inputSchema: zodToJsonSchema(getUserPortfolioInputSchema) as Tool['inputSchema'],
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
    inputSchema: zodToJsonSchema(searchVaultsInputSchema) as Tool['inputSchema'],
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
    inputSchema: zodToJsonSchema(getVaultPerformanceInputSchema) as Tool['inputSchema'],
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
    inputSchema: zodToJsonSchema(getTransactionsInputSchema) as Tool['inputSchema'],
  },
];

/**
 * Handle tool calls
 */
export async function handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
  const toolName = request.params.name;
  const args = request.params.arguments;

  try {
    switch (toolName) {
      case 'query_graphql':
        return await executeQueryGraphQL((args ?? {}) as never);

      case 'get_vault_data':
        return await executeGetVaultData((args ?? {}) as never);

      case 'get_user_portfolio':
        return await executeGetUserPortfolio((args ?? {}) as never);

      case 'search_vaults':
        return await executeSearchVaults((args ?? {}) as never);

      case 'get_vault_performance':
        return await executeGetVaultPerformance((args ?? {}) as never);

      case 'get_transactions':
        return await executeGetTransactions((args ?? {}) as never);

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Tool "${toolName}" is not implemented. Available tools: ${tools.map((t) => t.name).join(', ')}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool "${toolName}": ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
