/**
 * Rate Limiter Utilities
 *
 * Provides controlled concurrency for GraphQL requests to prevent 429 rate limit errors.
 * Uses p-limit for efficient promise-based concurrency limiting.
 *
 * Background:
 * The GraphQL API (proxied via Cloudflare) has strict rate limits (~5-10 req/10s).
 * Tools like compare_vaults make multiple parallel requests that can trigger 429 errors.
 * These utilities limit concurrent requests to stay within rate limits.
 */

import pLimit from 'p-limit';

/**
 * Default concurrency limit for GraphQL requests.
 * Conservative value to respect ~5-10 req/10s rate limit.
 */
export const DEFAULT_CONCURRENCY = 2;

/**
 * Type for the p-limit limiter function.
 */
export type Limiter = ReturnType<typeof pLimit>;

/**
 * Creates a rate limiter instance with the specified concurrency.
 *
 * @param concurrency - Maximum number of concurrent operations (default: 2)
 * @returns A p-limit limiter function
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter(2);
 * const results = await Promise.all(
 *   items.map(item => limiter(() => fetchData(item)))
 * );
 * ```
 */
export function createRateLimiter(concurrency: number = DEFAULT_CONCURRENCY): Limiter {
  return pLimit(concurrency);
}

/**
 * Maps over an array with rate-limited concurrency.
 *
 * This is the primary utility for converting unbounded Promise.all patterns
 * to rate-limited parallel execution. Maintains order of results.
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum concurrent operations (default: 2)
 * @returns Promise resolving to array of results in same order as input
 *
 * @example
 * ```typescript
 * // Before: Unbounded parallel (causes 429 errors)
 * const results = await Promise.all(
 *   vaults.map(v => fetchComposition(v.address))
 * );
 *
 * // After: Rate-limited parallel (max 2 concurrent)
 * const results = await rateLimitedMap(
 *   vaults,
 *   v => fetchComposition(v.address),
 *   2
 * );
 * ```
 */
export async function rateLimitedMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<R[]> {
  const limiter = pLimit(concurrency);
  return Promise.all(items.map((item, index) => limiter(() => fn(item, index))));
}

/**
 * Shared rate limiter for GraphQL composition queries.
 * Used across tools that query the Octav API (vault composition).
 *
 * @example
 * ```typescript
 * import { compositionLimiter } from '../utils/rate-limiter.js';
 *
 * const results = await Promise.all(
 *   vaults.map(v => compositionLimiter(() => fetchComposition(v.address)))
 * );
 * ```
 */
export const compositionLimiter = createRateLimiter(DEFAULT_CONCURRENCY);
