/**
 * query_graphql Tool
 *
 * Direct GraphQL query execution for power users and large datasets.
 * No caching - designed for unpredictable, custom queries.
 *
 * Use cases:
 * - Custom queries with specific field selection
 * - Large dataset queries (20+ vaults)
 * - One-time analysis queries
 * - Advanced filtering and aggregation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { QueryGraphQLInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';

/**
 * Execute a raw GraphQL query against the Lagoon backend
 *
 * @param input - Query and optional variables (pre-validated by createToolHandler)
 * @returns GraphQL response data or error
 */
export async function executeQueryGraphQL(input: QueryGraphQLInput): Promise<CallToolResult> {
  try {
    // Execute GraphQL query (input already validated by createToolHandler)
    const data = await graphqlClient.request(input.query, input.variables);

    // Return successful response
    return createSuccessResponse(data);
  } catch (error) {
    return handleToolError(error, 'query_graphql');
  }
}
