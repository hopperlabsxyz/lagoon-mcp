/**
 * get_vault_composition Tool
 *
 * Fetch vault cross-chain composition data from Octav API with diversification analysis.
 * Data is sourced from the backend's vaultComposition endpoint which aggregates
 * positions across 60+ chains.
 *
 * Use cases:
 * - Understanding vault cross-chain exposure
 * - Analyzing diversification levels via HHI score
 * - Identifying concentration risks across chains
 * - Portfolio composition visualization
 *
 * Response formats (for token optimization):
 * - summary: Totals + top chains + analysis (~100 tokens)
 * - chains: Non-zero chains only + analysis (~200-500 tokens)
 * - full: All chain data including raw response (~1000+ tokens)
 *
 * Cache strategy:
 * - 15-minute TTL aligned with vault data freshness
 * - Cache key: composition:{address}
 * - Full data cached, format filtering applied at response time
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetVaultCompositionInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { RawVaultComposition, ChainComposition } from '../graphql/fragments/index.js';
import { GET_VAULT_COMPOSITION_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';

/**
 * Response format type for composition queries
 */
type CompositionResponseFormat = 'summary' | 'chains' | 'full';

/**
 * GraphQL response type for composition query
 * Note: Backend returns JSONObject, typed as RawVaultComposition
 */
interface VaultCompositionResponse {
  vaultComposition: RawVaultComposition | null;
}

/**
 * GraphQL variables type for composition query
 * Note: Backend uses walletAddress parameter (the vault's address)
 */
interface GetVaultCompositionVariables {
  walletAddress: string;
}

/**
 * Processed chain summary with calculated percentages
 */
interface ChainSummary {
  chainKey: string;
  chainName: string;
  chainId: string;
  valueUsd: number;
  percentage: number;
}

/**
 * Composition analysis metrics
 */
interface CompositionAnalysis {
  totalValueUsd: number;
  activeChainCount: number;
  topChain: ChainSummary | null;
  hhi: number;
  diversificationLevel: 'High' | 'Medium' | 'Low';
}

/**
 * Full composition data (cached internally, filtered for responses)
 */
interface FullCompositionData {
  vaultAddress: string;
  rawData: RawVaultComposition;
  chains: ChainSummary[];
  analysis: CompositionAnalysis;
}

/**
 * Summary response format (~100 tokens)
 */
interface SummaryResponse {
  vaultAddress: string;
  analysis: CompositionAnalysis;
  topChains: ChainSummary[];
}

/**
 * Chains response format (~200-500 tokens)
 */
interface ChainsResponse {
  vaultAddress: string;
  chains: ChainSummary[];
  analysis: CompositionAnalysis;
}

/**
 * Full response format (~1000+ tokens)
 */
interface FullResponse {
  vaultAddress: string;
  rawData: RawVaultComposition;
  chains: ChainSummary[];
  analysis: CompositionAnalysis;
}

type CompositionOutput = SummaryResponse | ChainsResponse | FullResponse;

/**
 * HHI (Herfindahl-Hirschman Index) calculation for diversification analysis
 * Lower HHI = more diversified, Higher HHI = more concentrated
 *
 * HHI ranges (using market concentration thresholds):
 * - < 0.15: High diversification (well-diversified)
 * - 0.15 - 0.25: Moderate concentration
 * - > 0.25: High concentration
 *
 * @param chains - Array of chain summaries with percentage values
 * @returns HHI score between 0 and 1
 */
