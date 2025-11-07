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
 *
 * WHY NO CACHING?
 * This tool is intentionally non-cached because:
 * 1. Query content is unpredictable (user-controlled)
 * 2. Results are typically one-time use
 * 3. Large datasets would waste cache memory
 * 4. Fresh data is required (no staleness tolerance)
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { QueryGraphQLInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';
import { handleToolError } from '../utils/tool-error-handler.js';

/**
 * Create the executeQueryGraphQL function with DI container
 *
 * This factory function demonstrates the lightweight pattern for non-cached tools:
 * 1. Dependency injection for testability
 * 2. No caching overhead (inappropriate for unpredictable queries)
 * 3. Simple, focused implementation
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteQueryGraphQL(
  container: ServiceContainer
): (input: QueryGraphQLInput) => Promise<CallToolResult> {
  return async (input: QueryGraphQLInput): Promise<CallToolResult> => {
    try {
      // Execute GraphQL query using injected client
      const data = await container.graphqlClient.request(input.query, input.variables);

      // Return successful response with pretty-printed JSON
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return handleToolError(error, 'query_graphql');
    }
  };
}
