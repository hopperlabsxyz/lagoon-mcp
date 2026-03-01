/**
 * Value at Risk (VaR) and Conditional VaR (CVaR) Utility
 *
 * Risk quantification for DeFi vault returns using historical simulation.
 * Provides tail-risk metrics (VaR, CVaR) and downside-adjusted performance
 * measurement (Sortino ratio) for vault assessment.
 */

/** Minimum number of return observations required for meaningful analysis */
const MIN_DATA_POINTS = 10;

/**
 * VaR and CVaR analysis results for a return series.
 * All loss values are expressed as positive percentages (e.g., 2.5 means 2.5% loss).
 */
export interface VaRAnalysis {
  /** VaR at 95% confidence level (percentage loss not exceeded 95% of the time) */
  var95: number;
  /** VaR at 99% confidence level (percentage loss not exceeded 99% of the time) */
  var99: number;
  /** CVaR/Expected Shortfall at 95% (mean loss beyond VaR95, as percentage) */
  cvar95: number;
  /** CVaR/Expected Shortfall at 99% (mean loss beyond VaR99, as percentage) */
  cvar99: number;
  /** Number of return observations used in the analysis */
  dataPoints: number;
}

/**
 * Calculate Value at Risk (VaR) and Conditional VaR (CVaR) using historical simulation.
 *
 * Historical simulation sorts observed returns and reads off percentiles directly,
 * making no distributional assumptions. This is appropriate for DeFi returns which
 * often exhibit fat tails and skewness that parametric methods underestimate.
 *
 * @param returns - Array of periodic returns as decimal fractions (e.g., -0.02 = -2% loss)
 * @returns VaR analysis with loss magnitudes as positive percentages
 *
 * @example
 * ```ts
 * const dailyReturns = [-0.01, 0.005, -0.03, 0.02, ...]; // 30+ observations
 * const analysis = calculateVaR(dailyReturns);
 * // analysis.var95 = 2.5 means "95% of the time, daily loss does not exceed 2.5%"
 * ```
 */
export function calculateVaR(returns: number[]): VaRAnalysis {
  const emptyResult: VaRAnalysis = {
    var95: 0,
    var99: 0,
    cvar95: 0,
    cvar99: 0,
    dataPoints: 0,
  };

  if (returns.length < MIN_DATA_POINTS) {
    return emptyResult;
  }

  // Sort returns ascending (worst losses first)
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;

  // VaR at confidence level X = the value at the (1-X) percentile of sorted returns.
  // For 95% confidence, we take the 5th percentile (index = floor(0.05 * n)).
  // For 99% confidence, we take the 1st percentile (index = floor(0.01 * n)).
  const var95Index = Math.floor(0.05 * n);
  const var99Index = Math.floor(0.01 * n);

  const var95Value = sorted[var95Index];
  const var99Value = sorted[var99Index];

  // CVaR (Expected Shortfall) = mean of all returns at or below the VaR threshold.
  // This captures the average severity of tail losses, not just the boundary.
  const cvar95 = calculateExpectedShortfall(sorted, var95Index);
  const cvar99 = calculateExpectedShortfall(sorted, var99Index);

  // Convert to positive percentage loss magnitudes.
  // A return of -0.02 becomes 2.0 (representing 2% loss).
  return {
    var95: toPositiveLossPercentage(var95Value),
    var99: toPositiveLossPercentage(var99Value),
    cvar95: toPositiveLossPercentage(cvar95),
    cvar99: toPositiveLossPercentage(cvar99),
    dataPoints: n,
  };
}

/**
 * Calculate the Sortino ratio for a return series.
 *
 * Sortino ratio improves on Sharpe by penalizing only downside volatility,
 * which better reflects investor preferences in asymmetric return distributions
 * typical of DeFi strategies.
 *
 * Formula: (mean return - risk-free rate) / downside deviation
 *
 * @param returns - Array of periodic returns as decimal fractions
 * @param riskFreeRate - Annualized risk-free rate as decimal (default: 0.02 = 2%)
 * @returns Sortino ratio, or 0 if insufficient data or no downside deviation
 *
 * @example
 * ```ts
 * const weeklyReturns = [0.01, -0.005, 0.015, -0.02, ...];
 * const sortino = calculateSortinoRatio(weeklyReturns, 0.02);
 * ```
 */
export function calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length < 2) {
    return 0;
  }

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Downside deviation: sqrt of mean squared negative excess returns.
  // Only returns below the risk-free rate (per period) contribute.
  const negativeExcessReturns = returns.filter((r) => r < riskFreeRate);

  if (negativeExcessReturns.length === 0) {
    return 0;
  }

  const sumSquaredDownside = negativeExcessReturns.reduce(
    (sum, r) => sum + (r - riskFreeRate) ** 2,
    0
  );
  const downsideDeviation = Math.sqrt(sumSquaredDownside / returns.length);

  if (downsideDeviation === 0) {
    return 0;
  }

  return (meanReturn - riskFreeRate) / downsideDeviation;
}

/**
 * Calculate Expected Shortfall (mean of returns at or below the VaR index).
 *
 * @param sortedReturns - Returns sorted ascending (worst first)
 * @param varIndex - Index of the VaR threshold in the sorted array
 * @returns Mean of all returns from index 0 through varIndex (inclusive)
 */
function calculateExpectedShortfall(sortedReturns: number[], varIndex: number): number {
  // Include all returns from the worst up to and including the VaR threshold
  const tailCount = varIndex + 1;

  if (tailCount === 0) {
    return sortedReturns[0];
  }

  let sum = 0;
  for (let i = 0; i < tailCount; i++) {
    sum += sortedReturns[i];
  }

  return sum / tailCount;
}

/**
 * Convert a return value to a positive loss percentage.
 * Negative returns become positive loss magnitudes; positive returns become 0 (no loss).
 *
 * @param returnValue - Return as decimal fraction (e.g., -0.025)
 * @returns Positive percentage loss (e.g., 2.5), or 0 if return is non-negative
 */
function toPositiveLossPercentage(returnValue: number): number {
  if (returnValue >= 0) {
    return 0;
  }
  return Math.abs(returnValue) * 100;
}
