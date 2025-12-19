/**
 * get_vault_composition Tool
 *
 * Fetch vault protocol composition data from Octav API with diversification analysis.
 * Data is sourced from the backend's vaultComposition endpoint which aggregates
 * positions across DeFi protocols (Spark, Morpho, Yield Basis, etc.).
 *
 * Use cases:
 * - Understanding vault DeFi protocol exposure
 * - Analyzing diversification levels via HHI score
 * - Identifying concentration risks across protocols
 * - Tracking idle assets (wallet protocol)
 * - Portfolio composition visualization
 *
 * Response formats (for token optimization):
 * - summary: Totals + top protocols + analysis (~100 tokens)
 * - protocols: Non-zero protocols only + analysis (~200-500 tokens)
 * - full: All protocol data including raw response (~1000+ tokens)
 *
 * Cache strategy:
 * - 15-minute TTL aligned with vault data freshness
 * - Cache key: composition:{address}
 * - Full data cached, format filtering applied at response time
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetVaultCompositionInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import {
  VaultCompositionFullResponse,
  ProtocolCompositionData,
} from '../graphql/fragments/index.js';
import { GET_VAULT_COMPOSITION_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';

/**
 * Response format type for composition queries
 * - summary: Totals + top protocols (~100 tokens)
 * - protocols: Non-zero protocols only (~200-500 tokens)
 * - full: All protocol data (~1000+ tokens)
 */
type CompositionResponseFormat = 'summary' | 'protocols' | 'full';

/**
 * GraphQL response type for composition query
 * Note: Backend returns JSONObject, typed as VaultCompositionFullResponse
 */
interface VaultCompositionResponse {
  vaultComposition: VaultCompositionFullResponse | null;
}

/**
 * GraphQL variables type for composition query
 * Note: Backend uses walletAddress parameter (the vault's address)
 */
interface GetVaultCompositionVariables {
  walletAddress: string;
}

/**
 * Processed protocol summary with calculated percentages
 */
interface ProtocolSummary {
  /** Protocol key/identifier (e.g., "spark", "morphoblue") */
  protocolKey: string;
  /** Protocol display name (e.g., "Spark", "Morpho") */
  protocolName: string;
  /** Total USD value in this protocol */
  valueUsd: number;
  /** Percentage of total portfolio */
  percentage: number;
  /** Position types in this protocol (e.g., ["LENDING", "YIELD"]) */
  positionTypes: string[];
  /** Number of chains this protocol is deployed on */
  chainCount: number;
}

/**
 * Composition analysis metrics (protocol-based)
 */
interface CompositionAnalysis {
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** Number of active DeFi protocols (excluding wallet) */
  activeProtocolCount: number;
  /** Top protocol by value */
  topProtocol: ProtocolSummary | null;
  /** HHI score for protocol concentration (0-1, lower = more diversified) */
  hhi: number;
  /** Diversification level based on HHI */
  diversificationLevel: 'High' | 'Medium' | 'Low';
  /** Percentage of assets in "wallet" (idle, not deployed in DeFi) */
  idleAssetsPercent: number;
}

/**
 * Full composition data (cached internally, filtered for responses)
 */
interface FullCompositionData {
  vaultAddress: string;
  networth: string;
  rawData: VaultCompositionFullResponse;
  protocols: ProtocolSummary[];
  analysis: CompositionAnalysis;
}

/**
 * Summary response format (~100 tokens)
 */
interface SummaryResponse {
  vaultAddress: string;
  analysis: CompositionAnalysis;
  topProtocols: ProtocolSummary[];
}

/**
 * Protocols response format (~200-500 tokens)
 */
interface ProtocolsResponse {
  vaultAddress: string;
  protocols: ProtocolSummary[];
  analysis: CompositionAnalysis;
}

/**
 * Full response format (~1000+ tokens)
 */
interface FullResponse {
  vaultAddress: string;
  networth: string;
  rawData: VaultCompositionFullResponse;
  protocols: ProtocolSummary[];
  analysis: CompositionAnalysis;
}

type CompositionOutput = SummaryResponse | ProtocolsResponse | FullResponse;

/**
 * HHI (Herfindahl-Hirschman Index) calculation for diversification analysis
 * Lower HHI = more diversified, Higher HHI = more concentrated
 *
 * HHI ranges (using market concentration thresholds):
 * - < 0.15: High diversification (well-diversified)
 * - 0.15 - 0.25: Moderate concentration
 * - > 0.25: High concentration
 *
 * Note: "wallet" protocol (idle assets) is EXCLUDED from HHI calculation
 * as it represents undeployed capital, not DeFi protocol concentration.
 *
 * @param protocols - Array of protocol summaries with percentage values (excluding wallet)
 * @returns HHI score between 0 and 1
 */
