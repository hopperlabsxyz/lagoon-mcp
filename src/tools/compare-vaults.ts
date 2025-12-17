/**
 * compare_vaults Tool
 *
 * Side-by-side comparison of multiple vaults with normalized metrics and rankings.
 * Supports comparing 2-10 vaults simultaneously across one or multiple chains.
 *
 * Use cases:
 * - Evaluate investment opportunities across similar vaults
 * - Identify best/worst performers in a category
 * - Cross-chain vault comparison (e.g., Ethereum vs Base vs Avalanche)
 * - Risk-adjusted return analysis
 * - Performance: ~300 tokens per vault
 *
 * Cache strategy:
 * - 15-minute TTL for comparison results
 * - Cache key: compare:{sorted_addresses}:{sorted_chainIds}
 * - Cache hit rate target: 70-80%
 * - Cache tags: [CacheTag.VAULT, CacheTag.ANALYTICS] for invalidation
 *
 * Multi-chain support:
 * - Accepts either single `chainId` (backward compatible) or `chainIds` array
 * - Single chainId is automatically converted to array internally
 * - GraphQL query uses `chainId_in` filter for cross-chain queries
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CompareVaultsInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { VaultData } from '../graphql/fragments/index.js';
import { COMPARE_VAULTS_QUERY } from '../graphql/queries/index.js';
import {
  VaultComparisonData,
  normalizeAndRankVaults,
  generateComparisonSummary,
  formatComparisonTable,
  ComparisonSummary,
} from '../utils/comparison-metrics.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { analyzeRisk } from '../utils/risk-scoring.js';

/**
 * GraphQL response type
 */
interface CompareVaultsResponse {
  vaults: {
    items: VaultData[];
  };
}

/**
 * GraphQL variables type for COMPARE_VAULTS_QUERY
 */
interface CompareVaultsVariables {
  addresses: string[];
  chainIds: number[];
}

/**
 * Structured vault data for UI block rendering
 * Contains all fields needed to construct comparison blocks without additional API calls
 */
interface StructuredVaultData {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  logoUrl: string | null;
  asset: string;
  tvl: string; // Pre-formatted e.g. "$1.2M"
  tvlUsd: number; // Raw USD value for calculations
  apr: string; // Pre-formatted e.g. "12.5%"
  aprValue: number; // Raw value (decimal) for calculations
  curator: string | null;
  risk: 'low' | 'medium' | 'high' | 'critical' | null;
  fees: {
    managementFee: number; // Basis points (100 = 1%)
    performanceFee: number; // Basis points (1000 = 10%)
  };
}

/**
 * Comparison output with markdown and structured vault data
 * markdown: Human-readable comparison for display
 * vaults: Structured data for UI block construction (avoids parsing markdown)
 */
interface CompareVaultsOutput {
  markdown: string;
  vaults: StructuredVaultData[];
}

/**
 * Convert VaultData to VaultComparisonData for metrics calculation
 * Now includes 12-factor risk analysis
 * chainId is extracted from vault.chain.id for cross-chain support
 */
