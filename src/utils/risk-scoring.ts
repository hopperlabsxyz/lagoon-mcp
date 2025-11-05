/**
 * Risk Scoring Utility
 *
 * Multi-factor risk analysis algorithms for vault assessment.
 * Provides comprehensive risk scoring across multiple dimensions.
 */

/**
 * Risk score breakdown by category
 */
export interface RiskScoreBreakdown {
  tvlRisk: number;
  concentrationRisk: number;
  volatilityRisk: number;
  ageRisk: number;
  curatorRisk: number;
  feeRisk: number;
  liquidityRisk: number;
  overallRisk: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

/**
 * Risk thresholds for scoring
 */
export const RISK_THRESHOLDS = {
  // TVL thresholds (USD)
  TVL_VERY_HIGH: 10_000_000, // >$10M = very low risk
  TVL_HIGH: 1_000_000, // >$1M = low risk
  TVL_MEDIUM: 100_000, // >$100K = medium risk
  TVL_LOW: 10_000, // >$10K = high risk
  // Below $10K = critical risk

  // Concentration thresholds (percentage of total assets)
  CONCENTRATION_LOW: 0.1, // <10% = low risk
  CONCENTRATION_MEDIUM: 0.25, // <25% = medium risk
  CONCENTRATION_HIGH: 0.5, // <50% = high risk
  // >50% = critical risk

  // Volatility thresholds (standard deviation of daily returns)
  VOLATILITY_LOW: 0.02, // <2% = low risk
  VOLATILITY_MEDIUM: 0.05, // <5% = medium risk
  VOLATILITY_HIGH: 0.1, // <10% = high risk
  // >10% = critical risk

  // Age thresholds (days)
  AGE_MATURE: 365, // >1 year = low risk
  AGE_ESTABLISHED: 90, // >3 months = medium risk
  AGE_NEW: 30, // >1 month = high risk
  // <1 month = critical risk

  // Overall risk score thresholds
  OVERALL_LOW: 0.3,
  OVERALL_MEDIUM: 0.6,
  OVERALL_HIGH: 0.8,
  // >0.8 = critical
};

/**
 * Calculate TVL-based risk score
 * Higher TVL = lower risk (more liquidity and market validation)
 *
 * @param tvl - Total value locked in USD
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateTVLRisk(tvl: number): number {
  if (tvl >= RISK_THRESHOLDS.TVL_VERY_HIGH) {
    return 0.1; // Very low risk
  } else if (tvl >= RISK_THRESHOLDS.TVL_HIGH) {
    return 0.2; // Low risk
  } else if (tvl >= RISK_THRESHOLDS.TVL_MEDIUM) {
    return 0.5; // Medium risk
  } else if (tvl >= RISK_THRESHOLDS.TVL_LOW) {
    return 0.8; // High risk
  } else {
    return 1.0; // Critical risk
  }
}

/**
 * Calculate concentration risk score
 * Measures vault's share of total protocol TVL
 *
 * @param vaultTVL - Vault's TVL in USD
 * @param totalProtocolTVL - Total protocol TVL in USD
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateConcentrationRisk(vaultTVL: number, totalProtocolTVL: number): number {
  if (totalProtocolTVL === 0) {
    return 0.5; // Medium risk if no protocol data
  }

  const concentration = vaultTVL / totalProtocolTVL;

  if (concentration < RISK_THRESHOLDS.CONCENTRATION_LOW) {
    return 0.1; // Low concentration = low risk
  } else if (concentration < RISK_THRESHOLDS.CONCENTRATION_MEDIUM) {
    return 0.4; // Medium concentration
  } else if (concentration < RISK_THRESHOLDS.CONCENTRATION_HIGH) {
    return 0.7; // High concentration
  } else {
    return 1.0; // Critical concentration risk
  }
}

/**
 * Calculate volatility risk score
 * Based on price volatility over time
 *
 * @param pricePoints - Array of price per share values over time
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateVolatilityRisk(pricePoints: number[]): number {
  if (pricePoints.length < 2) {
    return 0.5; // Medium risk if insufficient data
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < pricePoints.length; i++) {
    if (pricePoints[i - 1] !== 0) {
      const dailyReturn = (pricePoints[i] - pricePoints[i - 1]) / pricePoints[i - 1];
      returns.push(dailyReturn);
    }
  }

  if (returns.length === 0) {
    return 0.5; // Medium risk if no valid returns
  }

  // Calculate standard deviation
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Map standard deviation to risk score
  if (stdDev < RISK_THRESHOLDS.VOLATILITY_LOW) {
    return 0.1; // Low volatility = low risk
  } else if (stdDev < RISK_THRESHOLDS.VOLATILITY_MEDIUM) {
    return 0.4; // Medium volatility
  } else if (stdDev < RISK_THRESHOLDS.VOLATILITY_HIGH) {
    return 0.7; // High volatility
  } else {
    return 1.0; // Critical volatility risk
  }
}

/**
 * Calculate age-based risk score
 * Newer vaults are riskier (less battle-tested)
 *
 * @param ageInDays - Vault age in days
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateAgeRisk(ageInDays: number): number {
  if (ageInDays >= RISK_THRESHOLDS.AGE_MATURE) {
    return 0.1; // Mature vault = low risk
  } else if (ageInDays >= RISK_THRESHOLDS.AGE_ESTABLISHED) {
    return 0.4; // Established vault = medium-low risk
  } else if (ageInDays >= RISK_THRESHOLDS.AGE_NEW) {
    return 0.7; // New vault = high risk
  } else {
    return 1.0; // Very new vault = critical risk
  }
}

/**
 * Calculate curator reputation risk score
 * Based on curator's track record and number of managed vaults
 *
 * @param curatorVaultCount - Number of vaults managed by curator
 * @param curatorSuccessRate - Success rate (0-1) of curator's vaults
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateCuratorRisk(
  curatorVaultCount: number,
  curatorSuccessRate: number = 0.5
): number {
  // Base risk on experience (vault count)
  let experienceRisk: number;
  if (curatorVaultCount >= 10) {
    experienceRisk = 0.1; // Highly experienced
  } else if (curatorVaultCount >= 5) {
    experienceRisk = 0.3; // Moderately experienced
  } else if (curatorVaultCount >= 2) {
    experienceRisk = 0.6; // Limited experience
  } else {
    experienceRisk = 0.9; // New curator
  }

  // Adjust based on success rate
  const successRateAdjustment = (1 - curatorSuccessRate) * 0.5; // Max 0.5 adjustment

  return Math.min(1, experienceRisk + successRateAdjustment);
}

/**
 * Calculate fee risk score
 * Based on management fees and performance fee impact
 *
 * @param managementFee - Annual management fee percentage (e.g., 2 for 2%)
 * @param performanceFee - Performance fee percentage (e.g., 20 for 20%)
 * @param performanceFeeActive - Whether performance fee is currently active (above HWM)
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateFeeRisk(
  managementFee: number,
  performanceFee: number,
  performanceFeeActive: boolean
): number {
  // Calculate total fee drag (worst case scenario)
  const annualFeeDrag = managementFee + (performanceFeeActive ? performanceFee * 0.1 : 0);

  // Score based on total fee impact
  if (annualFeeDrag < 1) {
    return 0.1; // Very low fees = low risk
  } else if (annualFeeDrag < 2) {
    return 0.3; // Low fees
  } else if (annualFeeDrag < 3) {
    return 0.5; // Moderate fees
  } else if (annualFeeDrag < 5) {
    return 0.7; // High fees
  } else {
    return 1.0; // Very high fees = critical risk
  }
}

/**
 * Calculate liquidity risk score
 * Based on safe assets vs pending redemptions coverage
 *
 * @param safeAssets - Assets available for immediate redemptions (USD)
 * @param pendingRedemptions - Outstanding redemption requests (USD)
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateLiquidityRisk(safeAssets: number, pendingRedemptions: number): number {
  // If no pending redemptions, liquidity risk is low
  if (pendingRedemptions === 0) {
    return 0.1; // No redemption pressure = low risk
  }

  // Calculate coverage ratio
  const coverageRatio = safeAssets / pendingRedemptions;

  // Score based on coverage
  if (coverageRatio >= 2.0) {
    return 0.1; // 200%+ coverage = very low risk
  } else if (coverageRatio >= 1.5) {
    return 0.3; // 150%+ coverage = low risk
  } else if (coverageRatio >= 1.0) {
    return 0.5; // 100%+ coverage = medium risk
  } else if (coverageRatio >= 0.5) {
    return 0.7; // 50%+ coverage = high risk
  } else {
    return 1.0; // <50% coverage = critical risk
  }
}

/**
 * Calculate overall risk score with weighted factors
 *
 * @param breakdown - Individual risk factor scores
 * @returns Overall risk score 0-1 and risk level
 */
export function calculateOverallRisk(
  breakdown: Omit<RiskScoreBreakdown, 'overallRisk' | 'riskLevel'>
): {
  overallRisk: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
} {
  // Weighted average of 7 risk factors (14.3% weight each)
  const weights = {
    tvl: 0.143,
    concentration: 0.143,
    volatility: 0.143,
    age: 0.143,
    curator: 0.143,
    fee: 0.143,
    liquidity: 0.142, // 0.142 to ensure total = 1.0
  };

  const overallRisk =
    breakdown.tvlRisk * weights.tvl +
    breakdown.concentrationRisk * weights.concentration +
    breakdown.volatilityRisk * weights.volatility +
    breakdown.ageRisk * weights.age +
    breakdown.curatorRisk * weights.curator +
    breakdown.feeRisk * weights.fee +
    breakdown.liquidityRisk * weights.liquidity;

  // Determine risk level
  let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  if (overallRisk < RISK_THRESHOLDS.OVERALL_LOW) {
    riskLevel = 'Low';
  } else if (overallRisk < RISK_THRESHOLDS.OVERALL_MEDIUM) {
    riskLevel = 'Medium';
  } else if (overallRisk < RISK_THRESHOLDS.OVERALL_HIGH) {
    riskLevel = 'High';
  } else {
    riskLevel = 'Critical';
  }

  return { overallRisk, riskLevel };
}

/**
 * Generate comprehensive risk analysis
 *
 * @param params - Risk analysis parameters
 * @returns Complete risk score breakdown
 */
export function analyzeRisk(params: {
  tvl: number;
  totalProtocolTVL: number;
  priceHistory: number[];
  ageInDays: number;
  curatorVaultCount: number;
  curatorSuccessRate?: number;
  managementFee: number;
  performanceFee: number;
  performanceFeeActive: boolean;
  safeAssets: number;
  pendingRedemptions: number;
}): RiskScoreBreakdown {
  const tvlRisk = calculateTVLRisk(params.tvl);
  const concentrationRisk = calculateConcentrationRisk(params.tvl, params.totalProtocolTVL);
  const volatilityRisk = calculateVolatilityRisk(params.priceHistory);
  const ageRisk = calculateAgeRisk(params.ageInDays);
  const curatorRisk = calculateCuratorRisk(params.curatorVaultCount, params.curatorSuccessRate);
  const feeRisk = calculateFeeRisk(
    params.managementFee,
    params.performanceFee,
    params.performanceFeeActive
  );
  const liquidityRisk = calculateLiquidityRisk(params.safeAssets, params.pendingRedemptions);

  const { overallRisk, riskLevel } = calculateOverallRisk({
    tvlRisk,
    concentrationRisk,
    volatilityRisk,
    ageRisk,
    curatorRisk,
    feeRisk,
    liquidityRisk,
  });

  return {
    tvlRisk,
    concentrationRisk,
    volatilityRisk,
    ageRisk,
    curatorRisk,
    feeRisk,
    liquidityRisk,
    overallRisk,
    riskLevel,
  };
}
