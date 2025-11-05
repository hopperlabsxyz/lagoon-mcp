/**
 * Cache Service Abstraction
 *
 * Provides interface for caching implementations.
 * Allows swapping cache backends without changing tool code.
 */

import NodeCache from 'node-cache';

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

/**
 * Cache service interface
 * Abstracts away concrete caching implementation
 */
export interface CacheService {
  /**
   * Get cached value
   * @returns Cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined;

  /**
   * Set cache value with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in seconds
   */
  set<T>(key: string, value: T, ttl: number): void;

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean;

  /**
   * Delete cache entry
   */
  del(key: string): void;

  /**
   * Clear all cache entries
   */
  flush(): void;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
}

/**
 * NodeCache adapter implementing CacheService interface
 */
export class NodeCacheAdapter implements CacheService {
  constructor(private cache: NodeCache) {}

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, value, ttl);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  del(key: string): void {
    this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

/**
 * Create NodeCache adapter with configuration
 */
export function createNodeCacheAdapter(options: {
  stdTTL: number;
  checkperiod: number;
  maxKeys: number;
}): CacheService {
  const cache = new NodeCache({
    stdTTL: options.stdTTL,
    checkperiod: options.checkperiod,
    useClones: false, // Performance optimization
    maxKeys: options.maxKeys,
  });

  return new NodeCacheAdapter(cache);
}
