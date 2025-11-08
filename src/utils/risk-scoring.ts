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
  aprConsistencyRisk: number;
  yieldSustainabilityRisk: number;
  settlementRisk: number;
  integrationComplexityRisk: number;
  capacityUtilizationRisk: number;
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
 * Based on curator's track record, professional signals, and vault management
 *
 * @param curatorVaultCount - Number of vaults managed by curator
 * @param curatorSuccessRate - Success rate (0-1) of curator's vaults
 * @param professionalSignals - Professional indicators: website, description, multiple curators
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateCuratorRisk(
  curatorVaultCount: number,
  curatorSuccessRate: number = 0.5,
  professionalSignals?: {
    hasWebsite: boolean;
    hasDescription: boolean;
    multipleCurators: boolean;
    curatorCount: number;
  }
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

  // Apply professional signals if available
  let professionalAdjustment = 0;
  if (professionalSignals) {
    // Website presence indicates professionalism (-0.1)
    if (professionalSignals.hasWebsite) {
      professionalAdjustment -= 0.1;
    }

    // Description quality indicates transparency (-0.1)
    if (professionalSignals.hasDescription) {
      professionalAdjustment -= 0.1;
    }

    // Multiple curators reduce centralization risk (-0.15)
    if (professionalSignals.multipleCurators) {
      professionalAdjustment -= 0.15;
    }

    // Additional curator count bonus (max -0.1 for 5+ curators)
    if (professionalSignals.curatorCount > 1) {
      const curatorCountBonus = Math.min(0.1, (professionalSignals.curatorCount - 1) * 0.025);
      professionalAdjustment -= curatorCountBonus;
    }
  }

  return Math.max(0, Math.min(1, experienceRisk + successRateAdjustment + professionalAdjustment));
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
 * Calculate APR consistency risk score
 * Analyzes volatility of returns across different time periods
 *
 * @param aprData - APR values across different time periods
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateAPRConsistencyRisk(aprData: {
  weeklyApr?: number;
  monthlyApr?: number;
  yearlyApr?: number;
  inceptionApr?: number;
}): number {
  const aprs = [
    aprData.weeklyApr,
    aprData.monthlyApr,
    aprData.yearlyApr,
    aprData.inceptionApr,
  ].filter((apr): apr is number => typeof apr === 'number' && apr >= 0);

  if (aprs.length < 2) {
    return 0.5; // Insufficient data = medium risk
  }

  // Calculate coefficient of variation (CV = stdDev / mean)
  const mean = aprs.reduce((sum, apr) => sum + apr, 0) / aprs.length;

  if (mean === 0) {
    return 0.5; // No returns = medium risk
  }

  const variance = aprs.reduce((sum, apr) => sum + Math.pow(apr - mean, 2), 0) / aprs.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / Math.abs(mean);

  // Score based on consistency (lower CV = lower risk)
  if (coefficientOfVariation < 0.1) {
    return 0.1; // Very consistent (<10% variation) = low risk
  } else if (coefficientOfVariation < 0.25) {
    return 0.3; // Moderately consistent (<25% variation)
  } else if (coefficientOfVariation < 0.5) {
    return 0.6; // Inconsistent (<50% variation)
  } else {
    return 1.0; // Highly volatile (>50% variation) = high risk
  }
}

/**
 * Calculate yield sustainability risk score
 * Assesses composition of APR sources (native vs temporary incentives)
 *
 * @param yieldComposition - Breakdown of yield sources
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateYieldSustainabilityRisk(yieldComposition: {
  totalApr: number;
  nativeYieldsApr: number;
  airdropsApr: number;
  incentivesApr: number;
}): number {
  const { totalApr, nativeYieldsApr } = yieldComposition;

  if (totalApr === 0) {
    return 0.5; // No yield data = medium risk
  }

  const sustainableRatio = nativeYieldsApr / totalApr;

  // Score based on sustainability (higher native yield = lower risk)
  if (sustainableRatio > 0.8) {
    return 0.1; // >80% native yields = sustainable
  } else if (sustainableRatio > 0.5) {
    return 0.4; // >50% native yields = balanced
  } else if (sustainableRatio > 0.2) {
    return 0.7; // >20% native yields = heavy on incentives
  } else {
    return 1.0; // <20% native yields = almost entirely temporary
  }
}

/**
 * Calculate settlement time risk score
 * Quantifies redemption delay and operational efficiency
 *
 * @param settlementData - Settlement time and pending operations data
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateSettlementRisk(settlementData: {
  averageSettlementDays: number;
  pendingOperationsRatio: number; // pending / safe assets
}): number {
  const { averageSettlementDays, pendingOperationsRatio } = settlementData;

  // Score based on settlement time (faster = lower risk)
  let timeScore = 0;
  if (averageSettlementDays < 1) {
    timeScore = 0.1; // Same day settlement
  } else if (averageSettlementDays < 3) {
    timeScore = 0.3; // 1-3 days
  } else if (averageSettlementDays < 7) {
    timeScore = 0.6; // 3-7 days
  } else {
    timeScore = 0.9; // >1 week
  }

  // Score based on pending operations (lower = lower risk)
  let pendingScore = 0;
  if (pendingOperationsRatio < 0.1) {
    pendingScore = 0.1; // <10% pending
  } else if (pendingOperationsRatio < 0.3) {
    pendingScore = 0.4; // <30% pending
  } else if (pendingOperationsRatio < 0.5) {
    pendingScore = 0.7; // <50% pending
  } else {
    pendingScore = 1.0; // >50% pending = operational bottleneck
  }

  return (timeScore + pendingScore) / 2;
}

/**
 * Calculate integration complexity risk score
 * Assesses smart contract attack surface based on number of integrations
 *
 * @param integrationCount - Number of DeFi protocol integrations
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateIntegrationComplexityRisk(integrationCount: number): number {
  if (integrationCount === 0) {
    return 0.3; // No integrations = simpler but limited
  } else if (integrationCount === 1) {
    return 0.1; // Single integration = focused strategy, low complexity
  } else if (integrationCount <= 3) {
    return 0.4; // Moderate complexity
  } else if (integrationCount <= 5) {
    return 0.7; // High complexity
  } else {
    return 1.0; // Very high complexity = large attack surface
  }
}

/**
 * Calculate capacity utilization risk score
 * Assesses deposit headroom and demand signals
 *
 * @param utilizationData - Capacity and utilization data
 * @returns Risk score 0-1 (0 = lowest risk, 1 = highest risk)
 */
export function calculateCapacityUtilizationRisk(utilizationData: {
  totalAssets: number;
  maxCapacity: number | null;
}): number {
  const { totalAssets, maxCapacity } = utilizationData;

  if (!maxCapacity || maxCapacity === 0) {
    return 0.2; // No capacity limit = flexible (low risk)
  }

  const utilizationRatio = totalAssets / maxCapacity;

  if (utilizationRatio < 0.3) {
    return 0.6; // Under-utilized (<30%) = demand concern
  } else if (utilizationRatio < 0.7) {
    return 0.2; // Healthy utilization (30-70%)
  } else if (utilizationRatio < 0.9) {
    return 0.4; // Getting full (70-90%)
  } else {
    return 0.8; // Near capacity (>90%) = deposit risk
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
  // Weighted average of 12 risk factors (updated distribution)
  const weights = {
    tvl: 0.1,
    concentration: 0.1,
    volatility: 0.15,
    age: 0.1,
    curator: 0.1,
    fee: 0.1,
    liquidity: 0.1,
    aprConsistency: 0.15, // NEW - Performance predictability
    yieldSustainability: 0.05, // NEW - APR quality
    settlement: 0.05, // NEW - Operational efficiency (combined with liquidity)
    integrationComplexity: 0.05, // NEW - Technical risk
    capacityUtilization: 0.05, // NEW - Operational signal
  };

  const overallRisk =
    breakdown.tvlRisk * weights.tvl +
    breakdown.concentrationRisk * weights.concentration +
    breakdown.volatilityRisk * weights.volatility +
    breakdown.ageRisk * weights.age +
    breakdown.curatorRisk * weights.curator +
    breakdown.feeRisk * weights.fee +
    breakdown.liquidityRisk * weights.liquidity +
    breakdown.aprConsistencyRisk * weights.aprConsistency +
    breakdown.yieldSustainabilityRisk * weights.yieldSustainability +
    breakdown.settlementRisk * weights.settlement +
    breakdown.integrationComplexityRisk * weights.integrationComplexity +
    breakdown.capacityUtilizationRisk * weights.capacityUtilization;

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
  curatorProfessionalSignals?: {
    hasWebsite: boolean;
    hasDescription: boolean;
    multipleCurators: boolean;
    curatorCount: number;
  };
  managementFee: number;
  performanceFee: number;
  performanceFeeActive: boolean;
  safeAssets: number;
  pendingRedemptions: number;
  // New parameters for enhanced risk factors
  aprData?: {
    weeklyApr?: number;
    monthlyApr?: number;
    yearlyApr?: number;
    inceptionApr?: number;
  };
  yieldComposition?: {
    totalApr: number;
    nativeYieldsApr: number;
    airdropsApr: number;
    incentivesApr: number;
  };
  settlementData?: {
    averageSettlementDays: number;
    pendingOperationsRatio: number;
  };
  integrationCount?: number;
  capacityData?: {
    totalAssets: number;
    maxCapacity: number | null;
  };
}): RiskScoreBreakdown {
  const tvlRisk = calculateTVLRisk(params.tvl);
  const concentrationRisk = calculateConcentrationRisk(params.tvl, params.totalProtocolTVL);
  const volatilityRisk = calculateVolatilityRisk(params.priceHistory);
  const ageRisk = calculateAgeRisk(params.ageInDays);
  const curatorRisk = calculateCuratorRisk(
    params.curatorVaultCount,
    params.curatorSuccessRate,
    params.curatorProfessionalSignals
  );
  const feeRisk = calculateFeeRisk(
    params.managementFee,
    params.performanceFee,
    params.performanceFeeActive
  );
  const liquidityRisk = calculateLiquidityRisk(params.safeAssets, params.pendingRedemptions);

  // Calculate new risk factors (with defaults if data not provided)
  const aprConsistencyRisk = params.aprData ? calculateAPRConsistencyRisk(params.aprData) : 0.5; // Default to medium risk if no data

  const yieldSustainabilityRisk = params.yieldComposition
    ? calculateYieldSustainabilityRisk(params.yieldComposition)
    : 0.5; // Default to medium risk if no data

  const settlementRisk = params.settlementData
    ? calculateSettlementRisk(params.settlementData)
    : 0.5; // Default to medium risk if no data

  const integrationComplexityRisk =
    params.integrationCount !== undefined
      ? calculateIntegrationComplexityRisk(params.integrationCount)
      : 0.5; // Default to medium risk if no data

  const capacityUtilizationRisk = params.capacityData
    ? calculateCapacityUtilizationRisk(params.capacityData)
    : 0.2; // Default to low risk (no capacity limit)

  const { overallRisk, riskLevel } = calculateOverallRisk({
    tvlRisk,
    concentrationRisk,
    volatilityRisk,
    ageRisk,
    curatorRisk,
    feeRisk,
    liquidityRisk,
    aprConsistencyRisk,
    yieldSustainabilityRisk,
    settlementRisk,
    integrationComplexityRisk,
    capacityUtilizationRisk,
  });

  return {
    tvlRisk,
    concentrationRisk,
    volatilityRisk,
    ageRisk,
    curatorRisk,
    feeRisk,
    liquidityRisk,
    aprConsistencyRisk,
    yieldSustainabilityRisk,
    settlementRisk,
    integrationComplexityRisk,
    capacityUtilizationRisk,
    overallRisk,
    riskLevel,
  };
}
