/**
 * get_global_tvl Tool
 *
 * Returns the live total value locked across all Lagoon vaults & chains, in USD.
 *
 * Use cases:
 * - "How big is Lagoon?" context for summaries
 * - Headline metric for reports
 *
 * Cache: 5 minutes (matches portfolio TTL — TVL ticks slowly but markets move).
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetGlobalTvlInput } from '../utils/validators.js';
import { GET_GLOBAL_TVL_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { cacheTTL } from '../cache/index.js';

interface GlobalTvlResponse {
  getGlobalTVL: number;
}

export function createExecuteGetGlobalTvl(
  container: ServiceContainer
): (input: GetGlobalTvlInput) => Promise<CallToolResult> {
  return executeToolWithCache<
    GetGlobalTvlInput,
    GlobalTvlResponse,
    Record<string, never>,
    { totalValueLockedUsd: number }
  >({
    container,
    cacheKey: () => 'global:tvl',
    cacheTTL: cacheTTL.userPortfolio,
    query: GET_GLOBAL_TVL_QUERY,
    variables: () => ({}),
    transformResult: (data) => ({ totalValueLockedUsd: data.getGlobalTVL }),
    toolName: 'get_global_tvl',
  });
}
