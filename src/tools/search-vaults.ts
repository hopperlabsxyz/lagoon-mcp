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
import {
  createSearchVaultsQuery,
  type SearchVaultsResponseFormat,
} from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { generateCacheKey } from '../cache/index.js';

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
 * This factory function demonstrates the moderate complexity pattern with optimizations:
 * 1. Custom cache key generation with MD5 hashing
 * 2. Complex variable mapping with filter transformation
 * 3. Custom validation for empty results
 * 4. Cache tag registration for invalidation
 * 5. NEW: Dynamic fragment selection based on responseFormat
 * 6. NEW: Fragment-level caching for individual vaults (enables data reuse)
 * 7. NEW: maxResults override for pagination.first
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteSearchVaults(
  container: ServiceContainer
): (input: SearchVaultsInput) => Promise<CallToolResult> {
  return async (input: SearchVaultsInput): Promise<CallToolResult> => {
    // Apply maxResults to pagination.first (overrides user-provided pagination.first)
    const effectiveFirst = input.maxResults || input.pagination?.first || 100;
    const pagination = {
      first: Math.min(effectiveFirst, 100), // Enforce max 100
      skip: input.pagination?.skip || 0,
    };

    // Determine response format
    const responseFormat: SearchVaultsResponseFormat = input.responseFormat || 'list';

    // Generate cache key including responseFormat
    const filterHash = hashFilters(input.filters);
    const cacheKey = `${cacheKeys.searchVaults({ filterHash })}:${pagination.first}:${pagination.skip}:${input.orderBy}:${input.orderDirection}:${responseFormat}`;

    // Register cache tags for invalidation
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT]);

    // Create executor with dynamic query based on responseFormat
    const query = createSearchVaultsQuery(responseFormat);

    const executor = executeToolWithCache<
      SearchVaultsInput,
      SearchVaultsResponse,
      SearchVaultsVariables
    >({
      container,
      cacheKey: () => cacheKey,
      cacheTTL: cacheTTL.searchResults,
      query,
      variables: () => {
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

    // Execute query
    const result = await executor(input);

    // NEW: Fragment-level caching - cache each vault individually for reuse
    // This enables vault_data tool to reuse vaults from search results
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const responseData = JSON.parse(result.content[0].text) as {
          vaults?: { items?: VaultData[] };
        };
        if (responseData.vaults?.items) {
          // Cache each vault individually with vault-specific key
          responseData.vaults.items.forEach((vault: VaultData & { chain: { id: number } }) => {
            if (vault.address && vault.chain?.id) {
              const vaultCacheKey = generateCacheKey(CacheTag.VAULT, {
                address: vault.address,
                chainId: vault.chain.id,
              });
              container.cache.set(vaultCacheKey, vault, cacheTTL.vaultData);
            }
          });
        }
      } catch (error) {
        // If parsing fails, just return the result without fragment caching
        // This is a non-critical optimization
      }
    }

    return result;
  };
}