function calculateHHI(protocols: ProtocolSummary[]): number {
  if (protocols.length === 0) return 0;

  // HHI = sum of squared market shares (percentage/100 to get decimal)
  return protocols.reduce((sum, p) => sum + Math.pow(p.percentage / 100, 2), 0);
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
 * Extract position types from a protocol's chain data
 *
 * @param protocol - Protocol composition data
 * @returns Array of unique position type names (e.g., ["LENDING", "YIELD"])
 */
function extractPositionTypes(protocol: ProtocolCompositionData): string[] {
  const positionTypes = new Set<string>();

  for (const chainData of Object.values(protocol.chains)) {
    if (chainData.protocolPositions) {
      for (const positionKey of Object.keys(chainData.protocolPositions)) {
        positionTypes.add(positionKey);
      }
    }
  }

  return Array.from(positionTypes);
}

/**
 * Transform raw Octav API response into structured protocol composition data
 *
 * @param raw - Raw VaultCompositionFullResponse with assetByProtocols
 * @param vaultAddress - Vault address for reference
 * @returns Full composition data with protocol-based analysis
 */
function transformRawComposition(
  raw: VaultCompositionFullResponse | null,
  vaultAddress: string
): FullCompositionData {
  // Handle null/empty response
  if (!raw || !raw.assetByProtocols || Object.keys(raw.assetByProtocols).length === 0) {
    return {
      vaultAddress,
      networth: '0',
      rawData: raw || { address: vaultAddress, networth: '0', assetByProtocols: {}, chains: {} },
      protocols: [],
      analysis: {
        totalValueUsd: 0,
        activeProtocolCount: 0,
        topProtocol: null,
        hhi: 0,
        diversificationLevel: 'High',
        idleAssetsPercent: 0,
      },
    };
  }

  // 1. Filter out protocols with value "0" or empty and transform to ProtocolSummary
  const allProtocols: ProtocolSummary[] = Object.entries(raw.assetByProtocols)
    .filter(([, protocol]: [string, ProtocolCompositionData]) => {
      const value = parseFloat(protocol.value);
      return !isNaN(value) && value > 0;
    })
    .map(([key, protocol]: [string, ProtocolCompositionData]) => ({
      protocolKey: key,
      protocolName: protocol.name,
      valueUsd: parseFloat(protocol.value),
      percentage: 0, // Calculate after total
      positionTypes: extractPositionTypes(protocol),
      chainCount: Object.keys(protocol.chains).length,
    }));

  // 2. Calculate total value (including wallet)
  const totalValueUsd = allProtocols.reduce((sum, p) => sum + p.valueUsd, 0);

  // 3. Calculate percentages for all protocols
  allProtocols.forEach((p) => {
    p.percentage = totalValueUsd > 0 ? (p.valueUsd / totalValueUsd) * 100 : 0;
  });

  // 4. Sort by value descending
  allProtocols.sort((a, b) => b.valueUsd - a.valueUsd);

  // 5. Separate wallet (idle assets) from DeFi protocols for HHI calculation
  const walletProtocol = allProtocols.find((p) => p.protocolKey === 'wallet');
  const defiProtocols = allProtocols.filter((p) => p.protocolKey !== 'wallet');

  // 6. Recalculate percentages for DeFi protocols only (for HHI)
  const defiTotalValue = defiProtocols.reduce((sum, p) => sum + p.valueUsd, 0);
  const defiProtocolsForHHI = defiProtocols.map((p) => ({
    ...p,
    // Recalculate percentage based on DeFi-only total for HHI
    percentage: defiTotalValue > 0 ? (p.valueUsd / defiTotalValue) * 100 : 0,
  }));

  // 7. Calculate HHI (excluding wallet)
  const hhi = calculateHHI(defiProtocolsForHHI);

  // 8. Calculate idle assets percentage
  const idleAssetsPercent = walletProtocol
    ? totalValueUsd > 0
      ? (walletProtocol.valueUsd / totalValueUsd) * 100
      : 0
    : 0;

  return {
    vaultAddress,
    networth: raw.networth || totalValueUsd.toFixed(2),
    rawData: raw,
    protocols: allProtocols, // Include all protocols (wallet included for transparency)
    analysis: {
      totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
      activeProtocolCount: defiProtocols.length, // DeFi protocols only
      topProtocol: defiProtocols[0] || null, // Top DeFi protocol (not wallet)
      hhi: parseFloat(hhi.toFixed(4)),
      diversificationLevel: getDiversificationLevel(hhi),
      idleAssetsPercent: parseFloat(idleAssetsPercent.toFixed(2)),
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
        topProtocols: data.protocols.slice(0, 5), // Top 5 protocols for summary
      } as SummaryResponse;

    case 'protocols':
      return {
        vaultAddress: data.vaultAddress,
        protocols: data.protocols, // Only non-zero protocols (already filtered)
        analysis: data.analysis,
      } as ProtocolsResponse;

    case 'full':
    default:
      return {
        vaultAddress: data.vaultAddress,
        networth: data.networth,
        rawData: data.rawData,
        protocols: data.protocols,
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
