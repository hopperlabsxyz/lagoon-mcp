/**
 * list_curators Tool
 *
 * Returns the curator directory: name, id, logo, description, website.
 * Lets the LLM resolve "which curators are on Lagoon?" without scanning all
 * vaults.
 *
 * Cache: cacheTTL.vaultData (15 minutes — curator metadata changes infrequently).
 *
 * Cache tag: curator directory is vault-adjacent; registered under
 * CacheTag.VAULT so a flush invalidates both vault data and curator metadata
 * together.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ListCuratorsInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { LIST_CURATORS_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';

interface CuratorEntry {
  id: string;
  name: string;
  aboutDescription: string | null;
  logoUrl: string | null;
  url: string | null;
  isVisible: boolean;
}

interface ListCuratorsResponse {
  curators: {
    items: CuratorEntry[];
    pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
  };
}

interface ListCuratorsVariables {
  first: number;
  skip: number;
  where: { isVisible_eq?: boolean } | null;
}

function cacheKeyFor(input: ListCuratorsInput): string {
  const first = input.pagination?.first ?? 20;
  const skip = input.pagination?.skip ?? 0;
  return `curators:${first}:${skip}:${input.isVisible ?? 'any'}`;
}

export function createExecuteListCurators(
  container: ServiceContainer
): (input: ListCuratorsInput) => Promise<CallToolResult> {
  // Fallbacks align with paginationFirstSchema's documented default (20)
  // so the cache key matches the GraphQL variables.
  const executor = executeToolWithCache<
    ListCuratorsInput,
    ListCuratorsResponse,
    ListCuratorsVariables,
    ListCuratorsResponse['curators']
  >({
    container,
    cacheKey: cacheKeyFor,
    cacheTTL: cacheTTL.vaultData,
    query: LIST_CURATORS_QUERY,
    variables: (input) => ({
      first: input.pagination?.first ?? 20,
      skip: input.pagination?.skip ?? 0,
      where: input.isVisible == null ? null : { isVisible_eq: input.isVisible },
    }),
    transformResult: (data) => data.curators,
    toolName: 'list_curators',
  });

  return async (input: ListCuratorsInput): Promise<CallToolResult> => {
    container.cacheInvalidator.register(cacheKeyFor(input), [CacheTag.VAULT]);
    const result = await executor(input);
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('list_curators');
    }
    return result;
  };
}
