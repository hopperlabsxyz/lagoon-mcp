/**
 * Portfolio Optimization Utility
 *
 * Portfolio allocation and rebalancing algorithms for optimal vault distribution.
 * Provides risk-adjusted portfolio recommendations and rebalancing guidance.
 */

import { RiskScoreBreakdown } from './risk-scoring.js';
import { safeDivide } from './safe-math.js';

/**
 * Portfolio position with current and target allocations
 */
export interface PortfolioPosition {
  vaultAddress: string;
  vaultName: string;
  chainId: number;
  currentAllocation: number; // Percentage (0-100)
  targetAllocation: number; // Percentage (0-100)
  currentValueUsd: number;
  targetValueUsd: number;
  rebalanceAmount: number; // Positive = buy, Negative = sell
  rebalancePercentage: number; // Percentage change needed
  vault: VaultForOptimization; // Reference to full vault data for risk analysis
}

/**
 * Portfolio optimization result
 */
export interface PortfolioOptimization {
  strategy: 'equal_weight' | 'risk_parity' | 'max_sharpe' | 'min_variance';
  totalValueUsd: number;
  positions: PortfolioPosition[];
  metrics: {
    expectedReturn: number; // Annualized expected return percentage
    portfolioRisk: number; // Portfolio volatility (standard deviation)
    sharpeRatio: number; // Risk-adjusted return
    diversificationScore: number; // 0-1 scale
  };
  rebalanceNeeded: boolean;
  rebalanceThreshold: number; // Minimum drift percentage to trigger rebalancing
  recommendations: string[];
}

/**
 * Vault data for portfolio optimization
 */
export interface VaultForOptimization {
  address: string;
  name: string;
  chainId: number;
  currentValueUsd: number;
  expectedApr: number;
  volatility: number; // Standard deviation of returns
  riskScore: number; // 0-1 scale (comprehensive 12-factor risk)
  riskBreakdown?: RiskScoreBreakdown; // Detailed risk factor breakdown
}

/**
 * Calculate equal-weight allocation strategy
 * Allocates portfolio equally across all vaults
 */
export function calculateEqualWeight(
  vaults: VaultForOptimization[],
  totalValueUsd: number
): PortfolioPosition[] {
  // Guard: empty array
  if (vaults.length === 0) {
    return [];
  }

  const targetAllocation = 100 / vaults.length;

  return vaults.map((vault) => {
    const currentAllocation = safeDivide(vault.currentValueUsd, totalValueUsd, 0) * 100;
    const targetValueUsd = (targetAllocation / 100) * totalValueUsd;
    const rebalanceAmount = targetValueUsd - vault.currentValueUsd;
    // Guard: avoid division by zero when currentValueUsd is 0
    const rebalancePercentage = safeDivide(
      rebalanceAmount,
      vault.currentValueUsd,
      rebalanceAmount > 0 ? 100 : rebalanceAmount < 0 ? -100 : 0
    );

    return {
      vaultAddress: vault.address,
      vaultName: vault.name,
      chainId: vault.chainId,
      currentAllocation,
      targetAllocation,
      currentValueUsd: vault.currentValueUsd,
      targetValueUsd,
      rebalanceAmount,
      rebalancePercentage,
      vault, // Include full vault data for risk analysis
    };
  });
}

/**
 * Calculate risk-parity allocation strategy
 * Allocates based on inverse risk (lower risk = higher allocation)
 */
export function calculateRiskParity(
  vaults: VaultForOptimization[],
  totalValueUsd: number
): PortfolioPosition[] {
  // Guard: empty array
  if (vaults.length === 0) {
    return [];
  }

  // Calculate inverse risk scores (lower risk = higher weight)
  const RISK_EPSILON = 0.01;
  const inverseRisks = vaults.map((v) => safeDivide(1, v.riskScore + RISK_EPSILON, 1));
  const totalInverseRisk = inverseRisks.reduce((sum, r) => sum + r, 0);

  // Guard: if all inverse risks sum to 0, fall back to equal weight
  if (totalInverseRisk === 0) {
    return calculateEqualWeight(vaults, totalValueUsd);
  }

  return vaults.map((vault, index) => {
    const targetAllocation =
      safeDivide(inverseRisks[index], totalInverseRisk, 100 / vaults.length) * 100;
    const currentAllocation = safeDivide(vault.currentValueUsd, totalValueUsd, 0) * 100;
    const targetValueUsd = (targetAllocation / 100) * totalValueUsd;
    const rebalanceAmount = targetValueUsd - vault.currentValueUsd;
    // Guard: avoid division by zero when currentValueUsd is 0
    const rebalancePercentage = safeDivide(
      rebalanceAmount,
      vault.currentValueUsd,
      rebalanceAmount > 0 ? 100 : rebalanceAmount < 0 ? -100 : 0
    );

    return {
      vaultAddress: vault.address,
      vaultName: vault.name,
      chainId: vault.chainId,
      currentAllocation,
      targetAllocation,
      currentValueUsd: vault.currentValueUsd,
      targetValueUsd,
      rebalanceAmount,
      rebalancePercentage,
      vault, // Include full vault data for risk analysis
    };
  });
}

