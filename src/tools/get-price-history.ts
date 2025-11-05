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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { priceHistoryInputSchema, PriceHistoryInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';

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

/**
 * GraphQL query for historical price data
 * Fetches TotalAssetsUpdated transactions to build price history
 */
const PRICE_HISTORY_QUERY = `
  query GetPriceHistory(
    $vault_in: [Address!]!,
    $timestamp_gte: BigInt,
    $first: Int!
  ) {
    transactions(
      where: {
        vault_in: $vault_in,
        timestamp_gte: $timestamp_gte,
        type: "TotalAssetsUpdated"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        id
        timestamp
        blockNumber
        data {
          ... on TotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            pricePerShare
            pricePerShareUsd
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

/**
 * TotalAssetsUpdated transaction data
 */
interface TotalAssetsUpdatedData {
  totalAssets: string;
  totalAssetsUsd: number;
  pricePerShare: string;
  pricePerShareUsd: number;
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
    typeof data === 'object' &&
    data !== null &&
    'pricePerShareUsd' in data &&
    'totalAssetsUsd' in data
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
      .map((tx) => tx.data.pricePerShareUsd);

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
 * Fetch historical price data for a vault
 *
 * @param input - Vault address, chain ID, and time range
 * @returns OHLCV time-series data and price statistics
 */
export async function executeGetPriceHistory(input: PriceHistoryInput): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = priceHistoryInputSchema.parse(input);

    // Generate cache key
    const cacheKey = cacheKeys.priceHistory(
      validatedInput.vaultAddress,
      validatedInput.chainId,
      validatedInput.timeRange
    );

    // Check cache first
    const cachedData = cache.get<string>(cacheKey);
    if (cachedData) {
      return {
        content: [{ type: 'text', text: cachedData }],
        isError: false,
      };
    }

    // Calculate timestamp threshold (null for 'all')
    const now = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[validatedInput.timeRange];
    const timestampGte = timeRangeSeconds > 0 ? now - timeRangeSeconds : 0;

    // Build query variables
    const variables: {
      vault_in: string[];
      first: number;
      timestamp_gte?: string;
    } = {
      vault_in: [validatedInput.vaultAddress],
      first: 2000, // Maximum data points
    };

    // Only add timestamp filter if not 'all'
    if (timestampGte > 0) {
      variables.timestamp_gte = timestampGte.toString();
    }

    // Execute GraphQL query
    const data = await graphqlClient.request<PriceHistoryResponse>(PRICE_HISTORY_QUERY, variables);

    // Handle no data
    if (!data.transactions || data.transactions.items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No price history data found for vault ${validatedInput.vaultAddress} on chain ${validatedInput.chainId} in the ${validatedInput.timeRange} time range.`,
          },
        ],
        isError: false,
      };
    }

    // Aggregate into OHLCV time-series
    const ohlcvData = aggregateOHLCV(data.transactions.items);

    // Calculate statistics
    const statistics = calculateStatistics(ohlcvData);

    // Format output as markdown
    const output =
      `# Price History: ${validatedInput.vaultAddress}\n\n` +
      `**Chain ID**: ${validatedInput.chainId}\n` +
      `**Time Range**: ${validatedInput.timeRange}\n` +
      `**Data Points**: ${statistics.dataPoints}\n\n` +
      `## Price Statistics\n\n` +
      `- **Current Price**: $${statistics.currentPrice.toFixed(6)}\n` +
      `- **Start Price**: $${statistics.startPrice.toFixed(6)}\n` +
      `- **High Price**: $${statistics.highPrice.toFixed(6)}\n` +
      `- **Low Price**: $${statistics.lowPrice.toFixed(6)}\n` +
      `- **Average Price**: $${statistics.averagePrice.toFixed(6)}\n` +
      `- **Change**: ${statistics.percentChange > 0 ? '+' : ''}${statistics.percentChange.toFixed(2)}%\n` +
      `- **Volatility (σ)**: $${statistics.volatility.toFixed(6)}\n` +
      `- **Total Volume**: $${(statistics.totalVolume / 1000000).toFixed(2)}M\n\n` +
      `## OHLCV Data (Daily)\n\n` +
      `| Date | Open | High | Low | Close | Volume |\n` +
      `|------|------|------|-----|-------|--------|\n` +
      ohlcvData
        .map((d) => {
          const date = new Date(d.timestamp * 1000).toISOString().split('T')[0];
          return `| ${date} | $${d.open.toFixed(6)} | $${d.high.toFixed(6)} | $${d.low.toFixed(6)} | $${d.close.toFixed(6)} | $${(d.volume / 1000000).toFixed(2)}M |`;
        })
        .join('\n') +
      `\n\n` +
      `**Data Completeness**: ${data.transactions.pageInfo.hasNextPage ? 'More data available (truncated at 2000 points)' : 'Complete'}\n`;

    // Store in cache with 30-minute TTL
    cache.set(cacheKey, output, cacheTTL.priceHistory);

    // Return successful response
    return {
      content: [{ type: 'text', text: output }],
      isError: false,
    };
  } catch (error) {
    return handleToolError(error, 'get_price_history');
  }
}
