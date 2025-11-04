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
import {
  queryGraphQLInputSchema,
  getVaultDataInputSchema,
  getUserPortfolioInputSchema,
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
  // Additional tools will be added:
  // - search_vaults (Phase 3)
  // - get_vault_performance (Phase 3)
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
