/**
 * Yield Prediction Utility
 *
 * Trend analysis and forecasting algorithms for vault yield prediction.
 * Provides APR projections based on historical performance data.
 */

/**
 * Yield prediction result
 */
export interface YieldPrediction {
  currentAPY: number;
  predictedAPY: number;
  feeAdjustedAPY?: number; // Predicted APY after fees (net return to investor)
  confidence: number; // 0-1 scale
  trend: 'increasing' | 'decreasing' | 'stable';
  projectedReturns: {
    timeframe: '7d' | '30d' | '90d' | '1y';
    expectedReturn: number; // Percentage
    minReturn: number; // Confidence interval lower bound
    maxReturn: number; // Confidence interval upper bound
  }[];
  feeAdjustedReturns?: {
    timeframe: '7d' | '30d' | '90d' | '1y';
    expectedReturn: number; // Percentage after fees
    minReturn: number; // Confidence interval lower bound
    maxReturn: number; // Confidence interval upper bound
  }[];
  feeImpact?: {
    managementFee: number;
    performanceFee: number;
    totalAnnualFeeDrag: number;
    performanceFeeActive: boolean;
  };
  insights: string[];
}

/**
 * Historical data point for yield analysis
 */
export interface YieldDataPoint {
  timestamp: number;
  apy: number;
  tvl: number;
}

/**
 * Calculate simple moving average
 */
function calculateSMA(values: number[], period: number): number {
  if (values.length < period) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  const recentValues = values.slice(-period);
  return recentValues.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Calculate exponential moving average
 */
function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) {
    return 0;
  }

  if (values.length < period) {
    return calculateSMA(values, values.length);
  }

  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(values.slice(0, period), period);

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate linear regression for trend analysis
 */
function calculateLinearRegression(data: YieldDataPoint[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = data.length;

  if (n < 2) {
    return { slope: 0, intercept: data[0]?.apy || 0, r2: 0 };
  }

  // Normalize timestamps to prevent overflow
  const minTimestamp = Math.min(...data.map((d) => d.timestamp));
  const x = data.map((d) => (d.timestamp - minTimestamp) / (24 * 60 * 60)); // Convert to days
  const y = data.map((d) => d.apy);

  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R² (coefficient of determination)
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    ssRes += Math.pow(y[i] - predicted, 2);
    ssTot += Math.pow(y[i] - yMean, 2);
  }

  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
}

/**
 * Calculate volatility (standard deviation)
 */
