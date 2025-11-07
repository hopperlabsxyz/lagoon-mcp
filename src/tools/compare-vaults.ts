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
import { VaultData } from '../graphql/fragments/index.js';
import { COMPARE_VAULTS_QUERY } from '../graphql/queries/index.js';
import {
  VaultComparisonData,
  normalizeAndRankVaults,
  generateComparisonSummary,
  formatComparisonTable,
} from '../utils/comparison-metrics.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL, generateCacheKey } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';

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
 */
function convertToComparisonData(vault: VaultData, chainId: number): VaultComparisonData {
  // Extract APR from nested state structure with proper null checking
  // Use weekly or monthly linearNetApr as the primary APR metric
  const weeklyApr = vault.state?.weeklyApr?.linearNetApr;
  const monthlyApr = vault.state?.monthlyApr?.linearNetApr;
  const apr =
    typeof weeklyApr === 'number' ? weeklyApr : typeof monthlyApr === 'number' ? monthlyApr : 0;

  const tvl = vault.state?.totalAssetsUsd;

  return {
    address: vault.address,
    name: vault.name || 'Unknown Vault',
    symbol: vault.symbol || 'N/A',
    chainId: chainId,
    tvl: typeof tvl === 'number' ? tvl : 0,
    apr: apr,
    totalShares: vault.state?.totalSupply,
    totalAssets: vault.state?.totalAssets,
  };
}

/**
 * Transform raw GraphQL response into comparison markdown output
 * Uses closure to capture input values
 */
function createTransformComparisonData(input: CompareVaultsInput) {
  return (data: CompareVaultsResponse): CompareVaultsOutput => {
    // Convert to comparison data
    const comparisonData: VaultComparisonData[] = data.vaults.items.map((vault) =>
      convertToComparisonData(vault, input.chainId)
    );

    // Normalize and rank vaults
    const normalizedVaults = normalizeAndRankVaults(comparisonData);

    // Generate summary statistics
    const summary = generateComparisonSummary(comparisonData);

    // Format as markdown table
    const table = formatComparisonTable(normalizedVaults);

    // Build output markdown
    const markdown =
      `# Vault Comparison Results

` +
      `**Chain ID**: ${input.chainId}
` +
      `**Vaults Analyzed**: ${summary.totalVaults}

` +
      `## Summary Statistics

` +
      `- **Average TVL**: $${(summary.averageTvl / 1000000).toFixed(2)}M
` +
      `- **Average APR**: ${(summary.averageApr * 100).toFixed(2)}%

` +
      `### Best Performer
` +
      `- **Vault**: ${summary.bestPerformer.name}
` +
      `- **APR**: ${(summary.bestPerformer.apr * 100).toFixed(2)}%

` +
      `### Worst Performer
` +
      `- **Vault**: ${summary.worstPerformer.name}
` +
      `- **APR**: ${(summary.worstPerformer.apr * 100).toFixed(2)}%

` +
      `### Highest TVL
` +
      `- **Vault**: ${summary.highestTvl.name}
` +
      `- **TVL**: $${(summary.highestTvl.tvl / 1000000).toFixed(2)}M

` +
      `### Lowest TVL
` +
      `- **Vault**: ${summary.lowestTvl.name}
` +
      `- **TVL**: $${(summary.lowestTvl.tvl / 1000000).toFixed(2)}M

` +
      `## Detailed Comparison

` +
      `${table}

` +
      `**Legend**:
` +
      `- **Rank**: Overall ranking based on weighted score (60% APR, 40% TVL)
` +
      `- **Score**: Overall performance score (0-100)
` +
      `- **TVL Δ**: Delta from average TVL (%)
` +
      `- **APR Δ**: Delta from average APR (%)
`;

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
      const vaultCacheKey = generateCacheKey(CacheTag.VAULT, {
        address,
        chainId: input.chainId,
      });
      const cachedVault = container.cache.get(vaultCacheKey);

      if (cachedVault) {
        cachedVaults.push(cachedVault as VaultData);
      } else {
        allCached = false;
        break; // If any vault is missing, we need to query all
      }
    }

    // If ALL vaults are cached, return immediately without GraphQL query
    if (allCached && cachedVaults.length === input.vaultAddresses.length) {
      const comparisonData: VaultComparisonData[] = cachedVaults.map((vault) =>
        convertToComparisonData(vault, input.chainId)
      );
      const normalizedVaults = normalizeAndRankVaults(comparisonData);
      const summary = generateComparisonSummary(comparisonData);
      const table = formatComparisonTable(normalizedVaults);

      const markdown =
        `# Vault Comparison Results (Cached)

` +
        `**Chain ID**: ${input.chainId}
` +
        `**Vaults Analyzed**: ${summary.totalVaults}

` +
        `## Summary Statistics

` +
        `- **Average TVL**: $${(summary.averageTvl / 1000000).toFixed(2)}M
` +
        `- **Average APR**: ${(summary.averageApr * 100).toFixed(2)}%

` +
        `### Best Performer
` +
        `- **Vault**: ${summary.bestPerformer.name}
` +
        `- **APR**: ${(summary.bestPerformer.apr * 100).toFixed(2)}%

` +
        `### Worst Performer
` +
        `- **Vault**: ${summary.worstPerformer.name}
` +
        `- **APR**: ${(summary.worstPerformer.apr * 100).toFixed(2)}%

` +
        `### Highest TVL
` +
        `- **Vault**: ${summary.highestTvl.name}
` +
        `- **TVL**: $${(summary.highestTvl.tvl / 1000000).toFixed(2)}M

` +
        `### Lowest TVL
` +
        `- **Vault**: ${summary.lowestTvl.name}
` +
        `- **TVL**: $${(summary.lowestTvl.tvl / 1000000).toFixed(2)}M

` +
        `## Detailed Comparison

` +
        `${table}

` +
        `**Legend**:
` +
        `- **Rank**: Overall ranking based on weighted score (60% APR, 40% TVL)
` +
        `- **Score**: Overall performance score (0-100)
` +
        `- **TVL Δ**: Delta from average TVL (%)
` +
        `- **APR Δ**: Delta from average APR (%)
`;

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

    // Transform JSON output to markdown text format
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as CompareVaultsOutput;
        result.content[0].text = output.markdown;

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
