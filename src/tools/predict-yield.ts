/**
 * predict_yield Tool
 *
 * ML-based yield forecasting for vault APY prediction.
 * Analyzes historical performance to predict future returns.
 *
 * Use cases:
 * - Investment planning and return projections
 * - Yield farming strategy optimization
 * - Risk-adjusted return forecasting
 * - Performance trend analysis
 * - Performance: ~400-600 tokens per prediction
 *
 * Cache strategy:
 * - 60-minute TTL (predictions valid for moderate duration)
 * - Cache key: yield_prediction:{chainId}:{vaultAddress}:{timeRange}
 * - Cache hit rate target: 75-85%
 * - Cache tags: [CacheTag.VAULT, CacheTag.APR, CacheTag.ANALYTICS] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { PredictYieldInput } from '../utils/validators.js';
import { VaultData } from '../graphql/fragments/index.js';
import { YIELD_PREDICTION_QUERY } from '../graphql/queries/index.js';
import { predictYield, YieldDataPoint, YieldPrediction } from '../utils/yield-prediction.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';

/**
 * Time range constants (in seconds)
 */
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
} as const;

/**
 * GraphQL response type
 */
interface YieldPredictionResponse {
  vault: VaultData;
  performanceHistory: {
    items: Array<{
      timestamp: string;
      data: { apy: number; totalAssetsUsd: number };
    }>;
  };
  tvlHistory: {
    items: Array<{
      timestamp: string;
      data: { totalAssetsUsd: number };
    }>;
  };
}

/**
 * GraphQL variables type for YIELD_PREDICTION_QUERY
 */
interface YieldPredictionVariables {
  vaultAddress: string;
  chainId: number;
  timestamp_gte: string;
}

/**
 * Prediction output with markdown
 */
interface YieldPredictionOutput {
  markdown: string;
}

/**
 * Format yield prediction as markdown
 */
function formatYieldPrediction(
  prediction: YieldPrediction,
  vaultName: string,
  timeRange: string
): string {
  const trendEmoji = {
    increasing: '📈',
    decreasing: '📉',
    stable: '➡️',
  }[prediction.trend];

  const confidenceEmoji =
    prediction.confidence > 0.7 ? '🟢' : prediction.confidence > 0.4 ? '🟡' : '🔴';

  const hasFeeData = prediction.feeAdjustedAPY !== undefined && prediction.feeImpact;

  let output = `
## Yield Prediction: ${vaultName}

### Current Performance
- **Current APY**: ${prediction.currentAPY.toFixed(2)}%
- **Predicted APY**: ${prediction.predictedAPY.toFixed(2)}%${hasFeeData ? ` (Gross)` : ''}
${hasFeeData ? `- **Predicted Net APY**: ${prediction.feeAdjustedAPY!.toFixed(2)}% (After Fees)` : ''}
- **Trend**: ${trendEmoji} ${prediction.trend.charAt(0).toUpperCase() + prediction.trend.slice(1)}
- **Confidence**: ${confidenceEmoji} ${(prediction.confidence * 100).toFixed(0)}%

---
`;

  if (hasFeeData) {
    output += `
### Fee Impact

- **Management Fee**: ${prediction.feeImpact!.managementFee.toFixed(2)}% annually
- **Performance Fee**: ${prediction.feeImpact!.performanceFee.toFixed(2)}%${prediction.feeImpact!.performanceFeeActive ? ' (Currently Active - Above High Water Mark)' : ' (Inactive - Below High Water Mark)'}
- **Total Annual Fee Drag**: ${prediction.feeImpact!.totalAnnualFeeDrag.toFixed(2)}%
- **Net Impact**: Reduces predicted returns from ${prediction.predictedAPY.toFixed(2)}% to ${prediction.feeAdjustedAPY!.toFixed(2)}%

---
`;
  }

  output += `
### Projected Returns

Based on ${timeRange} historical data:

`;

  if (hasFeeData) {
    output += `#### Gross Returns (Before Fees)

| Timeframe | Expected Return | Range (Min-Max) |
|-----------|----------------|-----------------|
${prediction.projectedReturns
  .map(
    (p) =>
      `| **${p.timeframe}** | ${p.expectedReturn.toFixed(2)}% | ${p.minReturn.toFixed(2)}% - ${p.maxReturn.toFixed(2)}% |`
  )
  .join('\n')}

#### Net Returns (After Fees)

| Timeframe | Expected Return | Range (Min-Max) |
|-----------|----------------|-----------------|
${prediction
  .feeAdjustedReturns!.map(
    (p) =>
      `| **${p.timeframe}** | ${p.expectedReturn.toFixed(2)}% | ${p.minReturn.toFixed(2)}% - ${p.maxReturn.toFixed(2)}% |`
  )
  .join('\n')}
`;
  } else {
    output += `| Timeframe | Expected Return | Range (Min-Max) |
|-----------|----------------|-----------------|
${prediction.projectedReturns
  .map(
    (p) =>
      `| **${p.timeframe}** | ${p.expectedReturn.toFixed(2)}% | ${p.minReturn.toFixed(2)}% - ${p.maxReturn.toFixed(2)}% |`
  )
  .join('\n')}
`;
  }

  output += `
---

### Key Insights

${prediction.insights.map((insight) => `- ${insight}`).join('\n')}

---

### Methodology

This prediction uses:
- **Linear Regression**: Long-term trend analysis
- **Exponential Moving Averages**: Short-term momentum
- **Volatility Analysis**: Confidence interval calculation
- **Historical Data**: ${timeRange} performance window

**Note**: Predictions are estimates based on historical performance. Actual returns may vary due to market conditions, protocol changes, and external factors.
`;

  return output;
}

