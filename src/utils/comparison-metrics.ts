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
  apr: number;
  totalShares?: string;
  totalAssets?: string;
}

/**
 * Normalized vault metrics with rankings
 */
export interface NormalizedVault extends VaultComparisonData {
  rank: number;
  tvlPercentile: number;
  aprPercentile: number;
  aprDelta: number; // Delta from average APR
  tvlDelta: number; // Delta from average TVL
  overallScore: number; // Weighted score (0-100)
}

/**
 * Comparison summary statistics
 */
export interface ComparisonSummary {
  totalVaults: number;
  averageTvl: number;
  averageApr: number;
  bestPerformer: {
    address: string;
    name: string;
    apr: number;
  };
  worstPerformer: {
    address: string;
    name: string;
    apr: number;
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
 * @param aprPercentile APR percentile (0-100)
 * @param tvlPercentile TVL percentile (0-100)
 * @param weights Optional weights for metrics
 * @returns Overall score (0-100)
 */
export function calculateOverallScore(
  aprPercentile: number,
  tvlPercentile: number,
  weights: { apr: number; tvl: number } = { apr: 0.6, tvl: 0.4 }
): number {
  const score = aprPercentile * weights.apr + tvlPercentile * weights.tvl;
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
  const aprs = vaults.map((v) => v.apr);

  // Calculate averages
  const avgTvl = tvls.reduce((sum, val) => sum + val, 0) / tvls.length;
  const avgApr = aprs.reduce((sum, val) => sum + val, 0) / aprs.length;

  // Normalize each vault
  const normalized: NormalizedVault[] = vaults.map((vault) => ({
    ...vault,
    rank: 0, // Will be set below
    tvlPercentile: calculatePercentile(vault.tvl, tvls),
    aprPercentile: calculatePercentile(vault.apr, aprs),
    aprDelta: calculateDelta(vault.apr, avgApr),
    tvlDelta: calculateDelta(vault.tvl, avgTvl),
    overallScore: 0, // Will be set below
  }));

  // Calculate overall scores
  normalized.forEach((vault) => {
    vault.overallScore = calculateOverallScore(vault.aprPercentile, vault.tvlPercentile);
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
  const totalApr = vaults.reduce((sum, v) => sum + v.apr, 0);
  const averageTvl = totalTvl / vaults.length;
  const averageApr = totalApr / vaults.length;

  // Find extremes
  const sortedByApr = [...vaults].sort((a, b) => b.apr - a.apr);
  const sortedByTvl = [...vaults].sort((a, b) => b.tvl - a.tvl);

  return {
    totalVaults: vaults.length,
    averageTvl,
    averageApr,
    bestPerformer: {
      address: sortedByApr[0].address,
      name: sortedByApr[0].name,
      apr: sortedByApr[0].apr,
    },
    worstPerformer: {
      address: sortedByApr[sortedByApr.length - 1].address,
      name: sortedByApr[sortedByApr.length - 1].name,
      apr: sortedByApr[sortedByApr.length - 1].apr,
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
    '| Rank | Vault | TVL | APR | Score | TVL Δ | APR Δ |\n|------|-------|-----|-----|-------|-------|-------|\n';

  const rows = vaults
    .map((v) => {
      const tvlFormatted = `$${(v.tvl / 1000000).toFixed(2)}M`;
      const aprFormatted = `${(v.apr * 100).toFixed(2)}%`;
      const scoreFormatted = v.overallScore.toFixed(1);
      const tvlDeltaFormatted = `${v.tvlDelta > 0 ? '+' : ''}${v.tvlDelta.toFixed(1)}%`;
      const aprDeltaFormatted = `${v.aprDelta > 0 ? '+' : ''}${v.aprDelta.toFixed(1)}%`;

      return `| ${v.rank} | ${v.name} (${v.symbol}) | ${tvlFormatted} | ${aprFormatted} | ${scoreFormatted} | ${tvlDeltaFormatted} | ${aprDeltaFormatted} |`;
    })
    .join('\n');

  return header + rows;
}
