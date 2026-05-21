/**
 * predict_yield Tool
 *
 * ML-based yield forecasting for vault APR prediction.
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
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { VaultData } from '../graphql/fragments/index.js';
import * as PredictionQueries from '../graphql/queries/prediction.queries.js';
import type { PredictionResponseFormat } from '../graphql/queries/prediction.queries.js';
import { predictYield, YieldDataPoint, YieldPrediction } from '../utils/yield-prediction.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';
import {
  transformPeriodSummariesToAPRData,
  calculateAPRFromPriceChange,
  type PeriodSummary,
} from '../sdk/apr-service.js';

/**
 * Time range constants (in seconds)
 */
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
} as const;

// Outlier-robustness guards on the per-period APR series. See
// .claude/plans/predict-yield-outlier-robustness.md for design rationale.
//
// MIN_PERIOD_DAYS: drop period-over-period APR samples whose elapsed time is
// shorter than this. annualizedAPR = priceChange × 365 / daysElapsed, so a
// 14-minute period turns a 0.01% PPS tick into a 365% APR observation — one
// such outlier shifts the regression slope used at predict-yield.ts to forecast
// the next day. 6h is the smallest threshold that bounds a 0.01% PPS bump to
// ~14.6% annualized (a believable real-world rate).
const MIN_PERIOD_DAYS = 0.25;

// APR_CLAMP_*: even after the 6h filter, a flash-loan / oracle blip can produce
// extreme values across a 1d+ window. Bound them so a single outlier can't
// dominate the regression. -100% floor (a vault cannot lose >100% in a year),
// 500% ceiling (anything sustainably above is exotic enough that prediction
// confidence intervals are meaningless anyway).
const APR_CLAMP_MIN = -100;
const APR_CLAMP_MAX = 500;

/**
 * GraphQL response type
 */
