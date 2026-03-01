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
import {
  parse,
  Kind,
  OperationTypeNode,
  type DocumentNode,
  type SelectionSetNode,
  type SelectionNode,
  type DefinitionNode,
} from 'graphql';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { QueryGraphQLInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';
import { handleToolError } from '../utils/tool-error-handler.js';

const MAX_QUERY_DEPTH = 10;
const MAX_ALIASES = 20;

function getSelectionSet(node: SelectionNode | DefinitionNode): SelectionSetNode | undefined {
  if ('selectionSet' in node) {
    return node.selectionSet ?? undefined;
  }
  return undefined;
}

function getDepth(selectionSet: SelectionSetNode | undefined, current: number): number {
  if (!selectionSet) return current;
  let maxDepth = current;
  for (const selection of selectionSet.selections) {
    const childSet = getSelectionSet(selection);
    if (childSet) {
      const childDepth = getDepth(childSet, current + 1);
      if (childDepth > maxDepth) maxDepth = childDepth;
    }
  }
  return maxDepth;
}

function countAliases(selectionSet: SelectionSetNode | undefined): number {
  if (!selectionSet) return 0;
  let count = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD && selection.alias) count++;
    const childSet = getSelectionSet(selection);
    if (childSet) count += countAliases(childSet);
  }
  return count;
}

/**
 * Validates a GraphQL query string for safety:
 * - Only query operations allowed (no mutations/subscriptions)
 * - Depth limit to prevent resource exhaustion
 * - Alias limit to prevent batching attacks
 */
function validateGraphQLQuery(queryString: string): { valid: boolean; error?: string } {
  let document: DocumentNode;
  try {
    document = parse(queryString);
  } catch (e) {
    return { valid: false, error: `Invalid GraphQL syntax: ${(e as Error).message}` };
  }

  for (const definition of document.definitions) {
    // Check operation types — only queries allowed
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      if (definition.operation !== OperationTypeNode.QUERY) {
        return {
          valid: false,
          error: `Only query operations are allowed. Received: ${definition.operation}`,
        };
      }
    }

    // Check query depth and alias count
    const defSelectionSet = getSelectionSet(definition);
    if (defSelectionSet) {
      const depth = getDepth(defSelectionSet, 1);
      if (depth > MAX_QUERY_DEPTH) {
        return {
          valid: false,
          error: `Query depth ${depth} exceeds maximum allowed depth of ${MAX_QUERY_DEPTH}`,
        };
      }

      const aliasCount = countAliases(defSelectionSet);
      if (aliasCount > MAX_ALIASES) {
        return {
          valid: false,
          error: `Query has ${aliasCount} aliases, exceeding maximum of ${MAX_ALIASES}`,
        };
      }
    }
  }

  return { valid: true };
}

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
      // Validate query safety (no mutations, depth/alias limits)
      const validation = validateGraphQLQuery(input.query);
      if (!validation.valid) {
        return {
          content: [
            {
              type: 'text',
              text: `Query validation failed: ${validation.error}`,
            },
          ],
          isError: true,
        };
      }

      // Execute GraphQL query using injected client
      const data = await container.graphqlClient.request(input.query, input.variables);

      // Return successful response with pretty-printed JSON and legal disclaimer
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2) + getToolDisclaimer('query_graphql'),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return handleToolError(error, 'query_graphql');
    }
  };
}
