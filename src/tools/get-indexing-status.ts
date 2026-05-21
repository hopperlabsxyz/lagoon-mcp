/**
 * get_indexing_status Tool
 *
 * Returns the last indexed block per chain. Lets a downstream analysis
 * detect stale data BEFORE reporting wrong APR/TVL.
 *
 * Use cases:
 * - Health check before running predict_yield / analyze_risk
 * - Diagnose "why does TVL look off" — chain may be lagging
 *
 * Cache: cacheTTL.indexingStatus (60s — indexing state changes block-by-block).
 *
 * Cache-tag note: indexer state is global, not per-vault. Intentionally
 * exempted from CacheTag.VAULT.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetIndexingStatusInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { GET_INDEXING_STATUS_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { cacheTTL } from '../cache/index.js';

interface IndexedBlock {
  chainId: number;
  number: string;
  hash: string;
  parentHash: string;
  chain: { id: string; name: string; nativeToken: string } | null;
}

interface IndexingStatusResponse {
  _meta: {
    lastIndexedBlocks: IndexedBlock[];
  };
}

export function createExecuteGetIndexingStatus(
  container: ServiceContainer
): (input: GetIndexingStatusInput) => Promise<CallToolResult> {
  const executor = executeToolWithCache<
    GetIndexingStatusInput,
    IndexingStatusResponse,
    { chainIds: number[] | null },
    { lastIndexedBlocks: IndexedBlock[] }
  >({
    container,
    cacheKey: (input) =>
      `indexing:${input.chainIds ? [...input.chainIds].sort((a, b) => a - b).join(',') : 'all'}`,
    cacheTTL: cacheTTL.indexingStatus,
    query: GET_INDEXING_STATUS_QUERY,
    variables: (input) => ({ chainIds: input.chainIds ?? null }),
    transformResult: (data) => ({ lastIndexedBlocks: data._meta.lastIndexedBlocks }),
    toolName: 'get_indexing_status',
  });

  return async (input: GetIndexingStatusInput): Promise<CallToolResult> => {
    const result = await executor(input);
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('get_indexing_status');
    }
    return result;
  };
}
