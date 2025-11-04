/**
 * Caching Layer
 *
 * In-memory caching with TTL using node-cache
 */

import NodeCache from 'node-cache';
import { config } from '../config.js';

/**
 * Shared cache instance
 */
export const cache = new NodeCache({
  stdTTL: config.cache.stdTTL,
  checkperiod: config.cache.checkperiod,
  useClones: false, // Performance optimization
  maxKeys: config.cache.maxKeys,
});

/**
 * Cache TTL configuration by data type
 */
export const cacheTTL = {
  vaultData: 900, // 15 minutes - vault data relatively static
  userPortfolio: 300, // 5 minutes - user positions more dynamic
  searchResults: 600, // 10 minutes - search results balanced
  performance: 1800, // 30 minutes - historical data less time-sensitive
  transactions: 900, // 15 minutes - transaction history relatively static
  schema: 86400, // 24 hours - schema rarely changes
} as const;

/**
 * Search filters type for cache key generation
 */
type SearchFilters = {
  filterHash: string;
};

/**
 * Cache key generators
 *
 * Provides consistent cache key formatting for different data types
 */
export const cacheKeys = {
  vaultData: (address: string, chainId: number): string => `vault:${address}:${chainId}`,

  userPortfolio: (address: string): string => `portfolio:${address}`,

  searchVaults: (filters: SearchFilters): string => `search:${filters.filterHash}`,

  vaultPerformance: (address: string, chainId: number, range: string): string =>
    `perf:${address}:${chainId}:${range}`,

  transactions: ({
    vaultAddress,
    chainId,
    filterHash,
    first,
    skip,
    orderBy,
    orderDirection,
  }: {
    vaultAddress: string;
    chainId: number;
    filterHash: string;
    first: number;
    skip: number;
    orderBy: string;
    orderDirection: string;
  }): string =>
    `transactions:${vaultAddress}:${chainId}:${filterHash}:${first}:${skip}:${orderBy}:${orderDirection}`,

  schema: (): string => 'schema:latest',
};

/**
 * Cache statistics
 */
export function getCacheStats(): NodeCache.Stats {
  return cache.getStats();
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.flushAll();
}
