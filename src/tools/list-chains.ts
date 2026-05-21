/**
 * list_chains Tool
 *
 * Returns the Lagoon-supported chains, with factory address & wrapped native
 * token. Lets the LLM discover valid chain IDs instead of guessing.
 *
 * Cache: cacheTTL.schema (24h — chain support changes via deployment).
 *
 * Cache-tag note: chain directory is global, not per-vault. Intentionally
 * exempted from CacheTag.VAULT.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ListChainsInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { LIST_CHAINS_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { cacheTTL } from '../cache/index.js';

interface ChainEntry {
  id: string;
  name: string;
  nativeToken: string;
  logoUrl: string;
  isVisible: boolean;
  factory: string;
  wrappedNativeToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
}

interface ListChainsResponse {
  chains: {
    items: ChainEntry[];
    pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
  };
}

interface ListChainsVariables {
  first: number;
  skip: number;
  where: { isVisible_eq?: boolean } | null;
}

export function createExecuteListChains(
  container: ServiceContainer
): (input: ListChainsInput) => Promise<CallToolResult> {
  // Fallbacks align with paginationFirstSchema's documented default (20)
  // so the cache key matches the GraphQL variables (a mismatch is a
  // cache-poisoning class of bug — different effective page sizes mapping
  // to the same key).
  const executor = executeToolWithCache<
    ListChainsInput,
    ListChainsResponse,
    ListChainsVariables,
    ListChainsResponse['chains']
  >({
    container,
    cacheKey: (input) => {
      const first = input.pagination?.first ?? 20;
      const skip = input.pagination?.skip ?? 0;
      return `chains:${first}:${skip}:${input.isVisible ?? 'any'}`;
    },
    cacheTTL: cacheTTL.schema,
    query: LIST_CHAINS_QUERY,
    variables: (input) => ({
      first: input.pagination?.first ?? 20,
      skip: input.pagination?.skip ?? 0,
      where: input.isVisible == null ? null : { isVisible_eq: input.isVisible },
    }),
    transformResult: (data) => data.chains,
    toolName: 'list_chains',
  });

  return async (input: ListChainsInput): Promise<CallToolResult> => {
    const result = await executor(input);
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('list_chains');
    }
    return result;
  };
}
