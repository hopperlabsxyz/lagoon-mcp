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
 * Cache TTL configuration by data type (in seconds)
 *
 * TTL Selection Criteria:
 *
 * 1. **Data Volatility**: How frequently the underlying data changes
 *    - High volatility (user actions, market prices) = shorter TTL
 *    - Low volatility (configuration, historical data) = longer TTL
 *
 * 2. **User Expectations**: How "fresh" users expect data to be
 *    - Real-time needs (portfolio values) = shorter TTL
 *    - Historical analysis (past performance) = longer TTL
 *
 * 3. **API Load Impact**: Balance between freshness and server load
 *    - Frequently accessed endpoints = moderate TTL for load reduction
 *    - Expensive queries (aggregations) = longer TTL for performance
 *
 * 4. **Data Type Characteristics**:
 *    - Static reference data (schema, glossary) = 24h+
 *    - Analytical results (predictions, risk) = 15-60min
 *    - User-specific data (portfolio) = 5min
 *    - Search/filter results = 10min
 *    - Historical data (performance, prices) = 30min
 */
export const cacheTTL = {
  vaultData: 900, // 15 minutes - vault fundamentals change infrequently
  userPortfolio: 300, // 5 minutes - positions change with user actions
  searchResults: 600, // 10 minutes - discovery queries, balanced freshness
  performance: 1800, // 30 minutes - historical metrics, computation-heavy
  transactions: 300, // 5 minutes - transaction history updates
  schema: 86400, // 24 hours - schema changes require deployment
  comparison: 900, // 15 minutes - derived metrics from vault data
  priceHistory: 1800, // 30 minutes - historical OHLCV data, expensive query
  riskAnalysis: 900, // 15 minutes - multi-factor calculation, moderate cost
  yieldPrediction: 3600, // 60 minutes - ML-based forecast, expensive computation
  portfolioOptimization: 300, // 5 minutes - user-specific, interactive use case
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

  compareVaults: (addresses: string[], chainIds: number[]): string => {
    const sortedAddresses = [...addresses].sort().join(',');
    const sortedChainIds = [...chainIds].sort((a, b) => a - b).join(',');
    return `compare:${sortedAddresses}:${sortedChainIds}`;
  },

  priceHistory: (address: string, chainId: number, range: string): string =>
    `price_history:${address}:${chainId}:${range}`,
};

/**
 * Generate cache key based on cache tag and parameters
 *
 * NEW: Generic cache key generator for fragment-level caching
 * Used to create consistent cache keys across different tools
 *
 * @param tag - Cache tag identifying the data type
 * @param params - Parameters for cache key generation
 * @returns Generated cache key string
 */
export function generateCacheKey(tag: string, params: Record<string, string | number>): string {
  // For vault data, use the standard vault cache key format
  if (tag === 'VAULT' && 'address' in params && 'chainId' in params) {
    return cacheKeys.vaultData(String(params.address), Number(params.chainId));
  }

  // Generic fallback for other cache keys
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':');

  return `${tag.toLowerCase()}:${sortedParams}`;
}

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
