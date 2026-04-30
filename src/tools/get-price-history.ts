/**
 * get_price_history Tool
 *
 * Historical price data with OHLCV (Open, High, Low, Close, Volume) time-series analysis.
 * Provides price trends and volatility metrics for vault share price over time.
 *
 * Use cases:
 * - Price trend analysis and pattern recognition
 * - Volatility assessment and risk evaluation
 * - Historical price point identification for entry/exit decisions
 * - Performance: ~300-500 tokens per vault per time range
 *
 * Cache strategy:
 * - 30-minute TTL for price history data
 * - Cache key: price_history:{address}:{chainId}:{timeRange}
 * - Cache hit rate target: 75-85%
 * - Cache tags: [CacheTag.VAULT, CacheTag.ANALYTICS] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { PriceHistoryInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { PRICE_HISTORY_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';

/**
 * Time range constants (in seconds)
 */
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
  all: 0, // No time limit
} as const;

// Query now imported from ../graphql/queries/index.js

/**
 * Single point on a price/TVL time series. Backend returns `y: number | null`
 * when the underlying column was unset; we filter nulls before aggregation.
 */
interface PriceDataPoint {
  x: number;
  y: number | null;
}

/**
 * GraphQL response type — `Vault.stateHistory.pricePerShareUsd` plus
 * `totalAssetsUsd` for the volume column. Backend may return null for `vault`
 * when the address/chainId combination is unknown.
 */
interface PriceHistoryResponse {
  vault: {
    address: string;
    stateHistory: {
      pricePerShareUsd: PriceDataPoint[];
      totalAssetsUsd: PriceDataPoint[];
    };
  } | null;
}

/**
 * OHLCV data point for time-series analysis
 */
interface OHLCVDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Price statistics summary
 */
interface PriceStatistics {
  currentPrice: number;
  startPrice: number;
  highPrice: number;
  lowPrice: number;
  averagePrice: number;
  percentChange: number;
  volatility: number; // Standard deviation
  totalVolume: number;
  dataPoints: number;
}

/**
 * Aggregate price-per-share and TVL time series into daily OHLCV buckets.
 * Volume is the average TVL for the day, joined to PPS points by timestamp.
 */
function aggregateOHLCV(
  pricePoints: PriceDataPoint[],
  tvlPoints: PriceDataPoint[]
): OHLCVDataPoint[] {
  if (pricePoints.length === 0) return [];

  const dayKey = (timestamp: number): number => Math.floor(timestamp / 86400) * 86400;

  type Bucket = { prices: number[]; tvls: number[] };
  const buckets = new Map<number, Bucket>();

  for (const point of pricePoints) {
    if (point.y === null || point.y <= 0) continue;
    const day = dayKey(point.x);
    let bucket = buckets.get(day);
    if (!bucket) {
      bucket = { prices: [], tvls: [] };
      buckets.set(day, bucket);
    }
    bucket.prices.push(point.y);
  }

  // Drop per-day numerical artifacts: backend occasionally emits values many
  // orders of magnitude smaller than the day's real PPS (e.g. 2.7e-9 alongside
  // values around 2500). Filtering against 0.01 % of the day's max removes
  // those without affecting any legitimate intraday spread.
  for (const bucket of buckets.values()) {
    if (bucket.prices.length < 2) continue;
    const max = Math.max(...bucket.prices);
    const floor = max * 1e-4;
    bucket.prices = bucket.prices.filter((p) => p >= floor);
  }

  for (const point of tvlPoints) {
    if (point.y === null) continue;
    const day = dayKey(point.x);
    const bucket = buckets.get(day);
    // Only attach TVL when there's also a PPS point on the same day; this keeps
    // OHLCV rows aligned to the price series.
    if (bucket) bucket.tvls.push(point.y);
  }

  const ohlcv: OHLCVDataPoint[] = [];
  for (const [day, { prices, tvls }] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = tvls.length > 0 ? tvls.reduce((sum, v) => sum + v, 0) / tvls.length : 0;
    ohlcv.push({ timestamp: day, open, high, low, close, volume });
  }

  return ohlcv;
}

/**
 * Calculate price statistics from OHLCV data
 */
