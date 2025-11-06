/**
 * search_vaults Tool
 *
 * Vault discovery and filtering with advanced search capabilities.
 * Supports 20+ filter options with pagination and 10-minute caching.
 *
 * Use cases:
 * - Discover vaults by asset, chain, TVL, curator
 * - Filter vaults with complex criteria combinations
 * - Paginate through large result sets
 * - Sort by TVL, address, chainId, or id
 * - Performance: ~300-500 tokens per page of results
 *
 * Cache strategy:
 * - 10-minute TTL for balance between freshness and performance
 * - Cache key: search:{MD5 hash of filters}:{pagination}:{sort}
 * - Repeated searches with same filters hit cache
 * - Cache hit rate target: 70-80%
 * - Cache tags: [CacheTag.VAULT] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createHash } from 'crypto';
import { SearchVaultsInput } from '../utils/validators.js';
import { VaultData } from '../graphql/fragments/index.js';
import { SEARCH_VAULTS_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';

// Query now imported from ../graphql/queries/index.js

/**
 * Page info structure
 */
interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Search vaults response type
 */
interface SearchVaultsResponse {
  vaults: {
    items: VaultData[];
    pageInfo: PageInfo;
  };
}

/**
 * Convert snake_case filters to GraphQL VaultFilterInput format
 * Handles nested state filters by flattening them
 */
function buildGraphQLFilters(filters: SearchVaultsInput['filters']): Record<string, unknown> {
  if (!filters) {
    return {};
  }

  const graphqlFilters: Record<string, unknown> = {};

  // Direct pass-through filters (no transformation needed)
  const directFilters = [
    'assetSymbol_eq',
    'assetSymbol_in',
    'assetId_eq',
    'assetId_in',
    'chainId_eq',
    'chainId_in',
    'curatorIds_contains',
    'curatorIds_contains_any',
    'isVisible_eq',
    'address_eq',
    'address_in',
    'symbol_eq',
    'symbol_in',
    'integratorId_eq',
    'integratorId_in',
  ] as const;

  for (const key of directFilters) {
    if (key in filters && filters[key as keyof typeof filters] !== undefined) {
      graphqlFilters[key] = filters[key as keyof typeof filters];
    }
  }

  // Handle nested state filters
  // Note: Backend may not support these - will be tested in Phase 2.5
  if (filters.state_totalAssetsUsd_gte !== undefined) {
    graphqlFilters.state_totalAssetsUsd_gte = filters.state_totalAssetsUsd_gte;
  }
  if (filters.state_totalAssetsUsd_lte !== undefined) {
    graphqlFilters.state_totalAssetsUsd_lte = filters.state_totalAssetsUsd_lte;
  }

  return graphqlFilters;
}

/**
 * Generate MD5 hash of filter object for cache key
 * Ensures consistent cache keys for identical filter combinations
 */
function hashFilters(filters: SearchVaultsInput['filters']): string {
  if (!filters || Object.keys(filters).length === 0) {
    return 'empty';
  }

  // Sort keys to ensure consistent hashing
  // Create a properly typed sorted filters object
  type FilterKey = keyof NonNullable<SearchVaultsInput['filters']>;

  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce<Partial<NonNullable<SearchVaultsInput['filters']>>>((acc, key) => {
      const typedKey = key as FilterKey;
      const value = filters[typedKey];
      if (value !== undefined) {
        // Safe assignment: we know the key exists in filters and we're assigning its value
        (acc as Record<FilterKey, unknown>)[typedKey] = value;
      }
      return acc;
    }, {});

  const filterString = JSON.stringify(sortedFilters);
  return createHash('md5').update(filterString).digest('hex');
}

/**
 * GraphQL variables type for SEARCH_VAULTS_QUERY
 */
interface SearchVaultsVariables {
  first: number;
  skip: number;
  orderBy: string;
  orderDirection: string;
  where?: Record<string, unknown>;
}

/**
 * Create the executeSearchVaults function with DI container
 *
 * This factory function demonstrates the moderate complexity pattern:
 * 1. Custom cache key generation with MD5 hashing
 * 2. Complex variable mapping with filter transformation
 * 3. Custom validation for empty results
 * 4. Cache tag registration for invalidation
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteSearchVaults(
  container: ServiceContainer
): (input: SearchVaultsInput) => Promise<CallToolResult> {
  const executor = executeToolWithCache<
    SearchVaultsInput,
    SearchVaultsResponse,
    SearchVaultsVariables
  >({
    container,
    cacheKey: (input) => {
      const pagination = input.pagination || { first: 100, skip: 0 };
      const filterHash = hashFilters(input.filters);
      return `${cacheKeys.searchVaults({ filterHash })}:${pagination.first}:${pagination.skip}:${input.orderBy}:${input.orderDirection}`;
    },
    cacheTTL: cacheTTL.searchResults,
    query: SEARCH_VAULTS_QUERY,
    variables: (input) => {
      const pagination = input.pagination || { first: 100, skip: 0 };
      const whereClause = buildGraphQLFilters(input.filters);
      return {
        first: pagination.first,
        skip: pagination.skip,
        orderBy: input.orderBy,
        orderDirection: input.orderDirection,
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      };
    },
    validateResult: (data) => ({
      valid: !!(data.vaults && data.vaults.items.length > 0),
      message:
        data.vaults && data.vaults.items.length > 0
          ? undefined
          : 'No vaults found matching the specified criteria.',
    }),
    toolName: 'search_vaults',
  });

  // Register cache tags for invalidation
  return (input: SearchVaultsInput) => {
    const pagination = input.pagination || { first: 100, skip: 0 };
    const filterHash = hashFilters(input.filters);
    const cacheKey = `${cacheKeys.searchVaults({ filterHash })}:${pagination.first}:${pagination.skip}:${input.orderBy}:${input.orderDirection}`;
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT]);
    return executor(input);
  };
}