/**
 * Calculate maximum Sharpe ratio allocation strategy
 * Allocates to maximize risk-adjusted returns
 */
export function calculateMaxSharpe(
  vaults: VaultForOptimization[],
  totalValueUsd: number,
  riskFreeRate: number = 2.0 // Default 2% risk-free rate
): PortfolioPosition[] {
  // Guard: empty array
  if (vaults.length === 0) {
    return [];
  }

  // Calculate Sharpe ratios for each vault
  const VOLATILITY_EPSILON = 0.01;
  const sharpeRatios = vaults.map((v) => {
    const excessReturn = v.expectedApr - riskFreeRate;
    return safeDivide(excessReturn, v.volatility + VOLATILITY_EPSILON, 0);
  });

  // Normalize Sharpe ratios to get weights (only positive Sharpe ratios)
  const positiveSharpes = sharpeRatios.map((s) => Math.max(0, s));
  const totalSharpe = positiveSharpes.reduce((sum, s) => sum + s, 0);

  // If all Sharpe ratios are negative or zero, fall back to equal weight
  if (totalSharpe === 0) {
    return calculateEqualWeight(vaults, totalValueUsd);
  }

  return vaults.map((vault, index) => {
    const targetAllocation =
      safeDivide(positiveSharpes[index], totalSharpe, 100 / vaults.length) * 100;
    const currentAllocation = safeDivide(vault.currentValueUsd, totalValueUsd, 0) * 100;
    const targetValueUsd = (targetAllocation / 100) * totalValueUsd;
    const rebalanceAmount = targetValueUsd - vault.currentValueUsd;
    // Guard: avoid division by zero when currentValueUsd is 0
    const rebalancePercentage = safeDivide(
      rebalanceAmount,
      vault.currentValueUsd,
      rebalanceAmount > 0 ? 100 : rebalanceAmount < 0 ? -100 : 0
    );

    return {
      vaultAddress: vault.address,
      vaultName: vault.name,
      chainId: vault.chainId,
      currentAllocation,
      targetAllocation,
      currentValueUsd: vault.currentValueUsd,
      targetValueUsd,
      rebalanceAmount,
      rebalancePercentage,
      vault, // Include full vault data for risk analysis
    };
  });
}

/**
 * Calculate minimum variance allocation strategy
 * Allocates to minimize portfolio volatility
 */
export function calculateMinVariance(
  vaults: VaultForOptimization[],
  totalValueUsd: number
): PortfolioPosition[] {
  // Guard: empty array
  if (vaults.length === 0) {
    return [];
  }

  // Allocate based on inverse variance (lower volatility = higher allocation)
  const VARIANCE_EPSILON = 0.0001;
  const inverseVariances = vaults.map((v) =>
    safeDivide(1, v.volatility * v.volatility + VARIANCE_EPSILON, 1)
  );
  const totalInverseVariance = inverseVariances.reduce((sum, v) => sum + v, 0);

  // Guard: if all inverse variances sum to 0, fall back to equal weight
  if (totalInverseVariance === 0) {
    return calculateEqualWeight(vaults, totalValueUsd);
  }

  return vaults.map((vault, index) => {
    const targetAllocation =
      safeDivide(inverseVariances[index], totalInverseVariance, 100 / vaults.length) * 100;
    const currentAllocation = safeDivide(vault.currentValueUsd, totalValueUsd, 0) * 100;
    const targetValueUsd = (targetAllocation / 100) * totalValueUsd;
    const rebalanceAmount = targetValueUsd - vault.currentValueUsd;
    // Guard: avoid division by zero when currentValueUsd is 0
    const rebalancePercentage = safeDivide(
      rebalanceAmount,
      vault.currentValueUsd,
      rebalanceAmount > 0 ? 100 : rebalanceAmount < 0 ? -100 : 0
    );

    return {
      vaultAddress: vault.address,
      vaultName: vault.name,
      chainId: vault.chainId,
      currentAllocation,
      targetAllocation,
      currentValueUsd: vault.currentValueUsd,
      targetValueUsd,
      rebalanceAmount,
      rebalancePercentage,
      vault, // Include full vault data for risk analysis
    };
  });
}

