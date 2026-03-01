/**
 * GraphQL Schema Resource
 *
 * Provides the complete GraphQL schema in SDL (Schema Definition Language) format.
 * Cached for 24 hours as the schema rarely changes.
 *
 * This resource enables Claude to:
 * - Understand available types, queries, mutations
 * - Validate query syntax before execution
 * - Discover new fields and relationships
 * - Generate accurate query suggestions
 */

import {
  getIntrospectionQuery,
  buildClientSchema,
  printSchema,
  type IntrospectionQuery,
} from 'graphql';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import type { CacheService } from '../core/cache-adapter.js';
import type { GraphQLClient } from 'graphql-request';

/**
 * Create a schema fetcher with injected dependencies
 *
 * Uses introspection query to fetch schema metadata,
 * then converts to SDL format for easy reading.
 * Cached for 24 hours as the schema rarely changes.
 *
 * @param cacheService - DI cache service (shared with container)
 * @param client - GraphQL client for introspection
 * @returns Function that fetches and caches the schema
 */
export function createGetGraphQLSchema(
  cacheService: CacheService,
  client: GraphQLClient
): () => Promise<string> {
  return async (): Promise<string> => {
    // Check cache first
    const cacheKey = cacheKeys.schema();
    const cached = cacheService.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Execute introspection query
      const introspectionQuery = getIntrospectionQuery();
      const result = await client.request<IntrospectionQuery>(introspectionQuery);

      // Build client schema from introspection result
      const schema = buildClientSchema(result);

      // Convert to SDL format (human-readable)
      const sdl = printSchema(schema);

      // Add helpful header
      const schemaWithHeader = `# Lagoon DeFi Protocol - GraphQL Schema
# Generated: ${new Date().toISOString()}
#
# This schema defines all available types, queries, and mutations
# for the Lagoon DeFi vault analytics API.
#
# Key Types:
# - Vault: DeFi vault with asset info, financial metrics, and curator details
# - Transaction: Historical transaction data for performance tracking
# - User: User portfolio with positions across multiple chains
# - Asset: ERC-20 token information with pricing
#

${sdl}`;

      // Cache with 24-hour TTL
      cacheService.set(cacheKey, schemaWithHeader, cacheTTL.schema);

      return schemaWithHeader;
    } catch (error) {
      // If introspection fails, return error message
      const errorMessage = `# Error fetching GraphQL schema
# ${error instanceof Error ? error.message : String(error)}
#
# The schema is temporarily unavailable. Please try again later.`;

      return errorMessage;
    }
  };
}