function convertToComparisonData(vault: VaultData, allVaults: VaultData[]): VaultComparisonData {
  // Extract chainId from vault data for cross-chain support
  const chainId = vault.chain?.id ?? 0;
  // Extract APR from nested state structure with proper null checking
  // Use weekly or monthly linearNetApr as the primary APR metric
  const weeklyApr = vault.state?.weeklyApr?.linearNetApr;
  const monthlyApr = vault.state?.monthlyApr?.linearNetApr;
  const apr =
    typeof weeklyApr === 'number' ? weeklyApr : typeof monthlyApr === 'number' ? monthlyApr : 0;

  const tvl = vault.state?.totalAssetsUsd;

  // Calculate risk score using existing risk analysis utility
  let riskBreakdown;
  try {
    // Extract data for risk calculation
    const vaultTVL = typeof tvl === 'number' ? tvl : 0;
    const totalProtocolTVL = allVaults.reduce((sum, v) => sum + (v.state?.totalAssetsUsd || 0), 0);

    // Age in days - default to 180 days (6 months) as we don't have creation timestamp
    // This is a reasonable middle-ground assumption for risk calculation
    const ageInDays = 180;

    // Curator data (simplified - vault count = 1 for now, as we don't have curator history here)
    const curatorVaultCount = vault.curators?.length || 1;
    const curators = vault.curators || [];
    const professionalSignals = {
      hasWebsite: curators.some((c) => c.url && c.url.trim() !== ''),
      hasDescription: curators.some((c) => c.aboutDescription && c.aboutDescription.trim() !== ''),
      multipleCurators: curators.length > 1,
      curatorCount: curators.length,
    };

    // Fee data
    const managementFee = vault.state?.managementFee || 0;
    const performanceFee = vault.state?.performanceFee || 0;
    const pricePerShare = BigInt(vault.state?.pricePerShare || '0');
    const highWaterMark = BigInt(vault.state?.highWaterMark || '0');
    const performanceFeeActive = pricePerShare > highWaterMark;

    // Liquidity data
    const safeAssets = vault.state?.safeAssetBalanceUsd || 0;
    const pendingRedemptions = vault.state?.pendingSettlement?.assetsUsd || 0;

    // APR consistency data
    const aprData = {
      weeklyApr: vault.state?.weeklyApr?.linearNetApr,
      monthlyApr: vault.state?.monthlyApr?.linearNetApr,
      yearlyApr: vault.state?.yearlyApr?.linearNetApr,
      inceptionApr: vault.state?.inceptionApr?.linearNetApr,
    };

    // Yield composition
    const weeklyAprData = vault.state?.weeklyApr;
    const yieldComposition = weeklyAprData
      ? {
          totalApr: weeklyAprData.linearNetApr || 0,
          nativeYieldsApr:
            weeklyAprData.nativeYields?.reduce((sum, ny) => sum + (ny.apr || 0), 0) || 0,
          airdropsApr: weeklyAprData.airdrops?.reduce((sum, ad) => sum + (ad.apr || 0), 0) || 0,
          incentivesApr:
            weeklyAprData.incentives?.reduce((sum, inc) => sum + (inc.apr || 0), 0) || 0,
        }
      : undefined;

    // Settlement data
    const averageSettlement = vault.averageSettlement || 0;
    const pendingOperationsRatio = safeAssets > 0 ? pendingRedemptions / safeAssets : 0;
    const settlementData = {
      averageSettlementDays: averageSettlement,
      pendingOperationsRatio,
    };

    // Integration complexity
    const integrationCount = vault.defiIntegrations?.length || 0;

    // Capacity utilization
    const totalAssets = parseFloat(vault.state?.totalAssets || '0');
    const maxCapacity = vault.maxCapacity ? parseFloat(vault.maxCapacity) : null;
    const capacityData = {
      totalAssets,
      maxCapacity,
    };

    // Price history (empty for now - would need separate query)
    const priceHistory: number[] = [];

    // Calculate risk
    riskBreakdown = analyzeRisk({
      tvl: vaultTVL,
      totalProtocolTVL,
      priceHistory,
      ageInDays,
      curatorVaultCount,
      curatorSuccessRate: 0.5, // Default without historical data
      curatorProfessionalSignals: professionalSignals,
      managementFee,
      performanceFee,
      performanceFeeActive,
      safeAssets,
      pendingRedemptions,
      aprData,
      yieldComposition,
      settlementData,
      integrationCount,
      capacityData,
    });
  } catch (error) {
    console.error(`Failed to calculate risk for vault ${vault.address}:`, error);
    riskBreakdown = undefined;
  }

  return {
    address: vault.address,
    name: vault.name || 'Unknown Vault',
    symbol: vault.symbol || 'N/A',
    chainId: chainId,
    tvl: typeof tvl === 'number' ? tvl : 0,
    apr: apr,
    totalShares: vault.state?.totalSupply,
    totalAssets: vault.state?.totalAssets,
    riskScore: riskBreakdown?.overallRisk,
    riskLevel: riskBreakdown?.riskLevel,
    riskBreakdown,
    // Fee fields (values in basis points: 100 = 1%, 1000 = 10%)
    fees: {
      managementFee: vault.state?.managementFee ?? 0,
      performanceFee: vault.state?.performanceFee ?? 0,
    },
  };
}