function calculateHHI(chains: ChainSummary[]): number {
  if (chains.length === 0) return 0;

  // HHI = sum of squared market shares (percentage/100 to get decimal)
  return chains.reduce((sum, c) => sum + Math.pow(c.percentage / 100, 2), 0);
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
 * Transform raw Octav API response into structured composition data
 *
 * @param raw - Raw JSONObject with chains as keys
 * @param vaultAddress - Vault address for reference
 * @returns Full composition data with analysis
 */
function transformRawComposition(
  raw: RawVaultComposition | null,
  vaultAddress: string
): FullCompositionData {
  // Handle null/empty response
  if (!raw || Object.keys(raw).length === 0) {
    return {
      vaultAddress,
      rawData: {},
      chains: [],
      analysis: {
        totalValueUsd: 0,
        activeChainCount: 0,
        topChain: null,
        hhi: 0,
        diversificationLevel: 'High',
      },
    };
  }

  // 1. Filter out chains with value "0" or empty and transform to ChainSummary
  const activeChains: ChainSummary[] = Object.entries(raw)
    .filter(([, chain]: [string, ChainComposition]) => {
      const value = parseFloat(chain.value);
      return !isNaN(value) && value > 0;
    })
    .map(([key, chain]: [string, ChainComposition]) => ({
      chainKey: key,
      chainName: chain.name,
      chainId: chain.chainId,
      valueUsd: parseFloat(chain.value),
      percentage: 0, // Calculate after total
    }));

  // 2. Calculate total and percentages
  const totalValueUsd = activeChains.reduce((sum, c) => sum + c.valueUsd, 0);
  activeChains.forEach((c) => {
    c.percentage = totalValueUsd > 0 ? (c.valueUsd / totalValueUsd) * 100 : 0;
  });

  // 3. Sort by value descending
  activeChains.sort((a, b) => b.valueUsd - a.valueUsd);

  // 4. Calculate HHI
  const hhi = calculateHHI(activeChains);

  return {
    vaultAddress,
    rawData: raw,
    chains: activeChains,
    analysis: {
      totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
      activeChainCount: activeChains.length,
      topChain: activeChains[0] || null,
      hhi: parseFloat(hhi.toFixed(4)),
      diversificationLevel: getDiversificationLevel(hhi),
    },
  };
}

/**
 * Filter full data based on requested response format
 *
 * @param data - Full composition data
 * @param format - Requested response format
 * @returns Filtered response based on format
 */
function filterByFormat(
  data: FullCompositionData,
  format: CompositionResponseFormat
): CompositionOutput {
  switch (format) {
    case 'summary':
      return {
        vaultAddress: data.vaultAddress,
        analysis: data.analysis,
        topChains: data.chains.slice(0, 5), // Top 5 chains for summary
      } as SummaryResponse;

    case 'chains':
      return {
        vaultAddress: data.vaultAddress,
        chains: data.chains, // Only non-zero chains (already filtered)
        analysis: data.analysis,
      } as ChainsResponse;

    case 'full':
    default:
      return {
        vaultAddress: data.vaultAddress,
        rawData: data.rawData,
        chains: data.chains,
        analysis: data.analysis,
      } as FullResponse;
  }
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
    const responseFormat = (input.responseFormat ?? 'summary') as CompositionResponseFormat;
    const vaultAddress = input.vaultAddress;

    // Check fragment-level cache first (always cache full data)
    const fragmentCacheKey = cacheKeys.composition(vaultAddress);
    const cachedComposition = container.cache.get<FullCompositionData>(fragmentCacheKey);

    if (cachedComposition) {
      // Apply format filtering to cached data
      const filteredResponse = filterByFormat(cachedComposition, responseFormat);
      return createSuccessResponse(filteredResponse);
    }

    // Cache miss - execute GraphQL query with standard caching
    const executor = executeToolWithCache<
      GetVaultCompositionInput,
      VaultCompositionResponse,
      GetVaultCompositionVariables,
      FullCompositionData
    >({
      container,
      cacheKey: () => fragmentCacheKey,
      cacheTTL: cacheTTL.composition,
      query: GET_VAULT_COMPOSITION_QUERY,
      variables: () => ({
        walletAddress: vaultAddress,
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
      transformResult: (data) => transformRawComposition(data.vaultComposition, vaultAddress),
      toolName: 'get_vault_composition',
    });

    // Register cache tags for invalidation
    container.cacheInvalidator.register(fragmentCacheKey, [CacheTag.VAULT]);

    const result = await executor(input);

    // If successful, apply format filtering to the response
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const fullData = JSON.parse(result.content[0].text) as FullCompositionData;
        const filteredResponse = filterByFormat(fullData, responseFormat);
        result.content[0].text = JSON.stringify(filteredResponse, null, 2);
      } catch {
        // If parsing fails, leave original response
      }

      // Add legal disclaimer to output
      result.content[0].text = result.content[0].text + getToolDisclaimer('vault_composition');
    }

    return result;
  };
}
