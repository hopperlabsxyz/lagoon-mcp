/**
 * get_curator Tool
 *
 * Returns a single curator's metadata. Pair with `search_vaults` (filter by
 * `curatorIds_contains`) to enumerate the curator's vaults.
 *
 * Cache: 15 minutes (curator metadata changes infrequently).
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetCuratorInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { GET_CURATOR_QUERY } from '../graphql/queries/index.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';
import { handleToolError } from '../utils/tool-error-handler.js';

function jsonResponse(data: unknown, toolName: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2) + getToolDisclaimer(toolName),
      },
    ],
    isError: false,
  };
}

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

/**
 * Detect the backend's "unknown curator" error shape — at production this
 * surfaces as `INTERNAL_SERVER_ERROR` with a message like `Document "X" not
 * found`, rather than `data.curator: null`. Centralizing the heuristic so a
 * future backend change can be addressed in one place.
 */
function isCuratorNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = JSON.stringify(err).toLowerCase();
  return msg.includes('document') && msg.includes('not found');
}

export function createExecuteGetCurator(
  container: ServiceContainer
): (input: GetCuratorInput) => Promise<CallToolResult> {
  return async (input: GetCuratorInput): Promise<CallToolResult> => {
    const cacheKey = `curator:${input.curatorId}`;

    const cached = container.cache.get<CuratorResponse>(cacheKey);
    if (cached) {
      return jsonResponse(cached, 'get_curator');
    }

    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT]);

    try {
      const data = await container.graphqlClient.request<CuratorResponse>(GET_CURATOR_QUERY, {
        id: input.curatorId,
      });

      if (!data.curator) {
        // Defensive: also handle the case where the backend returns null
        // instead of throwing (different schema versions, future changes).
        return {
          content: [{ type: 'text', text: `Curator not found: ${input.curatorId}` }],
          isError: false,
        };
      }

      container.cache.set(cacheKey, data, cacheTTL.vaultData);
      return jsonResponse(data, 'get_curator');
    } catch (err) {
      if (isCuratorNotFoundError(err)) {
        return {
          content: [{ type: 'text', text: `Curator not found: ${input.curatorId}` }],
          isError: false,
        };
      }
      return handleToolError(err, 'get_curator');
    }
  };
}
