/**
 * Comparison Metrics Utility
 *
 * Provides normalization, ranking, and comparison functions for multi-vault analysis
 */

import { RiskScoreBreakdown } from './risk-scoring.js';

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
  // Risk analysis fields
  riskScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  riskBreakdown?: RiskScoreBreakdown;
  // Fee fields (values in basis points: 100 = 1%, 1000 = 10%)
  fees?: {
    managementFee: number;
    performanceFee: number;
  };
}

/**
 * Normalized vault metrics with rankings
 */
export interface NormalizedVault extends VaultComparisonData {
  rank: number;
  tvlPercentile: number;
  aprPercentile: number;
  riskPercentile?: number; // Percentile ranking for risk (lower risk = higher percentile)
  aprDelta: number; // Delta from average APR
  tvlDelta: number; // Delta from average TVL
  riskDelta?: number; // Delta from average risk
  overallScore: number; // Weighted score (0-100)
}

/**
 * Comparison summary statistics
 */
export interface ComparisonSummary {
  totalVaults: number;
  averageTvl: number;
  averageApr: number;
  averageRisk?: number;
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
  safestVault?: {
    address: string;
    name: string;
    riskScore: number;
    riskLevel: string;
  };
  riskiestVault?: {
    address: string;
    name: string;
    riskScore: number;
    riskLevel: string;
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
  const risks = vaults.map((v) => v.riskScore).filter((r): r is number => r !== undefined);

  // Calculate averages
  const avgTvl = tvls.reduce((sum, val) => sum + val, 0) / tvls.length;
  const avgApr = aprs.reduce((sum, val) => sum + val, 0) / aprs.length;
  const avgRisk =
    risks.length > 0 ? risks.reduce((sum, val) => sum + val, 0) / risks.length : undefined;

  // Check if we have risk data
  const hasRiskData = risks.length > 0;

  // Normalize each vault
  const normalized: NormalizedVault[] = vaults.map((vault) => ({
    ...vault,
    rank: 0, // Will be set below
    tvlPercentile: calculatePercentile(vault.tvl, tvls),
    aprPercentile: calculatePercentile(vault.apr, aprs),
    riskPercentile:
      hasRiskData && vault.riskScore !== undefined
        ? 100 - calculatePercentile(vault.riskScore, risks) // Invert: lower risk = higher percentile
        : undefined,
    aprDelta: calculateDelta(vault.apr, avgApr),
    tvlDelta: calculateDelta(vault.tvl, avgTvl),
    riskDelta:
      avgRisk !== undefined && vault.riskScore !== undefined
        ? calculateDelta(vault.riskScore, avgRisk)
        : undefined,
    overallScore: 0, // Will be set below
  }));

  // Calculate overall scores (now includes risk if available)
  normalized.forEach((vault) => {
    if (hasRiskData && vault.riskPercentile !== undefined) {
      // Include risk in scoring: 40% APR, 30% TVL, 30% Safety (inverted risk)
      vault.overallScore =
        calculateOverallScore(vault.aprPercentile, vault.tvlPercentile, { apr: 0.4, tvl: 0.3 }) +
        vault.riskPercentile * 0.3;
    } else {
      // Fallback to original weighting if no risk data
      vault.overallScore = calculateOverallScore(vault.aprPercentile, vault.tvlPercentile);
    }
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

  // Calculate average risk if available
  const vaultsWithRisk = vaults.filter((v) => v.riskScore !== undefined);
  const averageRisk =
    vaultsWithRisk.length > 0
      ? vaultsWithRisk.reduce((sum, v) => sum + (v.riskScore || 0), 0) / vaultsWithRisk.length
      : undefined;

  // Find extremes
  const sortedByApr = [...vaults].sort((a, b) => b.apr - a.apr);
  const sortedByTvl = [...vaults].sort((a, b) => b.tvl - a.tvl);

  // Find safest and riskiest vaults if risk data available
  let safestVault, riskiestVault;
  if (vaultsWithRisk.length > 0) {
    const sortedByRisk = [...vaultsWithRisk].sort(
      (a, b) => (a.riskScore || 0) - (b.riskScore || 0)
    );
    safestVault = {
      address: sortedByRisk[0].address,
      name: sortedByRisk[0].name,
      riskScore: sortedByRisk[0].riskScore || 0,
      riskLevel: sortedByRisk[0].riskLevel || 'Unknown',
    };
    riskiestVault = {
      address: sortedByRisk[sortedByRisk.length - 1].address,
      name: sortedByRisk[sortedByRisk.length - 1].name,
      riskScore: sortedByRisk[sortedByRisk.length - 1].riskScore || 0,
      riskLevel: sortedByRisk[sortedByRisk.length - 1].riskLevel || 'Unknown',
    };
  }

  return {
    totalVaults: vaults.length,
    averageTvl,
    averageApr,
    averageRisk,
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
    safestVault,
    riskiestVault,
  };
}

/**
 * Format comparison output as markdown table
 * @param vaults Normalized vaults with rankings
 * @returns Markdown formatted table
 */
export function formatComparisonTable(vaults: NormalizedVault[]): string {
  // Check if we have risk data
  const hasRiskData = vaults.some((v) => v.riskScore !== undefined);
  // Check if we have fee data
  const hasFeeData = vaults.some((v) => v.fees !== undefined);

  // Risk level emoji helper
  const riskEmoji = (level?: string): string => {
    switch (level) {
      case 'Low':
        return '🟢';
      case 'Medium':
        return '🟡';
      case 'High':
        return '🟠';
      case 'Critical':
        return '🔴';
      default:
        return '';
    }
  };

  // Format fee as percentage (basis points to %)
  const formatFee = (bps?: number): string => {
    if (bps === undefined) return 'N/A';
    return `${(bps / 100).toFixed(2)}%`;
  };

  // Build header based on data availability
  let header = '| Rank | Vault | TVL | APR |';
  let separator = '|------|-------|-----|-----|';

  if (hasFeeData) {
    header += ' Mgmt Fee | Perf Fee |';
    separator += '----------|----------|';
  }

  if (hasRiskData) {
    header += ' Risk |';
    separator += '------|';
  }

  header += ' Score | TVL Δ | APR Δ |';
  separator += '-------|-------|-------|';

  if (hasRiskData) {
    header += ' Risk Δ |';
    separator += '--------|';
  }

  header += '\n' + separator + '\n';

  const rows = vaults
    .map((v) => {
      const tvlFormatted = `$${(v.tvl / 1000000).toFixed(2)}M`;
      // APR values from API are already percentages (e.g., 4.12 means 4.12%)
      const aprFormatted = `${v.apr.toFixed(2)}%`;
      const scoreFormatted = v.overallScore.toFixed(1);
      const tvlDeltaFormatted = `${v.tvlDelta > 0 ? '+' : ''}${v.tvlDelta.toFixed(1)}%`;
      const aprDeltaFormatted = `${v.aprDelta > 0 ? '+' : ''}${v.aprDelta.toFixed(1)}%`;

      let row = `| ${v.rank} | ${v.name} (${v.symbol}) | ${tvlFormatted} | ${aprFormatted} |`;

      if (hasFeeData) {
        const mgmtFeeFormatted = formatFee(v.fees?.managementFee);
        const perfFeeFormatted = formatFee(v.fees?.performanceFee);
        row += ` ${mgmtFeeFormatted} | ${perfFeeFormatted} |`;
      }

      if (hasRiskData) {
        const riskFormatted =
          v.riskScore !== undefined
            ? `${riskEmoji(v.riskLevel)} ${(v.riskScore * 100).toFixed(1)}%`
            : 'N/A';
        row += ` ${riskFormatted} |`;
      }

      row += ` ${scoreFormatted} | ${tvlDeltaFormatted} | ${aprDeltaFormatted} |`;

      if (hasRiskData) {
        const riskDeltaFormatted =
          v.riskDelta !== undefined
            ? `${v.riskDelta > 0 ? '+' : ''}${v.riskDelta.toFixed(1)}%`
            : 'N/A';
        row += ` ${riskDeltaFormatted} |`;
      }

      return row;
    })
    .join('\n');

  return header + rows;
}