function calculateVolatility(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Predict future yield based on historical data
 *
 * Uses multiple forecasting techniques:
 * 1. Linear regression for trend analysis
 * 2. Exponential moving average for short-term prediction
 * 3. Volatility analysis for confidence intervals
 * 4. Fee-adjusted predictions (optional) - net returns after management and performance fees
 *
 * @param historicalData - Historical APR and TVL data points
 * @param feeParams - Optional fee parameters for calculating net returns
 * @returns Yield prediction with confidence intervals and insights
 */
export function predictYield(
  historicalData: YieldDataPoint[],
  feeParams?: {
    managementFee: number;
    performanceFee: number;
    performanceFeeActive: boolean;
  }
): YieldPrediction {
  if (historicalData.length === 0) {
    return {
      currentAPY: 0,
      predictedAPY: 0,
      confidence: 0,
      trend: 'stable',
      projectedReturns: [],
      insights: ['Insufficient historical data for prediction'],
    };
  }

  // Sort by timestamp
  const sortedData = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
  const apyValues = sortedData.map((d) => d.apy);
  const currentAPY = apyValues[apyValues.length - 1];

  // Calculate trend using linear regression
  const regression = calculateLinearRegression(sortedData);
  const trend =
    Math.abs(regression.slope) < 0.01
      ? 'stable'
      : regression.slope > 0
        ? 'increasing'
        : 'decreasing';

  // Calculate EMA for short-term prediction
  const emaShort = calculateEMA(apyValues, Math.min(7, apyValues.length)); // 7-day EMA
  const emaLong = calculateEMA(apyValues, Math.min(30, apyValues.length)); // 30-day EMA

  // Weighted prediction: 40% regression, 40% short EMA, 20% long EMA
  const regressionPrediction = regression.slope * sortedData.length + regression.intercept;
  const predictedAPY = regressionPrediction * 0.4 + emaShort * 0.4 + emaLong * 0.2;

  // Calculate confidence based on R² and data quantity
  const dataQualityScore = Math.min(1, sortedData.length / 30); // More data = higher confidence
  const trendStrengthScore = regression.r2; // Strong trend = higher confidence
  const confidence = (dataQualityScore * 0.4 + trendStrengthScore * 0.6) * 0.9; // Max 90%

  // Calculate volatility for confidence intervals
  const volatility = calculateVolatility(apyValues);

  // Project returns for different timeframes
  const projectedReturns = [
    { timeframe: '7d' as const, days: 7 },
    { timeframe: '30d' as const, days: 30 },
    { timeframe: '90d' as const, days: 90 },
    { timeframe: '1y' as const, days: 365 },
  ].map(({ timeframe, days }) => {
    // Annualized to period conversion
    const expectedReturn = (predictedAPY / 100) * (days / 365) * 100;

    // Confidence intervals (±1 standard deviation scaled by time)
    const timeScaledVolatility = volatility * Math.sqrt(days / 365);
    const minReturn = expectedReturn - timeScaledVolatility;
    const maxReturn = expectedReturn + timeScaledVolatility;

    return {
      timeframe,
      expectedReturn: Math.max(0, expectedReturn),
      minReturn: Math.max(0, minReturn),
      maxReturn: Math.max(0, maxReturn),
    };
  });

  // Calculate fee-adjusted predictions if fee parameters provided
  let feeAdjustedAPY: number | undefined;
  let feeAdjustedReturns:
    | {
        timeframe: '7d' | '30d' | '90d' | '1y';
        expectedReturn: number;
        minReturn: number;
        maxReturn: number;
      }[]
    | undefined;
  let feeImpact:
    | {
        managementFee: number;
        performanceFee: number;
        totalAnnualFeeDrag: number;
        performanceFeeActive: boolean;
      }
    | undefined;

  if (feeParams) {
    // Calculate total annual fee drag
    const performanceFeeDrag = feeParams.performanceFeeActive
      ? feeParams.performanceFee * 0.1 // Assume 10% average profit for performance fee impact
      : 0;
    const totalAnnualFeeDrag = feeParams.managementFee + performanceFeeDrag;

    // Calculate fee-adjusted APR (gross APR - fees)
    feeAdjustedAPY = Math.max(0, predictedAPY - totalAnnualFeeDrag);

    // Calculate fee-adjusted projected returns
    feeAdjustedReturns = projectedReturns.map((p) => {
      const feeAdjustment =
        (((totalAnnualFeeDrag / 100) *
          (p.timeframe === '7d'
            ? 7
            : p.timeframe === '30d'
              ? 30
              : p.timeframe === '90d'
                ? 90
                : 365)) /
          365) *
        100;

      return {
        timeframe: p.timeframe,
        expectedReturn: Math.max(0, p.expectedReturn - feeAdjustment),
        minReturn: Math.max(0, p.minReturn - feeAdjustment),
        maxReturn: Math.max(0, p.maxReturn - feeAdjustment),
      };
    });

    feeImpact = {
      managementFee: feeParams.managementFee,
      performanceFee: feeParams.performanceFee,
      totalAnnualFeeDrag,
      performanceFeeActive: feeParams.performanceFeeActive,
    };
  }

  // Generate insights
  const insights = generateInsights({
    currentAPY,
    predictedAPY,
    trend,
    confidence,
    volatility,
    dataPoints: sortedData.length,
    regression,
    feeAdjustedAPY,
    feeImpact,
  });

  return {
    currentAPY,
    predictedAPY: Math.max(0, predictedAPY),
    feeAdjustedAPY,
    confidence,
    trend,
    projectedReturns,
    feeAdjustedReturns,
    feeImpact,
    insights,
  };
}

/**
 * Generate human-readable insights from prediction data
 */
function generateInsights(params: {
  currentAPY: number;
  predictedAPY: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  volatility: number;
  dataPoints: number;
  regression: { slope: number; r2: number };
  feeAdjustedAPY?: number;
  feeImpact?: {
    managementFee: number;
    performanceFee: number;
    totalAnnualFeeDrag: number;
    performanceFeeActive: boolean;
  };
}): string[] {
  const insights: string[] = [];

  // Data quality insight
  if (params.dataPoints < 7) {
    insights.push(
      `Limited data (${params.dataPoints} points) - predictions have higher uncertainty`
    );
  } else if (params.dataPoints >= 30) {
    insights.push(`Strong data foundation (${params.dataPoints} points) supports prediction`);
  }

  // Trend insight
  const apyChange = params.predictedAPY - params.currentAPY;
  const changePercent = ((apyChange / params.currentAPY) * 100).toFixed(1);

  if (params.trend === 'increasing') {
    insights.push(
      `Upward trend detected: APR expected to increase by ${changePercent}% (${apyChange.toFixed(2)}%)`
    );
  } else if (params.trend === 'decreasing') {
    insights.push(
      `Downward trend detected: APR expected to decrease by ${Math.abs(parseFloat(changePercent))}% (${Math.abs(apyChange).toFixed(2)}%)`
    );
  } else {
    insights.push('Stable performance: APR expected to remain relatively constant');
  }

  // Volatility insight
  if (params.volatility > 5) {
    insights.push('High volatility: Returns may vary significantly from predictions');
  } else if (params.volatility < 1) {
    insights.push('Low volatility: Consistent returns with narrow confidence intervals');
  }

  // Confidence insight
  if (params.confidence > 0.7) {
    insights.push(
      `High confidence (${(params.confidence * 100).toFixed(0)}%) in prediction accuracy`
    );
  } else if (params.confidence < 0.4) {
    insights.push(
      `Low confidence (${(params.confidence * 100).toFixed(0)}%) - consider as rough estimate only`
    );
  }

  // Trend strength insight
  if (params.regression.r2 > 0.7) {
    insights.push('Strong historical trend pattern detected');
  } else if (params.regression.r2 < 0.3) {
    insights.push('Weak trend pattern - returns may be influenced by external factors');
  }

  // Fee impact insights
  if (params.feeAdjustedAPY !== undefined && params.feeImpact) {
    const grossAPY = params.predictedAPY;
    const netAPY = params.feeAdjustedAPY;
    const feeDrag = params.feeImpact.totalAnnualFeeDrag;

    if (feeDrag > 3) {
      insights.push(
        `High fees (${feeDrag.toFixed(2)}%) significantly reduce net returns from ${grossAPY.toFixed(2)}% to ${netAPY.toFixed(2)}%`
      );
    } else if (feeDrag > 1.5) {
      insights.push(
        `Moderate fees (${feeDrag.toFixed(2)}%) impact net returns: ${grossAPY.toFixed(2)}% gross → ${netAPY.toFixed(2)}% net`
      );
    } else {
      insights.push(
        `Low fees (${feeDrag.toFixed(2)}%) - minimal impact on net returns (${netAPY.toFixed(2)}%)`
      );
    }

    if (params.feeImpact.performanceFeeActive) {
      insights.push(
        `Performance fee active (${params.feeImpact.performanceFee.toFixed(2)}%) - vault above high water mark`
      );
    }
  }

  return insights;
}

/**
 * Calculate compound APY from multiple yield sources
 *
 * @param yields - Array of APY values from different sources
 * @returns Compound APY
 */
export function calculateCompoundAPY(yields: number[]): number {
  if (yields.length === 0) {
    return 0;
  }

  // Convert APY to multipliers, compound them, convert back to APY
  const compoundMultiplier = yields.reduce((product, apy) => {
    return product * (1 + apy / 100);
  }, 1);

  return (compoundMultiplier - 1) * 100;
}
