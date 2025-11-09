/**
 * compare_vaults Tool
 *
 * Side-by-side comparison of multiple vaults with normalized metrics and rankings.
 * Supports comparing 2-10 vaults simultaneously.
 *
 * Use cases:
 * - Evaluate investment opportunities across similar vaults
 * - Identify best/worst performers in a category
 * - Risk-adjusted return analysis
 * - Performance: ~300 tokens per vault
 *
 * Cache strategy:
 * - 15-minute TTL for comparison results
 * - Cache key: compare:{sorted_addresses}:{chainId}
 * - Cache hit rate target: 70-80%
 * - Cache tags: [CacheTag.VAULT, CacheTag.ANALYTICS] for invalidation
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
  chainId: number;
}

/**
 * Comparison output with markdown
 */
interface CompareVaultsOutput {
  markdown: string;
}

/**
 * Convert VaultData to VaultComparisonData for metrics calculation
 * Now includes 12-factor risk analysis
 */
function convertToComparisonData(
  vault: VaultData,
  chainId: number,
  allVaults: VaultData[]
): VaultComparisonData {
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
  };
}

/**
 * Build markdown output from comparison data
 */
function buildComparisonMarkdown(
  summary: ComparisonSummary,
  table: string,
  chainId: number,
  cached: boolean = false
): string {
  const hasRiskData =
    summary.averageRisk !== undefined && summary.safestVault && summary.riskiestVault;

  let markdown = cached
    ? `# Vault Comparison Results (Cached)\n\n`
    : `# Vault Comparison Results\n\n`;

  markdown += `**Chain ID**: ${chainId}\n`;
  markdown += `**Vaults Analyzed**: ${summary.totalVaults}\n\n`;

  markdown += `## Summary Statistics\n\n`;
  markdown += `- **Average TVL**: $${(summary.averageTvl / 1000000).toFixed(2)}M\n`;
  markdown += `- **Average APR**: ${(summary.averageApr * 100).toFixed(2)}%\n`;

  if (hasRiskData) {
    markdown += `- **Average Risk**: ${(summary.averageRisk! * 100).toFixed(1)}%\n`;
  }

  markdown += `\n### Best Performer\n`;
  markdown += `- **Vault**: ${summary.bestPerformer.name}\n`;
  markdown += `- **APR**: ${(summary.bestPerformer.apr * 100).toFixed(2)}%\n\n`;

  markdown += `### Worst Performer\n`;
  markdown += `- **Vault**: ${summary.worstPerformer.name}\n`;
  markdown += `- **APR**: ${(summary.worstPerformer.apr * 100).toFixed(2)}%\n\n`;

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

  if (hasRiskData) {
    markdown += `- **Risk**: 12-factor risk score (🟢 Low, 🟡 Medium, 🟠 High, 🔴 Critical)\n`;
    markdown += `- **Risk Δ**: Delta from average risk (%)\n`;
  }

  return markdown;
}

/**
 * Transform raw GraphQL response into comparison markdown output
 * Uses closure to capture input values
 */
function createTransformComparisonData(input: CompareVaultsInput) {
  return (data: CompareVaultsResponse): CompareVaultsOutput => {
    // Convert to comparison data
    const comparisonData: VaultComparisonData[] = data.vaults.items.map((vault) =>
      convertToComparisonData(vault, input.chainId, data.vaults.items)
    );

    // Normalize and rank vaults
    const normalizedVaults = normalizeAndRankVaults(comparisonData);

    // Generate summary statistics
    const summary = generateComparisonSummary(comparisonData);

    // Format as markdown table
    const table = formatComparisonTable(normalizedVaults);

    // Build output markdown
    const markdown = buildComparisonMarkdown(summary, table, input.chainId, false);

    return { markdown };
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
    // NEW: Cache cascade pattern - check fragment cache for ALL vaults
    const cachedVaults: VaultData[] = [];
    let allCached = true;

    for (const address of input.vaultAddresses) {
      const vaultCacheKey = cacheKeys.vaultData(address, input.chainId);
      const cachedVault = container.cache.get<VaultData>(vaultCacheKey);

      if (cachedVault) {
        cachedVaults.push(cachedVault);
      } else {
        allCached = false;
        break; // If any vault is missing, we need to query all
      }
    }

    // If ALL vaults are cached, return immediately without GraphQL query
    if (allCached && cachedVaults.length === input.vaultAddresses.length) {
      const comparisonData: VaultComparisonData[] = cachedVaults.map((vault) =>
        convertToComparisonData(vault, input.chainId, cachedVaults)
      );
      const normalizedVaults = normalizeAndRankVaults(comparisonData);
      const summary = generateComparisonSummary(comparisonData);
      const table = formatComparisonTable(normalizedVaults);

      const markdown = buildComparisonMarkdown(summary, table, input.chainId, true);

      return createSuccessResponse({ markdown });
    }

    // Not all vaults cached - execute normal GraphQL query for all vaults
    const executor = executeToolWithCache<
      CompareVaultsInput,
      CompareVaultsResponse,
      CompareVaultsVariables,
      CompareVaultsOutput
    >({
      container,
      cacheKey: (input) => cacheKeys.compareVaults(input.vaultAddresses, input.chainId),
      cacheTTL: cacheTTL.comparison,
      query: COMPARE_VAULTS_QUERY,
      variables: (input) => ({
        addresses: input.vaultAddresses,
        chainId: input.chainId,
      }),
      validateResult: (data) => ({
        valid: !!(data.vaults?.items && data.vaults.items.length > 0),
        message:
          data.vaults?.items && data.vaults.items.length > 0
            ? undefined
            : `No vaults found for the provided addresses on chain ${input.chainId}`,
      }),
      transformResult: createTransformComparisonData(input),
      toolName: 'compare_vaults',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.compareVaults(input.vaultAddresses, input.chainId);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT, CacheTag.ANALYTICS]);

    // Execute GraphQL query for all vaults
    const result = await executor(input);

    // Transform JSON output to markdown text format with legal disclaimer
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as CompareVaultsOutput;
        result.content[0].text = output.markdown + getToolDisclaimer('compare_vaults');

        // NEW: Cache each vault individually for future reuse
        // This enables vault_data and other tools to reuse these vaults
        // Note: The raw vault data needs to be extracted before transformation
        // For now, we rely on the comparison cache itself
      } catch (error) {
        console.error('Failed to parse comparison output:', error);
      }
    }

    return result;
  };
}
