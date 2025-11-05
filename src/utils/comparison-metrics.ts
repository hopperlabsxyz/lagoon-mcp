/**
 * Comparison Metrics Utility
 *
 * Provides normalization, ranking, and comparison functions for multi-vault analysis
 */

/**
 * Vault data structure for comparison
 */
export interface VaultComparisonData {
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  tvl: number;
  apy: number;
  totalShares?: string;
  totalAssets?: string;
}

/**
 * Normalized vault metrics with rankings
 */
export interface NormalizedVault extends VaultComparisonData {
  rank: number;
  tvlPercentile: number;
  apyPercentile: number;
  apyDelta: number; // Delta from average APY
  tvlDelta: number; // Delta from average TVL
  overallScore: number; // Weighted score (0-100)
}

/**
 * Comparison summary statistics
 */
export interface ComparisonSummary {
  totalVaults: number;
  averageTvl: number;
  averageApy: number;
  bestPerformer: {
    address: string;
    name: string;
    apy: number;
  };
  worstPerformer: {
    address: string;
    name: string;
    apy: number;
  };
  highestTvl: {
    address: string;
    name: string;
    tvl: number;
  };
  lowestTvl: {
    address: string;
    name: string;
    tvl: number;
  };
}

/**
 * Calculate percentile rank for a value in an array
 * @param value The value to calculate percentile for
 * @param arr Array of all values
 * @returns Percentile (0-100)
 */
export function calculatePercentile(value: number, arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = sorted.indexOf(value);
  if (index === -1) return 0;

  const percentile = (index / (sorted.length - 1)) * 100;
  return Math.round(percentile * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate delta from average
 * @param value The value to calculate delta for
 * @param average The average value
 * @returns Delta as percentage
 */
export function calculateDelta(value: number, average: number): number {
  if (average === 0) return 0;
  const delta = ((value - average) / average) * 100;
  return Math.round(delta * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate overall score based on weighted metrics
 * @param apyPercentile APY percentile (0-100)
 * @param tvlPercentile TVL percentile (0-100)
 * @param weights Optional weights for metrics
 * @returns Overall score (0-100)
 */
export function calculateOverallScore(
  apyPercentile: number,
  tvlPercentile: number,
  weights: { apy: number; tvl: number } = { apy: 0.6, tvl: 0.4 }
): number {
  const score = apyPercentile * weights.apy + tvlPercentile * weights.tvl;
  return Math.round(score * 100) / 100; // Round to 2 decimals
}

/**
 * Normalize and rank vaults for comparison
 * @param vaults Array of vault data
 * @returns Array of normalized vaults with rankings
 */
export function normalizeAndRankVaults(vaults: VaultComparisonData[]): NormalizedVault[] {
  if (vaults.length === 0) return [];

  // Extract metrics
  const tvls = vaults.map((v) => v.tvl);
  const apys = vaults.map((v) => v.apy);

  // Calculate averages
  const avgTvl = tvls.reduce((sum, val) => sum + val, 0) / tvls.length;
  const avgApy = apys.reduce((sum, val) => sum + val, 0) / apys.length;

  // Normalize each vault
  const normalized: NormalizedVault[] = vaults.map((vault) => ({
    ...vault,
    rank: 0, // Will be set below
    tvlPercentile: calculatePercentile(vault.tvl, tvls),
    apyPercentile: calculatePercentile(vault.apy, apys),
    apyDelta: calculateDelta(vault.apy, avgApy),
    tvlDelta: calculateDelta(vault.tvl, avgTvl),
    overallScore: 0, // Will be set below
  }));

  // Calculate overall scores
  normalized.forEach((vault) => {
    vault.overallScore = calculateOverallScore(vault.apyPercentile, vault.tvlPercentile);
  });

  // Sort by overall score (descending) and assign ranks
  normalized.sort((a, b) => b.overallScore - a.overallScore);
  normalized.forEach((vault, index) => {
    vault.rank = index + 1;
  });

  return normalized;
}

/**
 * Generate comparison summary statistics
 * @param vaults Array of vault data
 * @returns Summary statistics
 */
export function generateComparisonSummary(vaults: VaultComparisonData[]): ComparisonSummary {
  if (vaults.length === 0) {
    throw new Error('Cannot generate summary for empty vault list');
  }

  // Calculate averages
  const totalTvl = vaults.reduce((sum, v) => sum + v.tvl, 0);
  const totalApy = vaults.reduce((sum, v) => sum + v.apy, 0);
  const averageTvl = totalTvl / vaults.length;
  const averageApy = totalApy / vaults.length;

  // Find extremes
  const sortedByApy = [...vaults].sort((a, b) => b.apy - a.apy);
  const sortedByTvl = [...vaults].sort((a, b) => b.tvl - a.tvl);

  return {
    totalVaults: vaults.length,
    averageTvl,
    averageApy,
    bestPerformer: {
      address: sortedByApy[0].address,
      name: sortedByApy[0].name,
      apy: sortedByApy[0].apy,
    },
    worstPerformer: {
      address: sortedByApy[sortedByApy.length - 1].address,
      name: sortedByApy[sortedByApy.length - 1].name,
      apy: sortedByApy[sortedByApy.length - 1].apy,
    },
    highestTvl: {
      address: sortedByTvl[0].address,
      name: sortedByTvl[0].name,
      tvl: sortedByTvl[0].tvl,
    },
    lowestTvl: {
      address: sortedByTvl[sortedByTvl.length - 1].address,
      name: sortedByTvl[sortedByTvl.length - 1].name,
      tvl: sortedByTvl[sortedByTvl.length - 1].tvl,
    },
  };
}

/**
 * Format comparison output as markdown table
 * @param vaults Normalized vaults with rankings
 * @returns Markdown formatted table
 */
export function formatComparisonTable(vaults: NormalizedVault[]): string {
  const header =
    '| Rank | Vault | TVL | APY | Score | TVL Δ | APY Δ |\n|------|-------|-----|-----|-------|-------|-------|\n';

  const rows = vaults
    .map((v) => {
      const tvlFormatted = `$${(v.tvl / 1000000).toFixed(2)}M`;
      const apyFormatted = `${(v.apy * 100).toFixed(2)}%`;
      const scoreFormatted = v.overallScore.toFixed(1);
      const tvlDeltaFormatted = `${v.tvlDelta > 0 ? '+' : ''}${v.tvlDelta.toFixed(1)}%`;
      const apyDeltaFormatted = `${v.apyDelta > 0 ? '+' : ''}${v.apyDelta.toFixed(1)}%`;

      return `| ${v.rank} | ${v.name} (${v.symbol}) | ${tvlFormatted} | ${apyFormatted} | ${scoreFormatted} | ${tvlDeltaFormatted} | ${apyDeltaFormatted} |`;
    })
    .join('\n');

  return header + rows;
}