interface YieldPredictionResponse {
  vault: VaultData;
  performanceHistory: {
    items: Array<{
      timestamp: string;
      data: {
        totalAssetsAtStart: string;
        totalSupplyAtStart: string;
        totalAssetsAtEnd: string;
      };
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
}

/**
 * Yield-source breakdown surfaced alongside the prediction so the LLM can flag
 * incentive-heavy yields. Derived purely from already-fetched APR fields —
 * the regression itself runs on price-per-share history (correct foundation;
 * PPS already nets every yield source).
 *
 * `incentiveContributionPct = (total - sustainable) / total * 100`, clamped
 * to ≥ 0. A warning is emitted when this exceeds INCENTIVE_WARNING_THRESHOLD_PCT.
 */
interface YieldBreakdown {
  currentTotalApr: number;
  currentSustainableApr: number | null;
  incentiveContributionPct: number;
  sourceCounts: {
    airdrops: number;
    nativeYields: number;
    incentives: number;
  };
  warning: string | null;
}

/**
 * Hardcoded by design: opinionated risk-flag, not a tool input. Above 25%,
 * the headline prediction depends meaningfully on temporary subsidies.
 */
const INCENTIVE_WARNING_THRESHOLD_PCT = 25;

/**
 * Build the yield breakdown from a vault's weeklyApr (preferred, more recent)
 * with monthlyApr as fallback. Returns null source counts but a clean shape
 * when no APR data is available.
 */
function buildYieldBreakdown(vault: VaultData): YieldBreakdown {
  const aprSource = vault.state?.weeklyApr ?? vault.state?.monthlyApr;
  const totalApr = aprSource?.linearNetApr ?? 0;
  const sustainable = aprSource?.linearNetAprWithoutExtraYields;
  const sustainableApr = typeof sustainable === 'number' ? sustainable : null;
  const incentiveAbsolute = sustainableApr === null ? 0 : Math.max(0, totalApr - sustainableApr);
  const incentiveContributionPct =
    totalApr > 0 ? Math.round((incentiveAbsolute / totalApr) * 1000) / 10 : 0;

  const sourceCounts = {
    airdrops: aprSource?.airdrops?.length ?? 0,
    nativeYields: aprSource?.nativeYields?.length ?? 0,
    incentives: aprSource?.incentives?.length ?? 0,
  };

  const warning =
    incentiveContributionPct > INCENTIVE_WARNING_THRESHOLD_PCT
      ? `${incentiveContributionPct.toFixed(1)}% of headline APR comes from temporary incentives (airdrops/rewards) — the predicted APR may decline materially if they expire.`
      : null;

  return {
    currentTotalApr: totalApr,
    currentSustainableApr: sustainableApr,
    incentiveContributionPct,
    sourceCounts,
    warning,
  };
}

/**
 * Prediction output with markdown and a structured yield-breakdown block.
 */
interface YieldPredictionOutput {
  markdown: string;
  yieldBreakdown: YieldBreakdown;
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

  const hasFeeData = prediction.feeAdjustedAPR !== undefined && prediction.feeImpact;

  let output = `
## Yield Prediction: ${vaultName}

### Current Performance
- **Current APR**: ${Number(prediction.currentAPR).toFixed(2)}%
- **Predicted APR**: ${Number(prediction.predictedAPR).toFixed(2)}%${hasFeeData ? ` (Gross)` : ''}
${hasFeeData ? `- **Predicted Net APR**: ${Number(prediction.feeAdjustedAPR).toFixed(2)}% (After Fees)` : ''}
- **Trend**: ${trendEmoji} ${prediction.trend.charAt(0).toUpperCase() + prediction.trend.slice(1)}
- **Confidence**: ${confidenceEmoji} ${(prediction.confidence * 100).toFixed(0)}%

---
`;

  if (hasFeeData) {
    output += `
### Fee Impact

- **Management Fee**: ${Number(prediction.feeImpact?.managementFee).toFixed(2)}% annually
- **Performance Fee**: ${Number(prediction.feeImpact?.performanceFee).toFixed(2)}%${prediction.feeImpact?.performanceFeeActive ? ' (Currently Active - Above High Water Mark)' : ' (Inactive - Below High Water Mark)'}
- **Total Annual Fee Drag**: ${Number(prediction.feeImpact?.totalAnnualFeeDrag).toFixed(2)}%
- **Net Impact**: Reduces predicted returns from ${Number(prediction.predictedAPR).toFixed(2)}% to ${Number(prediction.feeAdjustedAPR).toFixed(2)}%

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
function createTransformYieldPredictionData(input: PredictYieldInput, timestampThreshold: number) {
  return (data: YieldPredictionResponse): YieldPredictionOutput => {
    // Prepare historical data points
    const historicalData: YieldDataPoint[] = [];

    // Outlier-robustness counters (surfaced as insights in the output).
    let droppedShortPeriods = 0;
    let clampedPeriods = 0;

    // Build period-over-period APR series for yield prediction
    if (data.performanceHistory && data.performanceHistory.items.length > 0) {
      // Calculate period-over-period APR for each data point
      // Using independent period returns (not cumulative from inception)
      // to satisfy the independence assumption for regression/EMA forecasting
      const filteredItems = data.performanceHistory.items
        .filter((item) => parseInt(item.timestamp, 10) >= timestampThreshold)
        .sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10));

      // Period-over-period APR (independent observations for regression/EMA forecasting)
      // Start at i=1 since we need a previous period for comparison
      for (let i = 1; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const prevItem = filteredItems[i - 1];
        const timestamp = parseInt(item.timestamp, 10);
        const prevTimestamp = parseInt(prevItem.timestamp, 10);

        const daysElapsed = (timestamp - prevTimestamp) / (24 * 60 * 60);
        if (daysElapsed < MIN_PERIOD_DAYS) {
          droppedShortPeriods++;
          continue;
        }

        const currentPeriod: PeriodSummary = {
          timestamp: item.timestamp,
          totalAssetsAtStart: item.data.totalAssetsAtStart,
          totalSupplyAtStart: item.data.totalSupplyAtStart,
        };
        const prevPeriod: PeriodSummary = {
          timestamp: prevItem.timestamp,
          totalAssetsAtStart: prevItem.data.totalAssetsAtStart,
          totalSupplyAtStart: prevItem.data.totalSupplyAtStart,
        };

        const currentAPRData = transformPeriodSummariesToAPRData([currentPeriod], data.vault);
        const prevAPRData = transformPeriodSummariesToAPRData([prevPeriod], data.vault);

        if (prevAPRData.inception && currentAPRData.inception) {
          const rawApr = calculateAPRFromPriceChange(
            prevAPRData.inception.pricePerShare,
            currentAPRData.inception.pricePerShare,
            daysElapsed
          );
          const apr = Math.max(APR_CLAMP_MIN, Math.min(APR_CLAMP_MAX, rawApr));
          if (apr !== rawApr) clampedPeriods++;
          historicalData.push({ timestamp, apr, tvl: Number(item.data.totalAssetsAtEnd) });
        }
      }
    }

    // Extract fee data for fee-adjusted predictions.
    // GraphQL returns fees as uint16 basis points (10000 = 100%); convert to
    // percent for the predictor and the markdown formatter.
    const managementFee = (data.vault.state?.managementFee ?? 0) / 100;
    const performanceFee = (data.vault.state?.performanceFee ?? 0) / 100;
    const pricePerShare = BigInt(data.vault.state?.pricePerShare || '0');
    const highWaterMark = BigInt(data.vault.state?.highWaterMark || '0');
    const performanceFeeActive = pricePerShare > highWaterMark;

    // Calculate actual profit margin from historical period summaries
    // This is used for accurate performance fee impact calculation
    let actualProfitMargin: number | undefined;

    if (data.performanceHistory && data.performanceHistory.items.length >= 2) {
      // Calculate period-over-period price changes
      const sortedItems = [...data.performanceHistory.items].sort(
        (a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10)
      );

      const priceChanges: number[] = [];
      for (let i = 1; i < sortedItems.length; i++) {
        const prevAssets = parseFloat(sortedItems[i - 1].data.totalAssetsAtStart);
        const prevSupply = parseFloat(sortedItems[i - 1].data.totalSupplyAtStart);
        const currAssets = parseFloat(sortedItems[i].data.totalAssetsAtStart);
        const currSupply = parseFloat(sortedItems[i].data.totalSupplyAtStart);

        // Calculate price per share for each period
        const prevPPS = prevSupply > 0 ? prevAssets / prevSupply : 0;
        const currPPS = currSupply > 0 ? currAssets / currSupply : 0;

        // Calculate percentage change
        if (prevPPS > 0) {
          const change = (currPPS - prevPPS) / prevPPS;
          priceChanges.push(change);
        }
      }

      // Actual profit margin is the average of positive returns (profits only)
      // This reflects the historical rate at which performance fees are triggered
      const positiveChanges = priceChanges.filter((c) => c > 0);
      if (positiveChanges.length > 0) {
        actualProfitMargin =
          positiveChanges.reduce((sum, c) => sum + c, 0) / positiveChanges.length;
      }
      // If no positive changes, actualProfitMargin remains undefined
      // which means fee-adjusted predictions will be omitted (no data to calculate)
    }

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
            actualProfitMargin,
          }
        : undefined,
      { droppedShortPeriods, clampedPeriods }
    );

    // Format prediction as markdown
    let markdown = formatYieldPrediction(
      prediction,
      data.vault.name || 'Unknown Vault',
      input.timeRange
    );

    // Build the yield-source breakdown and append to markdown for the LLM.
    // The structured field is also returned so UIs can render it without parsing.
    const yieldBreakdown = buildYieldBreakdown(data.vault);
    markdown += formatYieldBreakdownSection(yieldBreakdown);

    return { markdown, yieldBreakdown };
  };
}

/**
 * Markdown section for the yield breakdown, appended after the existing
 * prediction output. Always emitted (even when no incentives) so the LLM
 * can see the "100% sustainable" signal too.
 */
function formatYieldBreakdownSection(b: YieldBreakdown): string {
  const sustainableLine =
    b.currentSustainableApr === null
      ? 'unavailable for this vault'
      : `${b.currentSustainableApr.toFixed(2)}%`;
  const sources: string[] = [];
  if (b.sourceCounts.nativeYields > 0)
    sources.push(
      `${b.sourceCounts.nativeYields} native yield${b.sourceCounts.nativeYields > 1 ? 's' : ''}`
    );
  if (b.sourceCounts.airdrops > 0)
    sources.push(`${b.sourceCounts.airdrops} airdrop${b.sourceCounts.airdrops > 1 ? 's' : ''}`);
  if (b.sourceCounts.incentives > 0)
    sources.push(
      `${b.sourceCounts.incentives} incentive${b.sourceCounts.incentives > 1 ? 's' : ''}`
    );
  const sourcesLine = sources.length > 0 ? sources.join(', ') : 'none reported';

  let md = `
---

### Yield Breakdown

- **Total net APR**: ${b.currentTotalApr.toFixed(2)}%
- **Sustainable APR** (ex-airdrops/incentives): ${sustainableLine}
- **Incentive contribution**: ${b.incentiveContributionPct.toFixed(1)}% of total APR
- **Yield sources**: ${sourcesLine}
`;
  if (b.warning) {
    md += `\n> ⚠️ ${b.warning}\n`;
  }
  return md;
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

    // Determine response format (default to 'quick')
    const responseFormat: PredictionResponseFormat =
      input.responseFormat === 'detailed' ? 'detailed' : 'quick';

    // Create dynamic query based on responseFormat
    const query: string = PredictionQueries.createYieldPredictionQuery(responseFormat);

    const executor = executeToolWithCache<
      PredictYieldInput,
      YieldPredictionResponse,
      YieldPredictionVariables,
      YieldPredictionOutput
    >({
      container,
      cacheKey: (input) =>
        `yield_prediction:${input.chainId}:${input.vaultAddress}:${input.timeRange}:${input.responseFormat || 'quick'}`,
      cacheTTL: cacheTTL.yieldPrediction,
      query,
      variables: (): YieldPredictionVariables => ({
        vaultAddress: input.vaultAddress,
        chainId: input.chainId,
      }),
      validateResult: (data) => {
        const hasData = !!data.vault;
        return {
          valid: hasData,
          message: hasData
            ? undefined
            : `No vault found at address ${input.vaultAddress} on chain ${input.chainId}`,
          isError: !hasData,
        };
      },
      transformResult: createTransformYieldPredictionData(input, timestampThreshold),
      toolName: 'predict_yield',
    });

    // Register cache tags for invalidation
    const cacheKey = `yield_prediction:${input.chainId}:${input.vaultAddress}:${input.timeRange}:${input.responseFormat || 'quick'}`;
    container.cacheInvalidator.register(cacheKey, [
      CacheTag.VAULT,
      CacheTag.APR,
      CacheTag.ANALYTICS,
    ]);

    // Execute and get result
    const result = await executor(input);

    // Transform JSON output to markdown text format with legal disclaimer
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as YieldPredictionOutput;
        result.content[0].text = output.markdown + getToolDisclaimer('predict_yield');
      } catch (error) {
        console.error('Failed to parse yield prediction output:', error);
      }
    }

    return result;
  };
}
