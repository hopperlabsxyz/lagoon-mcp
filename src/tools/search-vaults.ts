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
 * - Cache key: search:{MD5 hash of filters}
 * - Repeated searches with same filters hit cache
 * - Cache hit rate target: 70-80%
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createHash } from 'crypto';
import { graphqlClient } from '../graphql/client.js';
import { searchVaultsInputSchema, SearchVaultsInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments.js';

/**
 * Search vaults GraphQL query
 * Supports advanced filtering, pagination, and sorting
 */
const SEARCH_VAULTS_QUERY = `
  query SearchVaults(
    $first: Int!,
    $skip: Int!,
    $orderBy: VaultOrderBy!,
    $orderDirection: OrderDirection!,
    $where: VaultFilterInput
  ) {
    vaults(
      first: $first,
      skip: $skip,
      orderBy: $orderBy,
      orderDirection: $orderDirection,
      where: $where
    ) {
      items {
        ...VaultFragment
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

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
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce(
      (acc, key) => {
        const typedKey = key as keyof NonNullable<SearchVaultsInput['filters']>;
        const value = filters[typedKey];
        if (value !== undefined) {
          acc[typedKey] = value as never;
        }
        return acc;
      },
      {} as NonNullable<SearchVaultsInput['filters']>
    );

  const filterString = JSON.stringify(sortedFilters);
  return createHash('md5').update(filterString).digest('hex');
}

/**
 * Search and filter vaults with advanced criteria
 *
 * @param input - Search filters, pagination, and sorting options
 * @returns Paginated vault results with page info
 */
export async function executeSearchVaults(input: SearchVaultsInput): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = searchVaultsInputSchema.parse(input);

    // Extract parameters with defaults
    const filters = validatedInput.filters;
    const pagination = validatedInput.pagination || { first: 100, skip: 0 };
    const orderBy = validatedInput.orderBy;
    const orderDirection = validatedInput.orderDirection;

    // Generate cache key from filter hash
    const filterHash = hashFilters(filters);
    const cacheKey = `${cacheKeys.searchVaults({ filterHash } as never)}:${pagination.first}:${pagination.skip}:${orderBy}:${orderDirection}`;

    // Check cache first
    const cachedData = cache.get<SearchVaultsResponse>(cacheKey);
    if (cachedData) {
      return createSuccessResponse(cachedData);
    }

    // Build GraphQL filter object
    const whereClause = buildGraphQLFilters(filters);

    // Execute GraphQL query
    const data = await graphqlClient.request<SearchVaultsResponse>(SEARCH_VAULTS_QUERY, {
      first: pagination.first,
      skip: pagination.skip,
      orderBy,
      orderDirection,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    // Handle empty results
    if (!data.vaults || data.vaults.items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No vaults found matching the specified criteria.',
          },
        ],
        isError: false,
      };
    }

    // Store in cache with 10-minute TTL
    cache.set(cacheKey, data, cacheTTL.searchResults);

    // Return successful response
    return createSuccessResponse(data);
  } catch (error) {
    return handleToolError(error, 'search_vaults');
  }
}
