/**
 * get_curator Tool
 *
 * Returns a single curator's metadata. Pair with `search_vaults` (filter by
 * `curatorIds_contains`) to enumerate the curator's vaults.
 *
 * Cache: 15 minutes.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetCuratorInput } from '../utils/validators.js';
import { GET_CURATOR_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { cacheTTL } from '../cache/index.js';

interface CuratorResponse {
  curator: {
    id: string;
    name: string;
    aboutDescription: string | null;
    logoUrl: string | null;
    url: string | null;
    isVisible: boolean;
  } | null;
}

export function createExecuteGetCurator(
  container: ServiceContainer
): (input: GetCuratorInput) => Promise<CallToolResult> {
  return executeToolWithCache<GetCuratorInput, CuratorResponse, { id: string }, CuratorResponse>({
    container,
    cacheKey: (input) => `curator:${input.curatorId}`,
    cacheTTL: cacheTTL.vaultData,
    query: GET_CURATOR_QUERY,
    variables: (input) => ({ id: input.curatorId }),
    validateResult: (data) => ({
      valid: data.curator !== null,
      message: data.curator ? undefined : `Curator not found: ${data ? 'unknown id' : ''}`,
      isError: false,
    }),
    toolName: 'get_curator',
  });
}
