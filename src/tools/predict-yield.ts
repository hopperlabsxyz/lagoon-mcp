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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { predictYieldInputSchema, PredictYieldInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments.js';
import { predictYield, YieldDataPoint, YieldPrediction } from '../utils/yield-prediction.js';
import { cache, cacheTTL } from '../cache/index.js';

/**
 * GraphQL query for vault yield prediction data
 */
const YIELD_PREDICTION_QUERY = `
  query YieldPrediction($vaultAddress: Address!, $chainId: Int!, $timestamp_gte: BigInt!) {
    vault(address: $vaultAddress, chainId: $chainId) {
      ...VaultFragment
    }

    # Get historical performance data
    performanceHistory: transactions(
      where: {
        vault_eq: $vaultAddress,
        timestamp_gte: $timestamp_gte,
        type: "PeriodSummary"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        timestamp
        data {
          ... on PeriodSummary {
            apy
            totalAssetsUsd
          }
        }
      }
    }

    # Get recent total assets updates for TVL tracking
    tvlHistory: transactions(
      where: {
        vault_eq: $vaultAddress,
        timestamp_gte: $timestamp_gte,
        type: "TotalAssetsUpdated"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 100
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
          }
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * Time range constants (in seconds)
 */
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
} as const;

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

  return `
## Yield Prediction: ${vaultName}

### Current Performance
- **Current APY**: ${prediction.currentAPY.toFixed(2)}%
- **Predicted APY**: ${prediction.predictedAPY.toFixed(2)}%
- **Trend**: ${trendEmoji} ${prediction.trend.charAt(0).toUpperCase() + prediction.trend.slice(1)}
- **Confidence**: ${confidenceEmoji} ${(prediction.confidence * 100).toFixed(0)}%

---

### Projected Returns

Based on ${timeRange} historical data:

| Timeframe | Expected Return | Range (Min-Max) |
|-----------|----------------|-----------------|
${prediction.projectedReturns
  .map((p) => {
    return `| **${p.timeframe}** | ${p.expectedReturn.toFixed(2)}% | ${p.minReturn.toFixed(2)}% - ${p.maxReturn.toFixed(2)}% |`;
  })
  .join('\n')}

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
}

/**
 * Predict vault yield with ML-based forecasting
 *
 * @param input - Yield prediction configuration (vault address, chain ID, time range)
 * @returns Yield prediction with confidence intervals and insights
 */
export async function executePredictYield(input: PredictYieldInput): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = predictYieldInputSchema.parse(input);

    // Check cache
    const cacheKey = `yield_prediction:${validatedInput.chainId}:${validatedInput.vaultAddress}:${validatedInput.timeRange}`;
    const cached = cache.get<{ prediction: YieldPrediction; vaultName: string }>(cacheKey);

    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: `${formatYieldPrediction(cached.prediction, cached.vaultName, validatedInput.timeRange)}\n\n_Cached result from ${new Date().toISOString()}_`,
          },
        ],
        isError: false,
      };
    }

    // Calculate timestamp threshold for time range
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[validatedInput.timeRange];
    const timestampThreshold = nowTimestamp - timeRangeSeconds;

    // Fetch vault data
    const data = await graphqlClient.request<{
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
    }>(YIELD_PREDICTION_QUERY, {
      vaultAddress: validatedInput.vaultAddress,
      chainId: validatedInput.chainId,
      timestamp_gte: String(timestampThreshold),
    });

    if (!data.vault) {
      return {
        content: [
          {
            type: 'text',
            text: `No vault found at address ${validatedInput.vaultAddress} on chain ${validatedInput.chainId}`,
          },
        ],
        isError: false,
      };
    }

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

    // If no PeriodSummary data available, prediction will have low confidence
    // Historical APY data is required for meaningful predictions

    // Perform yield prediction
    const prediction = predictYield(historicalData);

    // Cache the result
    const cacheValue = {
      prediction,
      vaultName: data.vault.name || 'Unknown Vault',
    };
    cache.set(cacheKey, cacheValue, cacheTTL.yieldPrediction);

    // Return formatted prediction
    return {
      content: [
        {
          type: 'text',
          text: formatYieldPrediction(prediction, cacheValue.vaultName, validatedInput.timeRange),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return handleToolError(error, 'predict_yield');
  }
}
