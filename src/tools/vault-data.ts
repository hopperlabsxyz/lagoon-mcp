/**
 * get_vault_data Tool
 *
 * Fetch complete vault information with 15-minute caching.
 * Optimized for detailed analysis of 1-5 vaults.
 *
 * Use cases:
 * - Detailed vault analysis with all fields
 * - Single or small set of vaults (1-5)
 * - Repeated queries for same vault data
 * - Performance: ~500 tokens per vault
 *
 * Cache strategy:
 * - 15-minute TTL for balance between freshness and performance
 * - Cache key: vault:{address}:{chainId}
 * - Cache hit rate target: 80-90%
 * - Cache tags: [CacheTag.VAULT] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetVaultDataInput } from '../utils/validators.js';
import { VaultData } from '../graphql/fragments/index.js';
import { GET_VAULT_DATA_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';

/**
 * Vault data response type using shared VaultData type from fragments
 */
interface VaultDataResponse {
  vaultByAddress: VaultData | null;
}

/**
 * Create the executeGetVaultData function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
/**
 * GraphQL variables type for GET_VAULT_DATA_QUERY
 */
interface GetVaultDataVariables {
  address: string;
  chainId: number;
}

export function createExecuteGetVaultData(
  container: ServiceContainer
): (input: GetVaultDataInput) => Promise<CallToolResult> {
  const executor = executeToolWithCache<
    GetVaultDataInput,
    VaultDataResponse,
    GetVaultDataVariables
  >({
    container,
    cacheKey: (input) => cacheKeys.vaultData(input.vaultAddress, input.chainId),
    cacheTTL: cacheTTL.vaultData,
    query: GET_VAULT_DATA_QUERY,
    variables: (input) => ({
      address: input.vaultAddress,
      chainId: input.chainId,
    }),
    validateResult: (data) => ({
      valid: !!data.vaultByAddress,
      message: data.vaultByAddress
        ? undefined
        : `Vault not found: address ${String(data)} on requested chain`,
    }),
    toolName: 'get_vault_data',
  });

  // Register cache tags for invalidation
  return (input: GetVaultDataInput) => {
    const cacheKey = cacheKeys.vaultData(input.vaultAddress, input.chainId);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT]);
    return executor(input);
  };
}
