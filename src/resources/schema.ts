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

import { getIntrospectionQuery, buildClientSchema, printSchema } from 'graphql';
import { graphqlClient } from '../graphql/client.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';

/**
 * Fetch and cache the GraphQL schema
 *
 * Uses introspection query to fetch schema metadata,
 * then converts to SDL format for easy reading.
 *
 * @returns GraphQL schema in SDL format
 */
export async function getGraphQLSchema(): Promise<string> {
  // Check cache first
  const cacheKey = cacheKeys.schema();
  const cached = cache.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Execute introspection query
    const introspectionQuery = getIntrospectionQuery();
    const result = await graphqlClient.request<{ __schema: unknown }>(introspectionQuery);

    // Build client schema from introspection result
    const schema = buildClientSchema(result as never);

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
    cache.set(cacheKey, schemaWithHeader, cacheTTL.schema);

    return schemaWithHeader;
  } catch (error) {
    // If introspection fails, return error message
    const errorMessage = `# Error fetching GraphQL schema
# ${error instanceof Error ? error.message : String(error)}
#
# The schema is temporarily unavailable. Please try again later.`;

    return errorMessage;
  }
}