/**
 * Calculate portfolio metrics
 */
export function calculatePortfolioMetrics(
  positions: PortfolioPosition[],
  vaults: VaultForOptimization[],
  riskFreeRate: number = 2.0
): {
  expectedReturn: number;
  portfolioRisk: number;
  sharpeRatio: number;
  diversificationScore: number;
} {
  // Guard: empty arrays
  if (positions.length === 0 || vaults.length === 0) {
    return {
      expectedReturn: 0,
      portfolioRisk: 0,
      sharpeRatio: 0,
      diversificationScore: 0,
    };
  }

  // Calculate expected return (weighted average of vault APRs)
  const expectedReturn = vaults.reduce((sum, vault, index) => {
    // Guard: check positions array bounds
    const position = positions[index];
    if (!position) return sum;
    const weight = position.targetAllocation / 100;
    return sum + vault.expectedApr * weight;
  }, 0);

  // Calculate portfolio risk (simplified - weighted average volatility)
  // Note: This is a simplification; true portfolio variance requires correlation matrix
  const portfolioRisk = vaults.reduce((sum, vault, index) => {
    // Guard: check positions array bounds
    const position = positions[index];
    if (!position) return sum;
    const weight = position.targetAllocation / 100;
    return sum + vault.volatility * weight;
  }, 0);

  // Calculate Sharpe ratio
  const excessReturn = expectedReturn - riskFreeRate;
  const sharpeRatio = safeDivide(excessReturn, portfolioRisk, 0);

  // Calculate diversification score (1 - Herfindahl index)
  const herfindahl = positions.reduce((sum, pos) => {
    const weight = pos.targetAllocation / 100;
    return sum + weight * weight;
  }, 0);
  const diversificationScore = 1 - herfindahl;

  return {
    expectedReturn,
    portfolioRisk,
    sharpeRatio,
    diversificationScore,
  };
}

/**
 * Check if rebalancing is needed
 */
export function needsRebalancing(positions: PortfolioPosition[], threshold: number = 5.0): boolean {
  return positions.some(
    (pos) => Math.abs(pos.currentAllocation - pos.targetAllocation) > threshold
  );
}

/**
 * Generate optimization recommendations
 */