/**
 * Build markdown output from comparison data
 * Supports displaying multiple chains for cross-chain comparisons
 */
function buildComparisonMarkdown(
  summary: ComparisonSummary,
  table: string,
  chainIds: number[],
  cached: boolean = false
): string {
  const hasRiskData =
    summary.averageRisk !== undefined && summary.safestVault && summary.riskiestVault;

  let markdown = cached
    ? `# Vault Comparison Results (Cached)\n\n`
    : `# Vault Comparison Results\n\n`;

  // Display chains - format nicely for single or multiple chains
  if (chainIds.length === 1) {
    markdown += `**Chain ID**: ${chainIds[0]}\n`;
  } else {
    markdown += `**Chains**: ${chainIds.join(', ')} (Cross-chain comparison)\n`;
  }
  markdown += `**Vaults Analyzed**: ${summary.totalVaults}\n\n`;

  markdown += `## Summary Statistics\n\n`;
  markdown += `- **Average TVL**: $${(summary.averageTvl / 1000000).toFixed(2)}M\n`;
  markdown += `- **Average APR**: ${summary.averageApr.toFixed(2)}%\n`;

  if (hasRiskData) {
    markdown += `- **Average Risk**: ${(summary.averageRisk! * 100).toFixed(1)}%\n`;
  }

  markdown += `\n### Best Performer\n`;
  markdown += `- **Vault**: ${summary.bestPerformer.name}\n`;
  markdown += `- **APR**: ${summary.bestPerformer.apr.toFixed(2)}%\n\n`;

  markdown += `### Worst Performer\n`;
  markdown += `- **Vault**: ${summary.worstPerformer.name}\n`;
  markdown += `- **APR**: ${summary.worstPerformer.apr.toFixed(2)}%\n\n`;

  markdown += `### Highest TVL\n`;
  markdown += `- **Vault**: ${summary.highestTvl.name}\n`;
  markdown += `- **TVL**: $${(summary.highestTvl.tvl / 1000000).toFixed(2)}M\n\n`;

  markdown += `### Lowest TVL\n`;
  markdown += `- **Vault**: ${summary.lowestTvl.name}\n`;
  markdown += `- **TVL**: $${(summary.lowestTvl.tvl / 1000000).toFixed(2)}M\n\n`;

  if (hasRiskData) {
    markdown += `### Safest Vault\n`;
    markdown += `- **Vault**: ${summary.safestVault!.name}\n`;
    markdown += `- **Risk Score**: ${(summary.safestVault!.riskScore * 100).toFixed(1)}% (${summary.safestVault!.riskLevel})\n\n`;

    markdown += `### Riskiest Vault\n`;
    markdown += `- **Vault**: ${summary.riskiestVault!.name}\n`;
    markdown += `- **Risk Score**: ${(summary.riskiestVault!.riskScore * 100).toFixed(1)}% (${summary.riskiestVault!.riskLevel})\n\n`;
  }

  markdown += `## Detailed Comparison\n\n`;
  markdown += `${table}\n\n`;

  markdown += `**Legend**:\n`;
  markdown += `- **Rank**: Overall ranking based on weighted score`;

  if (hasRiskData) {
    markdown += ` (40% APR, 30% TVL, 30% Safety)\n`;
  } else {
    markdown += ` (60% APR, 40% TVL)\n`;
  }

  markdown += `- **Score**: Overall performance score (0-100)\n`;
  markdown += `- **TVL Δ**: Delta from average TVL (%)\n`;
  markdown += `- **APR Δ**: Delta from average APR (%)\n`;
  markdown += `- **Mgmt Fee**: Management fee (annual, in %)\n`;
  markdown += `- **Perf Fee**: Performance fee (on profits, in %)\n`;

  if (hasRiskData) {
    markdown += `- **Risk**: 12-factor risk score (🟢 Low, 🟡 Medium, 🟠 High, 🔴 Critical)\n`;
    markdown += `- **Risk Δ**: Delta from average risk (%)\n`;
  }

  return markdown;
}

