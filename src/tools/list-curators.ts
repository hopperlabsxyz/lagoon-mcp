/**
 * list_curators Tool
 *
 * Returns the curator directory: name, id, logo, description, website.
 * Lets the LLM resolve "which curators are on Lagoon?" without scanning all
 * vaults.
 *
 * Cache: 15 minutes (curator metadata changes infrequently).
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ListCuratorsInput } from '../utils/validators.js';
import { LIST_CURATORS_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
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

export function createExecuteListCurators(
  container: ServiceContainer
): (input: ListCuratorsInput) => Promise<CallToolResult> {
  return executeToolWithCache<
    ListCuratorsInput,
    ListCuratorsResponse,
    ListCuratorsVariables,
    ListCuratorsResponse['curators']
  >({
    container,
    cacheKey: (input) => {
      const first = input.pagination?.first ?? 100;
      const skip = input.pagination?.skip ?? 0;
      return `curators:${first}:${skip}:${input.isVisible ?? 'any'}`;
    },
    cacheTTL: cacheTTL.vaultData,
    query: LIST_CURATORS_QUERY,
    variables: (input) => ({
      first: input.pagination?.first ?? 100,
      skip: input.pagination?.skip ?? 0,
      where: input.isVisible == null ? null : { isVisible_eq: input.isVisible },
    }),
    transformResult: (data) => data.curators,
    toolName: 'list_curators',
  });
}
