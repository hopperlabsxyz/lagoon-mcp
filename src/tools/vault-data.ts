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
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { VaultData } from '../graphql/fragments/index.js';
import { GET_VAULT_DATA_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { generateCacheKey } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';

/**
 * Vault data response type using shared VaultData type from fragments
 */
interface VaultDataResponse {
  vaultByAddress: VaultData | null;
}

/**
 * Vault data response with structured fees for easier consumption
 * Values in basis points (100 = 1%, 1000 = 10%)
 */
interface VaultDataResponseWithFees {
  vaultByAddress: VaultData | null;
  fees: {
    managementFee: number;
    performanceFee: number;
  };
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
  return async (input: GetVaultDataInput): Promise<CallToolResult> => {
    // NEW: Check fragment-level cache first (vaults from search_vaults)
    // This enables data reuse across tools without duplicate GraphQL queries
    const fragmentCacheKey = generateCacheKey(CacheTag.VAULT, {
      address: input.vaultAddress,
      chainId: input.chainId,
    });

    const cachedVault = container.cache.get<VaultData>(fragmentCacheKey);
    if (cachedVault) {
      // Cache hit from search_vaults - return immediately without GraphQL query
      // Add structured fees object for easier consumption
      return createSuccessResponse({
        vaultByAddress: cachedVault,
        fees: {
          managementFee: cachedVault.state?.managementFee ?? 0,
          performanceFee: cachedVault.state?.performanceFee ?? 0,
        },
      });
    }

    // Cache miss - execute GraphQL query with standard caching
    const executor = executeToolWithCache<
      GetVaultDataInput,
      VaultDataResponse,
      GetVaultDataVariables,
      VaultDataResponseWithFees
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
      // Transform to add structured fees object for easier consumption
      transformResult: (data) => ({
        vaultByAddress: data.vaultByAddress,
        fees: {
          managementFee: data.vaultByAddress?.state?.managementFee ?? 0,
          performanceFee: data.vaultByAddress?.state?.performanceFee ?? 0,
        },
      }),
      toolName: 'get_vault_data',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.vaultData(input.vaultAddress, input.chainId);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT]);

    const result = await executor(input);

    // Add legal disclaimer to output
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('vault_data');
    }

    return result;
  };
}
