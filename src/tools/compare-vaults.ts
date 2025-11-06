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
import { cacheKeys, cacheTTL } from '../cache/index.js';

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
  // Extract APY from nested state structure with proper null checking
  // Use weekly or monthly linearNetApr as the primary APY metric
  const weeklyApr = vault.state?.weeklyApr?.linearNetApr;
  const monthlyApr = vault.state?.monthlyApr?.linearNetApr;
  const apy =
    typeof weeklyApr === 'number' ? weeklyApr : typeof monthlyApr === 'number' ? monthlyApr : 0;

  const tvl = vault.state?.totalAssetsUsd;

  return {
    address: vault.address,
    name: vault.name || 'Unknown Vault',
    symbol: vault.symbol || 'N/A',
    chainId: chainId,
    tvl: typeof tvl === 'number' ? tvl : 0,
    apy: apy,
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
      `- **Average APY**: ${(summary.averageApy * 100).toFixed(2)}%

` +
      `### Best Performer
` +
      `- **Vault**: ${summary.bestPerformer.name}
` +
      `- **APY**: ${(summary.bestPerformer.apy * 100).toFixed(2)}%

` +
      `### Worst Performer
` +
      `- **Vault**: ${summary.worstPerformer.name}
` +
      `- **APY**: ${(summary.worstPerformer.apy * 100).toFixed(2)}%

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
      `- **Rank**: Overall ranking based on weighted score (60% APY, 40% TVL)
` +
      `- **Score**: Overall performance score (0-100)
` +
      `- **TVL Δ**: Delta from average TVL (%)
` +
      `- **APY Δ**: Delta from average APY (%)
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

    // Execute and get result
    const result = await executor(input);

    // Transform JSON output to markdown text format
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as CompareVaultsOutput;
        result.content[0].text = output.markdown;
      } catch (error) {
        console.error('Failed to parse comparison output:', error);
      }
    }

    return result;
  };
}
