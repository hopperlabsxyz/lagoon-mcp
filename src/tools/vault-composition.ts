/**
 * get_vault_composition Tool
 *
 * Fetch vault protocol and token composition with diversification analysis.
 * Provides breakdown by protocol and by position/token.
 *
 * Use cases:
 * - Understanding vault protocol exposure
 * - Analyzing diversification levels via HHI score
 * - Identifying concentration risks
 * - Portfolio composition visualization
 *
 * Cache strategy:
 * - 15-minute TTL aligned with vault data freshness
 * - Cache key: composition:{address}
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetVaultCompositionInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { CompositionData } from '../graphql/fragments/index.js';
import { GET_VAULT_COMPOSITION_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';

/**
 * GraphQL response type for composition query
 */
interface VaultCompositionResponse {
  vaultComposition: CompositionData | null;
}

/**
 * GraphQL variables type for composition query
 */
interface GetVaultCompositionVariables {
  vaultAddress: string;
}

/**
 * HHI (Herfindahl-Hirschman Index) calculation for diversification analysis
 * Lower HHI = more diversified, Higher HHI = more concentrated
 *
 * HHI ranges (using market concentration thresholds):
 * - < 0.15: High diversification (well-diversified)
 * - 0.15 - 0.25: Moderate concentration
 * - > 0.25: High concentration
 *
 * @param compositions - Array of protocol compositions with repartition percentages
 * @returns HHI score between 0 and 1
 */
function calculateHHI(compositions: Array<{ repartition: number }>): number {
  if (compositions.length === 0) return 0;

  // HHI = sum of squared market shares (repartition is already in percentage, divide by 100)
  return compositions.reduce((sum, c) => sum + Math.pow(c.repartition / 100, 2), 0);
}

/**
 * Get diversification level label based on HHI score
 */
function getDiversificationLevel(hhi: number): 'High' | 'Medium' | 'Low' {
  if (hhi < 0.15) return 'High';
  if (hhi < 0.25) return 'Medium';
  return 'Low';
}

/**
 * Enhanced composition response with analysis
 */
interface EnhancedCompositionResponse {
  vaultAddress: string;
  compositions: CompositionData['compositions'];
  tokenCompositions: CompositionData['tokenCompositions'];
  analysis: {
    protocolCount: number;
    positionCount: number;
    hhi: number;
    diversificationLevel: 'High' | 'Medium' | 'Low';
    topProtocol: string | null;
    topProtocolPercent: number | null;
    hasOtherCategory: boolean;
  };
}

/**
 * Transform raw composition data into enhanced response with analysis
 */
function transformToEnhancedResponse(
  data: VaultCompositionResponse,
  vaultAddress: string
): EnhancedCompositionResponse {
  const composition = data.vaultComposition;

  if (!composition) {
    return {
      vaultAddress,
      compositions: [],
      tokenCompositions: [],
      analysis: {
        protocolCount: 0,
        positionCount: 0,
        hhi: 0,
        diversificationLevel: 'High',
        topProtocol: null,
        topProtocolPercent: null,
        hasOtherCategory: false,
      },
    };
  }

  const { compositions, tokenCompositions } = composition;

  // Calculate HHI from protocol compositions (excluding "Other" for accurate HHI)
  const mainCompositions = compositions.filter((c) => c.protocol !== 'Other');
  const hhi = calculateHHI(mainCompositions);
  const diversificationLevel = getDiversificationLevel(hhi);

  // Find top protocol
  const topProtocol =
    mainCompositions.length > 0
      ? mainCompositions.reduce((max, c) => (c.repartition > max.repartition ? c : max))
      : null;

  // Check for "Other" category
  const hasOtherCategory = compositions.some((c) => c.protocol === 'Other');

  return {
    vaultAddress,
    compositions,
    tokenCompositions,
    analysis: {
      protocolCount: mainCompositions.length,
      positionCount: tokenCompositions.filter((t) => t.symbol !== 'Other').length,
      hhi: parseFloat(hhi.toFixed(4)),
      diversificationLevel,
      topProtocol: topProtocol?.protocol ?? null,
      topProtocolPercent: topProtocol?.repartition ?? null,
      hasOtherCategory,
    },
  };
}

/**
 * Create the executeGetVaultComposition function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteGetVaultComposition(
  container: ServiceContainer
): (input: GetVaultCompositionInput) => Promise<CallToolResult> {
  return async (input: GetVaultCompositionInput): Promise<CallToolResult> => {
    // Check fragment-level cache first
    const fragmentCacheKey = cacheKeys.composition(input.vaultAddress);
    const cachedComposition = container.cache.get<EnhancedCompositionResponse>(fragmentCacheKey);

    if (cachedComposition) {
      return createSuccessResponse(cachedComposition);
    }

    // Capture vaultAddress for use in transformResult closure
    const vaultAddress = input.vaultAddress;

    // Cache miss - execute GraphQL query with standard caching
    const executor = executeToolWithCache<
      GetVaultCompositionInput,
      VaultCompositionResponse,
      GetVaultCompositionVariables,
      EnhancedCompositionResponse
    >({
      container,
      cacheKey: () => cacheKeys.composition(vaultAddress),
      cacheTTL: cacheTTL.composition,
      query: GET_VAULT_COMPOSITION_QUERY,
      variables: (toolInput) => ({
        vaultAddress: toolInput.vaultAddress,
      }),
      validateResult: (data) => {
        // Composition might be null if vault doesn't have data yet - that's okay
        return {
          valid: true,
          message: data.vaultComposition
            ? undefined
            : 'No composition data available for this vault',
          isError: false,
        };
      },
      transformResult: (data) => transformToEnhancedResponse(data, vaultAddress),
      toolName: 'get_vault_composition',
    });

    // Register cache tags for invalidation
    container.cacheInvalidator.register(fragmentCacheKey, [CacheTag.VAULT]);

    const result = await executor(input);

    // Add legal disclaimer to output
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('vault_composition');
    }

    return result;
  };
}