function calculateStatistics(ohlcvData: OHLCVDataPoint[]): PriceStatistics {
  if (ohlcvData.length === 0) {
    return {
      currentPrice: 0,
      startPrice: 0,
      highPrice: 0,
      lowPrice: 0,
      averagePrice: 0,
      percentChange: 0,
      volatility: 0,
      totalVolume: 0,
      dataPoints: 0,
    };
  }

  const prices = ohlcvData.map((d) => d.close);
  const currentPrice = prices[prices.length - 1];
  const startPrice = prices[0];
  const highPrice = Math.max(...ohlcvData.map((d) => d.high));
  const lowPrice = Math.min(...ohlcvData.map((d) => d.low));
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const percentChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

  // Calculate volatility (standard deviation)
  const squaredDiffs = prices.map((p) => Math.pow(p - averagePrice, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
  const volatility = Math.sqrt(variance);

  const totalVolume = ohlcvData.reduce((sum, d) => sum + d.volume, 0);

  return {
    currentPrice,
    startPrice,
    highPrice,
    lowPrice,
    averagePrice,
    percentChange,
    volatility,
    totalVolume,
    dataPoints: ohlcvData.length,
  };
}

/**
 * GraphQL variables type for PRICE_HISTORY_QUERY (Vault.stateHistory based).
 * `options` is null when the time range is "all"; backend then defaults to
 * the full history since vault creation.
 */
interface PriceHistoryVariables {
  vaultAddress: string;
  chainId: number;
  options: { startTimestamp: number } | null;
}

/**
 * Markdown-formatted price history output
 */
interface PriceHistoryOutput {
  markdown: string;
}

/**
 * Transform raw GraphQL response into markdown-formatted output
 * Uses closure to capture input values and timestamp filter
 */
function createTransformPriceHistoryData(input: PriceHistoryInput) {
  return (data: PriceHistoryResponse): PriceHistoryOutput => {
    const stateHistory = data.vault?.stateHistory;
    const ohlcvData = stateHistory
      ? aggregateOHLCV(stateHistory.pricePerShareUsd, stateHistory.totalAssetsUsd)
      : [];

    // Calculate statistics
    const statistics = calculateStatistics(ohlcvData);

    // Format output as markdown based on responseFormat
    const responseFormat = (input.responseFormat ?? 'summary') as 'summary' | 'detailed';

    let markdown =
      `# Price History: ${input.vaultAddress}\n\n` +
      `**Chain ID**: ${input.chainId}\n` +
      `**Time Range**: ${input.timeRange}\n` +
      `**Data Points**: ${statistics.dataPoints}\n\n` +
      `## Price Statistics\n\n` +
      `- **Current Price**: $${statistics.currentPrice.toFixed(6)}\n` +
      `- **Start Price**: $${statistics.startPrice.toFixed(6)}\n` +
      `- **High Price**: $${statistics.highPrice.toFixed(6)}\n` +
      `- **Low Price**: $${statistics.lowPrice.toFixed(6)}\n` +
      `- **Average Price**: $${statistics.averagePrice.toFixed(6)}\n` +
      `- **Change**: ${statistics.percentChange > 0 ? '+' : ''}${statistics.percentChange.toFixed(2)}%\n` +
      `- **Volatility (σ)**: $${statistics.volatility.toFixed(6)}\n` +
      `- **Total Volume**: $${(statistics.totalVolume / 1000000).toFixed(2)}M\n\n`;

    // Include OHLCV table for 'summary' and 'detailed' formats
    if (responseFormat === 'summary' || responseFormat === 'detailed') {
      markdown +=
        `## OHLCV Data (Daily)\n\n` +
        `| Date | Open | High | Low | Close | Volume |\n` +
        `|------|------|------|-----|-------|--------|\n` +
        ohlcvData
          .map((d) => {
            const date = new Date(d.timestamp * 1000).toISOString().split('T')[0];
            return `| ${date} | $${d.open.toFixed(6)} | $${d.high.toFixed(6)} | $${d.low.toFixed(6)} | $${d.close.toFixed(6)} | $${(d.volume / 1000000).toFixed(2)}M |`;
          })
          .join('\n') +
        `\n\n`;
    }

    return { markdown };
  };
}

/**
 * Create the executeGetPriceHistory function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteGetPriceHistory(
  container: ServiceContainer
): (input: PriceHistoryInput) => Promise<CallToolResult> {
  return async (input: PriceHistoryInput): Promise<CallToolResult> => {
    // Calculate timestamp threshold (0 for 'all')
    const now = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[input.timeRange];
    const startTimestamp = timeRangeSeconds > 0 ? now - timeRangeSeconds : 0;

    // Build query variables. `options: null` means "full history since vault creation".
    const variables: PriceHistoryVariables = {
      vaultAddress: input.vaultAddress,
      chainId: input.chainId,
      options: startTimestamp > 0 ? { startTimestamp } : null,
    };

    const executor = executeToolWithCache<
      PriceHistoryInput,
      PriceHistoryResponse,
      PriceHistoryVariables,
      PriceHistoryOutput
    >({
      container,
      cacheKey: (input) =>
        `${cacheKeys.priceHistory(input.vaultAddress, input.chainId, input.timeRange)}:${input.responseFormat || 'summary'}`,
      cacheTTL: cacheTTL.priceHistory,
      query: PRICE_HISTORY_QUERY,
      variables: () => variables,
      validateResult: (data) => {
        // Backend may return points with `y: null` when the underlying column is
        // unset. Treat the response as empty unless at least one PPS point has
        // a usable value, otherwise statistics collapse to $0.000000.
        const hasData = !!(
          data.vault &&
          data.vault.stateHistory.pricePerShareUsd.some((p) => p.y !== null && p.y > 0)
        );
        return {
          valid: hasData,
          message: hasData
            ? undefined
            : `No price history data found for vault ${input.vaultAddress} on chain ${input.chainId} in the ${input.timeRange} time range.`,
          isError: !hasData,
        };
      },
      transformResult: createTransformPriceHistoryData(input),
      toolName: 'get_price_history',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.priceHistory(input.vaultAddress, input.chainId, input.timeRange);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT, CacheTag.ANALYTICS]);

    // Execute and get result
    const result = await executor(input);

    // Transform JSON output to markdown text format with legal disclaimer
    // executeToolWithCache returns JSON, but this tool should return markdown
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as PriceHistoryOutput;
        result.content[0].text = output.markdown + getToolDisclaimer('price_history');
      } catch (error) {
        // If parsing fails, content is already in the right format
        console.error('Failed to parse price history output:', error);
      }
    }

    return result;
  };
}
