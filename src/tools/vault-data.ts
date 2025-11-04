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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { getVaultDataInputSchema, GetVaultDataInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments.js';
/**
 * Complete vault data GraphQL query
 * Includes ALL available fields for comprehensive vault analysis
 * Schema verified against working API query on 2025-01-04
 */
const GET_VAULT_DATA_QUERY = `
  query GetVaultData($address: Address!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      ...VaultFragment
    }
  }
  ${VAULT_FRAGMENT}
`;

// APRBreakdown type imported from fragments.ts

/**
 * Vault data response type using shared VaultData type from fragments
 */
interface VaultDataResponse {
  vaultByAddress: VaultData | null;
}

/**
 * Fetch complete vault data with caching
 *
 * @param input - Vault address and chain ID
 * @returns Vault data or error
 */
export async function executeGetVaultData(input: GetVaultDataInput): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = getVaultDataInputSchema.parse(input);

    // Generate cache key
    const cacheKey = cacheKeys.vaultData(validatedInput.vaultAddress, validatedInput.chainId);

    // Check cache first
    const cachedData = cache.get<VaultDataResponse>(cacheKey);
    if (cachedData) {
      return createSuccessResponse(cachedData);
    }

    // Execute GraphQL query
    const data = await graphqlClient.request<VaultDataResponse>(GET_VAULT_DATA_QUERY, {
      address: validatedInput.vaultAddress,
      chainId: validatedInput.chainId,
    });

    // Handle vault not found
    if (!data.vaultByAddress) {
      return {
        content: [
          {
            type: 'text',
            text: `Vault not found: ${validatedInput.vaultAddress} on chain ${validatedInput.chainId}`,
          },
        ],
        isError: false, // Not an error, just no data
      };
    }

    // Store in cache with 15-minute TTL
    cache.set(cacheKey, data, cacheTTL.vaultData);

    // Return successful response
    return createSuccessResponse(data);
  } catch (error) {
    return handleToolError(error, 'get_vault_data');
  }
}
