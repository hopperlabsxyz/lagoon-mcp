/**
 * Cache Invalidation System
 *
 * Tag-based cache invalidation for maintaining consistency.
 * When data changes, invalidate all related cache entries by tag.
 */

import type { CacheService } from './cache-adapter.js';

/**
 * Cache tags for organizing related entries
 */
export enum CacheTag {
  VAULT = 'vault',
  PORTFOLIO = 'portfolio',
  TRANSACTION = 'transaction',
  ANALYTICS = 'analytics',
  APR = 'apr',
  RISK = 'risk',
  ALL = 'all',
}

/**
 * Mapping of cache keys to their tags
 */
type CacheTagMap = Map<string, Set<CacheTag>>;

/**
 * Cache invalidation coordinator
 */
export class CacheInvalidator {
  private tagMap: CacheTagMap = new Map();

  constructor(private cache: CacheService) {}

  /**
   * Register a cache key with its associated tags.
   * Also prunes stale entries (keys expired from cache but still in tagMap).
   */
  register(key: string, tags: CacheTag[]): void {
    // Opportunistic pruning: remove stale tagMap entries on every 50th register
    if (this.tagMap.size > 0 && this.tagMap.size % 50 === 0) {
      this.pruneExpired();
    }

    const tagSet = this.tagMap.get(key) || new Set();
    tags.forEach((tag) => tagSet.add(tag));
    this.tagMap.set(key, tagSet);
  }

  /**
   * Remove tagMap entries for keys that no longer exist in the cache.
   * Prevents unbounded tagMap growth from TTL-expired entries.
   */
  pruneExpired(): void {
    for (const key of this.tagMap.keys()) {
      if (!this.cache.has(key)) {
        this.tagMap.delete(key);
      }
    }
  }

  /**
   * Invalidate all cache entries with the given tag
   */
  invalidateByTag(tag: CacheTag): number {
    let invalidated = 0;

    for (const [key, tags] of this.tagMap.entries()) {
      if (tags.has(tag) || tag === CacheTag.ALL) {
        this.cache.del(key);
        this.tagMap.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate multiple tags at once
   */
  invalidateByTags(tags: CacheTag[]): number {
    let invalidated = 0;

    for (const tag of tags) {
      invalidated += this.invalidateByTag(tag);
    }

    return invalidated;
  }

  /**
   * Invalidate a specific cache key
   */
  invalidateKey(key: string): boolean {
    this.cache.del(key);
    return this.tagMap.delete(key);
  }

  /**
   * Clear all cache entries
   */
  invalidateAll(): void {
    this.cache.flush();
    this.tagMap.clear();
  }

  /**
   * Get all keys associated with a tag
   */
  getKeysByTag(tag: CacheTag): string[] {
    const keys: string[] = [];

    for (const [key, tags] of this.tagMap.entries()) {
      if (tags.has(tag)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Get cache statistics with tag information
   */
  getStats(): {
    totalKeys: number;
    tagCount: number;
    keysByTag: Record<string, number>;
  } {
    const keysByTag: Record<string, number> = {};

    for (const tag of Object.values(CacheTag)) {
      keysByTag[tag] = this.getKeysByTag(tag).length;
    }

    return {
      totalKeys: this.tagMap.size,
      tagCount: Object.keys(CacheTag).length,
      keysByTag,
    };
  }
}

/**
 * Example usage relationships
 *
 * When vault data changes:
 * - Invalidate CacheTag.VAULT → clears vault data, apr, risk analysis
 *
 * When portfolio is rebalanced:
 * - Invalidate CacheTag.PORTFOLIO → clears portfolio optimization
 *
 * When transaction occurs:
 * - Invalidate [CacheTag.VAULT, CacheTag.ANALYTICS] → clears affected data
 */
