/**
 * get_global_tvl Tool
 *
 * Returns the live total value locked across all Lagoon vaults & chains, in USD.
 *
 * Use cases:
 * - "How big is Lagoon?" context for summaries
 * - Headline metric for reports
 *
 * Cache: cacheTTL.globalTvl (5 minutes — TVL ticks slowly but markets move).
 *
 * Cache-tag note: this is a protocol-wide metric, NOT tied to a specific
 * vault — intentionally exempted from CacheTag.VAULT invalidation. A future
 * CacheTag.PROTOCOL_METADATA would be the right home if invalidation needed.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetGlobalTvlInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
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
  const executor = executeToolWithCache<
    GetGlobalTvlInput,
    GlobalTvlResponse,
    Record<string, never>,
    { totalValueLockedUsd: number }
  >({
    container,
    cacheKey: () => 'global:tvl',
    cacheTTL: cacheTTL.globalTvl,
    query: GET_GLOBAL_TVL_QUERY,
    variables: () => ({}),
    transformResult: (data) => ({ totalValueLockedUsd: data.getGlobalTVL }),
    toolName: 'get_global_tvl',
  });

  return async (input: GetGlobalTvlInput): Promise<CallToolResult> => {
    const result = await executor(input);
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('get_global_tvl');
    }
    return result;
  };
}