/**
 * Helper to normalize input: convert single chainId to chainIds array for backward compatibility
 */
function normalizeChainIds(input: CompareVaultsInput): number[] {
  return input.chainIds ?? (input.chainId ? [input.chainId] : []);
}

/**
 * Format TVL as human-readable string
 */
function formatTvl(tvlUsd: number): string {
  if (tvlUsd >= 1_000_000_000) {
    return `$${(tvlUsd / 1_000_000_000).toFixed(2)}B`;
  } else if (tvlUsd >= 1_000_000) {
    return `$${(tvlUsd / 1_000_000).toFixed(2)}M`;
  } else if (tvlUsd >= 1_000) {
    return `$${(tvlUsd / 1_000).toFixed(2)}K`;
  }
  return `$${tvlUsd.toFixed(2)}`;
}

/**
 * Format APR as percentage string
 * Note: APR values from the API are already percentages (e.g., 4.12 means 4.12%)
 */
function formatApr(apr: number): string {
  return `${apr.toFixed(2)}%`;
}

/**
 * Convert risk level to lowercase for UI block compatibility
 */
function normalizeRiskLevel(
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical'
): 'low' | 'medium' | 'high' | 'critical' | null {
  if (!riskLevel) return null;
  return riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Convert VaultData to StructuredVaultData for UI block rendering
 */
function convertToStructuredVaultData(
  vault: VaultData,
  comparisonData: VaultComparisonData
): StructuredVaultData {
  const tvlUsd = comparisonData.tvl;
  const aprValue = comparisonData.apr;

  return {
    address: vault.address,
    chainId: vault.chain?.id ?? 0,
    name: vault.name || 'Unknown Vault',
    symbol: vault.symbol || 'N/A',
    logoUrl: vault.logoUrl || null,
    asset: vault.asset?.symbol || 'Unknown',
    tvl: formatTvl(tvlUsd),
    tvlUsd: tvlUsd,
    apr: formatApr(aprValue),
    aprValue: aprValue,
    curator: vault.curators?.[0]?.name || null,
    risk: normalizeRiskLevel(comparisonData.riskLevel),
    fees: {
      managementFee: vault.state?.managementFee ?? 0,
      performanceFee: vault.state?.performanceFee ?? 0,
    },
  };
}

/**
 * Transform raw GraphQL response into comparison markdown output
 * Uses closure to capture input values
 */
function createTransformComparisonData(input: CompareVaultsInput) {
  return (data: CompareVaultsResponse): CompareVaultsOutput => {
    // Normalize chainIds for multi-chain support
    const chainIds = normalizeChainIds(input);

    // Convert to comparison data - chainId is now extracted from vault.chain.id
    const comparisonData: VaultComparisonData[] = data.vaults.items.map((vault) =>
      convertToComparisonData(vault, data.vaults.items)
    );

    // Normalize and rank vaults
    const normalizedVaults = normalizeAndRankVaults(comparisonData);

    // Generate summary statistics
    const summary = generateComparisonSummary(comparisonData);

    // Format as markdown table
    const table = formatComparisonTable(normalizedVaults);

    // Build output markdown with all chainIds
    const markdown = buildComparisonMarkdown(summary, table, chainIds, false);

    // Build structured vault data for UI block rendering
    // Maps each vault to its corresponding comparison data for risk level
    const structuredVaults: StructuredVaultData[] = data.vaults.items.map((vault, index) =>
      convertToStructuredVaultData(vault, comparisonData[index])
    );

    return { markdown, vaults: structuredVaults };
  };
}

/**
 * Create the executeCompareVaults function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteCompareVaults(
  container: ServiceContainer
): (input: CompareVaultsInput) => Promise<CallToolResult> {
  return async (input: CompareVaultsInput): Promise<CallToolResult> => {
    // Normalize chainIds for multi-chain support (backward compatible)
    const chainIds = normalizeChainIds(input);

    // Cache cascade pattern - check fragment cache for ALL vaults across all chains
    // For multi-chain, we need to check each vault against each possible chain
    const cachedVaults: VaultData[] = [];
    let allCached = true;

    for (const address of input.vaultAddresses) {
      let foundCached = false;
      // Try each chain to find a cached vault
      for (const chainId of chainIds) {
        const vaultCacheKey = cacheKeys.vaultData(address, chainId);
        const cachedVault = container.cache.get<VaultData>(vaultCacheKey);
        if (cachedVault) {
          cachedVaults.push(cachedVault);
          foundCached = true;
          break;
        }
      }
      if (!foundCached) {
        allCached = false;
        break; // If any vault is missing, we need to query all
      }
    }

    // If ALL vaults are cached, return immediately without GraphQL query
    if (allCached && cachedVaults.length === input.vaultAddresses.length) {
      const comparisonData: VaultComparisonData[] = cachedVaults.map((vault) =>
        convertToComparisonData(vault, cachedVaults)
      );
      const normalizedVaults = normalizeAndRankVaults(comparisonData);
      const summary = generateComparisonSummary(comparisonData);
      const table = formatComparisonTable(normalizedVaults);

      const markdown = buildComparisonMarkdown(summary, table, chainIds, true);

      // Build structured vault data for UI block rendering (cached path)
      const structuredVaults: StructuredVaultData[] = cachedVaults.map((vault, index) =>
        convertToStructuredVaultData(vault, comparisonData[index])
      );

      // Build response with both markdown and structured vaults
      const responseText = `${markdown}${getToolDisclaimer('compare_vaults')}

---
## Structured Vault Data (for UI blocks)
The following JSON contains structured vault data for building comparison UI blocks.
Use the \`vaults\` array directly - fees are in basis points (100 = 1%).

\`\`\`json
${JSON.stringify({ vaults: structuredVaults }, null, 2)}
\`\`\``;

      return createSuccessResponse(responseText);
    }

    // Not all vaults cached - execute normal GraphQL query for all vaults
    const executor = executeToolWithCache<
      CompareVaultsInput,
      CompareVaultsResponse,
      CompareVaultsVariables,
      CompareVaultsOutput
    >({
      container,
      cacheKey: () => cacheKeys.compareVaults(input.vaultAddresses, chainIds),
      cacheTTL: cacheTTL.comparison,
      query: COMPARE_VAULTS_QUERY,
      variables: () => ({
        addresses: input.vaultAddresses,
        chainIds: chainIds,
      }),
      validateResult: (data) => {
        const hasVaults = !!(data.vaults?.items && data.vaults.items.length > 0);
        return {
          valid: hasVaults,
          message: hasVaults
            ? undefined
            : `No vaults found for the provided addresses on chains ${chainIds.join(', ')}`,
          isError: !hasVaults,
        };
      },
      transformResult: createTransformComparisonData(input),
      toolName: 'compare_vaults',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.compareVaults(input.vaultAddresses, chainIds);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT, CacheTag.ANALYTICS]);

    // Execute GraphQL query for all vaults
    const result = await executor(input);

    // Transform JSON output to include both markdown and structured vaults
    // The structured vaults array provides Claude with all data needed for UI blocks
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as CompareVaultsOutput;

        // Build response with:
        // 1. Human-readable markdown (with disclaimer)
        // 2. Structured vaults array for UI block construction
        const responseText = `${output.markdown}${getToolDisclaimer('compare_vaults')}

---
## Structured Vault Data (for UI blocks)
The following JSON contains structured vault data for building comparison UI blocks.
Use the \`vaults\` array directly - fees are in basis points (100 = 1%).

\`\`\`json
${JSON.stringify({ vaults: output.vaults }, null, 2)}
\`\`\``;

        result.content[0].text = responseText;
      } catch (error) {
        console.error('Failed to parse comparison output:', error);
      }
    }

    return result;
  };
}