export function generateRecommendations(
  positions: PortfolioPosition[],
  metrics: PortfolioOptimization['metrics'],
  strategy: PortfolioOptimization['strategy']
): string[] {
  const recommendations: string[] = [];

  // Strategy description
  const strategyDescriptions = {
    equal_weight: 'Equal-weight strategy provides maximum diversification across all vaults',
    risk_parity: 'Risk-parity strategy balances risk contribution from each vault',
    max_sharpe: 'Maximum Sharpe ratio strategy optimizes risk-adjusted returns',
    min_variance: 'Minimum variance strategy minimizes portfolio volatility',
  };
  recommendations.push(strategyDescriptions[strategy]);

  // Portfolio metrics insights
  if (metrics.sharpeRatio > 2.0) {
    recommendations.push(
      `Excellent risk-adjusted returns (Sharpe ratio: ${metrics.sharpeRatio.toFixed(2)})`
    );
  } else if (metrics.sharpeRatio > 1.0) {
    recommendations.push(
      `Good risk-adjusted returns (Sharpe ratio: ${metrics.sharpeRatio.toFixed(2)})`
    );
  } else if (metrics.sharpeRatio > 0) {
    recommendations.push(
      `Moderate risk-adjusted returns (Sharpe ratio: ${metrics.sharpeRatio.toFixed(2)}) - consider higher-yield opportunities`
    );
  } else {
    recommendations.push(
      'Poor risk-adjusted returns - portfolio may not compensate adequately for risk'
    );
  }

  // Diversification insights
  if (metrics.diversificationScore > 0.8) {
    recommendations.push(
      `Highly diversified portfolio (score: ${(metrics.diversificationScore * 100).toFixed(0)}%)`
    );
  } else if (metrics.diversificationScore > 0.5) {
    recommendations.push(
      `Moderately diversified (score: ${(metrics.diversificationScore * 100).toFixed(0)}%) - consider adding more vaults`
    );
  } else {
    recommendations.push(
      `Low diversification (score: ${(metrics.diversificationScore * 100).toFixed(0)}%) - concentrated risk exposure`
    );
  }

  // Rebalancing recommendations
  const largestDrift = positions.reduce(
    (max, pos) => Math.max(max, Math.abs(pos.currentAllocation - pos.targetAllocation)),
    0
  );

  if (largestDrift > 10) {
    recommendations.push(
      `Significant drift detected (${largestDrift.toFixed(1)}%) - rebalancing recommended`
    );
  } else if (largestDrift > 5) {
    recommendations.push(`Moderate drift (${largestDrift.toFixed(1)}%) - consider rebalancing`);
  } else {
    recommendations.push('Portfolio well-balanced - no immediate rebalancing needed');
  }

  // Position-specific recommendations
  const overweightPositions = positions.filter(
    (pos) => pos.currentAllocation - pos.targetAllocation > 5
  );
  const underweightPositions = positions.filter(
    (pos) => pos.targetAllocation - pos.currentAllocation > 5
  );

  if (overweightPositions.length > 0) {
    const names = overweightPositions.map((p) => p.vaultName).join(', ');
    recommendations.push(`Consider reducing positions in: ${names}`);
  }

  if (underweightPositions.length > 0) {
    const names = underweightPositions.map((p) => p.vaultName).join(', ');
    recommendations.push(`Consider increasing positions in: ${names}`);
  }

  return recommendations;
}

/**
 * Optimize portfolio based on strategy
 *
 * @param vaults - Vaults with current positions and metrics
 * @param strategy - Optimization strategy to use
 * @param rebalanceThreshold - Minimum drift percentage to trigger rebalancing (default: 5%)
 * @param riskFreeRate - Risk-free rate for Sharpe ratio calculation (default: 2%)
 * @returns Portfolio optimization result with positions and recommendations
 */
export function optimizePortfolio(
  vaults: VaultForOptimization[],
  strategy: 'equal_weight' | 'risk_parity' | 'max_sharpe' | 'min_variance' = 'max_sharpe',
  rebalanceThreshold: number = 5.0,
  riskFreeRate: number = 2.0
): PortfolioOptimization {
  if (vaults.length === 0) {
    return {
      strategy,
      totalValueUsd: 0,
      positions: [],
      metrics: {
        expectedReturn: 0,
        portfolioRisk: 0,
        sharpeRatio: 0,
        diversificationScore: 0,
      },
      rebalanceNeeded: false,
      rebalanceThreshold,
      recommendations: ['No vaults in portfolio'],
    };
  }

  // Calculate total portfolio value
  const totalValueUsd = vaults.reduce((sum, v) => sum + v.currentValueUsd, 0);

  // Calculate target allocations based on strategy
  let positions: PortfolioPosition[];
  switch (strategy) {
    case 'equal_weight':
      positions = calculateEqualWeight(vaults, totalValueUsd);
      break;
    case 'risk_parity':
      positions = calculateRiskParity(vaults, totalValueUsd);
      break;
    case 'max_sharpe':
      positions = calculateMaxSharpe(vaults, totalValueUsd, riskFreeRate);
      break;
    case 'min_variance':
      positions = calculateMinVariance(vaults, totalValueUsd);
      break;
  }

  // Calculate portfolio metrics
  const metrics = calculatePortfolioMetrics(positions, vaults, riskFreeRate);

  // Check if rebalancing is needed
  const rebalanceNeeded = needsRebalancing(positions, rebalanceThreshold);

  // Generate recommendations
  const recommendations = generateRecommendations(positions, metrics, strategy);

  return {
    strategy,
    totalValueUsd,
    positions,
    metrics,
    rebalanceNeeded,
    rebalanceThreshold,
    recommendations,
  };
}