/**
 * Transform raw GraphQL response into yield prediction markdown output
 * Uses closure to capture input values
 */
function createTransformYieldPredictionData(input: PredictYieldInput) {
  return (data: YieldPredictionResponse): YieldPredictionOutput => {
    // Prepare historical data points
    const historicalData: YieldDataPoint[] = [];

    // Add performance history data points
    if (data.performanceHistory && data.performanceHistory.items.length > 0) {
      for (const item of data.performanceHistory.items) {
        historicalData.push({
          timestamp: parseInt(item.timestamp, 10),
          apy: item.data.apy,
          tvl: item.data.totalAssetsUsd,
        });
      }
    }

    // Extract fee data for fee-adjusted predictions
    const managementFee = data.vault.state?.managementFee || 0;
    const performanceFee = data.vault.state?.performanceFee || 0;
    const pricePerShare = BigInt(data.vault.state?.pricePerShare || '0');
    const highWaterMark = BigInt(data.vault.state?.highWaterMark || '0');
    const performanceFeeActive = pricePerShare > highWaterMark;

    // Only pass fee parameters if vault has meaningful fees
    const hasFees = managementFee > 0 || performanceFee > 0;

    // Perform yield prediction with optional fee parameters
    const prediction = predictYield(
      historicalData,
      hasFees
        ? {
            managementFee,
            performanceFee,
            performanceFeeActive,
          }
        : undefined
    );

    // Format prediction as markdown
    const markdown = formatYieldPrediction(
      prediction,
      data.vault.name || 'Unknown Vault',
      input.timeRange
    );

    return { markdown };
  };
}

/**
 * Create the executePredictYield function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecutePredictYield(
  container: ServiceContainer
): (input: PredictYieldInput) => Promise<CallToolResult> {
  return async (input: PredictYieldInput): Promise<CallToolResult> => {
    // Calculate timestamp threshold for time range
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[input.timeRange];
    const timestampThreshold = nowTimestamp - timeRangeSeconds;

    const executor = executeToolWithCache<
      PredictYieldInput,
      YieldPredictionResponse,
      YieldPredictionVariables,
      YieldPredictionOutput
    >({
      container,
      cacheKey: (input) =>
        `yield_prediction:${input.chainId}:${input.vaultAddress}:${input.timeRange}`,
      cacheTTL: cacheTTL.yieldPrediction,
      query: YIELD_PREDICTION_QUERY,
      variables: () => ({
        vaultAddress: input.vaultAddress,
        chainId: input.chainId,
        timestamp_gte: String(timestampThreshold),
      }),
      validateResult: (data) => ({
        valid: !!data.vault,
        message: data.vault
          ? undefined
          : `No vault found at address ${input.vaultAddress} on chain ${input.chainId}`,
      }),
      transformResult: createTransformYieldPredictionData(input),
      toolName: 'predict_yield',
    });

    // Register cache tags for invalidation
    const cacheKey = `yield_prediction:${input.chainId}:${input.vaultAddress}:${input.timeRange}`;
    container.cacheInvalidator.register(cacheKey, [
      CacheTag.VAULT,
      CacheTag.APR,
      CacheTag.ANALYTICS,
    ]);

    // Execute and get result
    const result = await executor(input);

    // Transform JSON output to markdown text format
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as YieldPredictionOutput;
        result.content[0].text = output.markdown;
      } catch (error) {
        console.error('Failed to parse yield prediction output:', error);
      }
    }

    return result;
  };
}
