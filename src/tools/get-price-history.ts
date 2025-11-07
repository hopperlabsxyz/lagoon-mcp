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
 * TotalAssetsUpdated transaction data
 */
interface TotalAssetsUpdatedData {
  totalAssets: string;
  totalAssetsUsd: number;
  totalSupply: string;
}

/**
 * Transaction with price data
 */
interface PriceTransaction {
  id: string;
  timestamp: string;
  blockNumber: string;
  data: TotalAssetsUpdatedData;
}

/**
 * GraphQL response type
 */
interface PriceHistoryResponse {
  transactions: {
    items: PriceTransaction[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
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
  blockNumber: string;
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
 * Type guard for TotalAssetsUpdatedData
 */
function isTotalAssetsUpdated(data: unknown): data is TotalAssetsUpdatedData {
  return (
    typeof data === 'object' && data !== null && 'totalAssetsUsd' in data && 'totalSupply' in data
  );
}

/**
 * Aggregate transactions into OHLCV time buckets
 * Groups data by day for cleaner visualization
 */
function aggregateOHLCV(transactions: PriceTransaction[]): OHLCVDataPoint[] {
  if (transactions.length === 0) return [];

  // Group transactions by day (86400 seconds)
  const dayBuckets = new Map<number, PriceTransaction[]>();

  for (const tx of transactions) {
    if (!isTotalAssetsUpdated(tx.data)) continue;

    const timestamp = parseInt(tx.timestamp, 10);
    const dayTimestamp = Math.floor(timestamp / 86400) * 86400;

    if (!dayBuckets.has(dayTimestamp)) {
      dayBuckets.set(dayTimestamp, []);
    }
    dayBuckets.get(dayTimestamp)!.push(tx);
  }

  // Convert buckets to OHLCV data points
  const ohlcvData: OHLCVDataPoint[] = [];

  for (const [dayTimestamp, txs] of Array.from(dayBuckets.entries()).sort((a, b) => a[0] - b[0])) {
    const prices = txs
      .filter((tx) => isTotalAssetsUpdated(tx.data))
      .map((tx) => {
        // Calculate price per share from totalAssetsUsd / totalSupply
        const totalSupply = parseFloat(tx.data.totalSupply) / 1e18; // Convert from wei to decimal
        return totalSupply > 0 ? tx.data.totalAssetsUsd / totalSupply : 0;
      });

    if (prices.length === 0) continue;

    const volumes = txs
      .filter((tx) => isTotalAssetsUpdated(tx.data))
      .map((tx) => tx.data.totalAssetsUsd);

    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length; // Average TVL for the day

    ohlcvData.push({
      timestamp: dayTimestamp,
      open,
      high,
      low,
      close,
      volume,
      blockNumber: txs[txs.length - 1].blockNumber,
    });
  }

  return ohlcvData;
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
 * GraphQL variables type for PRICE_HISTORY_QUERY
 */
interface PriceHistoryVariables {
  where: {
    vault_in: string[];
    type_in: string[];
  };
  orderBy: string;
  orderDirection: string;
  first: number;
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
function createTransformPriceHistoryData(input: PriceHistoryInput, timestampGte: number) {
  return (data: PriceHistoryResponse): PriceHistoryOutput => {
    // Filter transactions by timestamp client-side (since API doesn't support timestamp filtering)
    const filteredItems =
      timestampGte > 0
        ? data.transactions.items.filter((item) => parseInt(item.timestamp) >= timestampGte)
        : data.transactions.items;

    // Aggregate into OHLCV time-series
    const ohlcvData = aggregateOHLCV(filteredItems);

    // Calculate statistics
    const statistics = calculateStatistics(ohlcvData);

    // Format output as markdown based on responseFormat
    const responseFormat = input.responseFormat || 'summary';

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

    markdown += `**Data Completeness**: ${data.transactions.pageInfo.hasNextPage ? 'More data available (truncated at 2000 points)' : 'Complete'}\n`;

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
    const timestampGte = timeRangeSeconds > 0 ? now - timeRangeSeconds : 0;

    // Build query variables
    const variables: PriceHistoryVariables = {
      where: {
        vault_in: [input.vaultAddress],
        type_in: ['TotalAssetsUpdated'],
      },
      orderBy: 'timestamp',
      orderDirection: 'asc',
      first: 1000, // GraphQL API limit: 1-1000
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
      validateResult: (data) => ({
        valid: !!(data.transactions && data.transactions.items.length > 0),
        message:
          data.transactions && data.transactions.items.length > 0
            ? undefined
            : `No price history data found for vault ${input.vaultAddress} on chain ${input.chainId} in the ${input.timeRange} time range.`,
      }),
      transformResult: createTransformPriceHistoryData(input, timestampGte),
      toolName: 'get_price_history',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.priceHistory(input.vaultAddress, input.chainId, input.timeRange);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT, CacheTag.ANALYTICS]);

    // Execute and get result
    const result = await executor(input);

    // Transform JSON output to markdown text format
    // executeToolWithCache returns JSON, but this tool should return markdown
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as PriceHistoryOutput;
        result.content[0].text = output.markdown;
      } catch (error) {
        // If parsing fails, content is already in the right format
        console.error('Failed to parse price history output:', error);
      }
    }

    return result;
  };
}
