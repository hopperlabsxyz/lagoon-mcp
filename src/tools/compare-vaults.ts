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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { compareVaultsInputSchema, CompareVaultsInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments.js';
import {
  VaultComparisonData,
  normalizeAndRankVaults,
  generateComparisonSummary,
  formatComparisonTable,
} from '../utils/comparison-metrics.js';

/**
 * GraphQL query for batch vault comparison
 * Fetches multiple vaults in a single request
 */
const COMPARE_VAULTS_QUERY = `
  query CompareVaults($addresses: [Address!]!, $chainId: Int!) {
    vaults(where: { address_in: $addresses, chainId: $chainId }) {
      ...VaultFragment
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * Response type for vault comparison query
 */
interface CompareVaultsResponse {
  vaults: VaultData[];
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
 * Compare multiple vaults with normalized metrics and rankings
 *
 * @param input - Array of vault addresses and chain ID
 * @returns Comparison table with rankings and metrics
 */
export async function executeCompareVaults(input: CompareVaultsInput): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = compareVaultsInputSchema.parse(input);

    // Generate cache key (sorted addresses for consistency)
    const cacheKey = cacheKeys.compareVaults(validatedInput.vaultAddresses, validatedInput.chainId);

    // Check cache first
    const cachedData = cache.get<string>(cacheKey);
    if (cachedData) {
      return {
        content: [{ type: 'text', text: cachedData }],
        isError: false,
      };
    }

    // Execute GraphQL query with batch request
    const data = await graphqlClient.request<CompareVaultsResponse>(COMPARE_VAULTS_QUERY, {
      addresses: validatedInput.vaultAddresses,
      chainId: validatedInput.chainId,
    });

    // Handle no vaults found
    if (!data.vaults || data.vaults.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No vaults found for the provided addresses on chain ${validatedInput.chainId}`,
          },
        ],
        isError: false,
      };
    }

    // Warn if some vaults were not found
    if (data.vaults.length < validatedInput.vaultAddresses.length) {
      const foundAddresses = data.vaults.map((v) => v.address.toLowerCase());
      const missingAddresses = validatedInput.vaultAddresses.filter(
        (addr) => !foundAddresses.includes(addr.toLowerCase())
      );
      console.warn(
        `Warning: ${missingAddresses.length} vault(s) not found: ${missingAddresses.join(', ')}`
      );
    }

    // Convert to comparison data
    const comparisonData: VaultComparisonData[] = data.vaults.map((vault) =>
      convertToComparisonData(vault, validatedInput.chainId)
    );

    // Normalize and rank vaults
    const normalizedVaults = normalizeAndRankVaults(comparisonData);

    // Generate summary statistics
    const summary = generateComparisonSummary(comparisonData);

    // Format as markdown table
    const table = formatComparisonTable(normalizedVaults);

    // Build output text
    const output =
      `# Vault Comparison Results\n\n` +
      `**Chain ID**: ${validatedInput.chainId}\n` +
      `**Vaults Analyzed**: ${summary.totalVaults}\n\n` +
      `## Summary Statistics\n\n` +
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
      `### Highest TVL\n` +
      `- **Vault**: ${summary.highestTvl.name}\n` +
      `- **TVL**: $${(summary.highestTvl.tvl / 1000000).toFixed(2)}M\n\n` +
      `### Lowest TVL\n` +
      `- **Vault**: ${summary.lowestTvl.name}\n` +
      `- **TVL**: $${(summary.lowestTvl.tvl / 1000000).toFixed(2)}M\n\n` +
      `## Detailed Comparison\n\n` +
      `${table}\n\n` +
      `**Legend**:\n` +
      `- **Rank**: Overall ranking based on weighted score (60% APY, 40% TVL)\n` +
      `- **Score**: Overall performance score (0-100)\n` +
      `- **TVL Δ**: Delta from average TVL (%)\n` +
      `- **APY Δ**: Delta from average APY (%)\n`;

    // Store in cache with 15-minute TTL
    cache.set(cacheKey, output, cacheTTL.comparison);

    // Return successful response
    return {
      content: [{ type: 'text', text: output }],
      isError: false,
    };
  } catch (error) {
    return handleToolError(error, 'compare_vaults');
  }
}
