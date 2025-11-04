/**
 * get_vault_performance Tool
 *
 * Historical metrics and trend analysis for vaults with 30-minute caching.
 * Aggregates transaction data to provide time-series performance metrics.
 *
 * Use cases:
 * - Performance tracking over time (7d, 30d, 90d, 1y)
 * - TVL trend analysis and inflection point identification
 * - Historical deposit/withdrawal volume analysis
 * - Percent change calculations and performance comparison
 * - Performance: ~400-600 tokens per vault per time range
 *
 * Cache strategy:
 * - 30-minute TTL (historical data changes infrequently)
 * - Cache key: perf:{address}:{chainId}:{timeRange}
 * - Cache hit rate target: 80-90%
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { getVaultPerformanceInputSchema, GetVaultPerformanceInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';

/**
 * Time range constants (in seconds)
 */
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
} as const;

/**
 * Vault performance GraphQL query
 * Fetches transactions with TotalAssetsUpdated and PeriodSummary data
 */
const GET_VAULT_PERFORMANCE_QUERY = `
  query GetVaultPerformance(
    $vault_in: [Address!]!,
    $timestamp_gte: BigInt!,
    $first: Int!
  ) {
    transactions(
      where: {
        vault_in: $vault_in,
        timestamp_gte: $timestamp_gte,
        type_in: ["TotalAssetsUpdated", "PeriodSummary"]
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        id
        type
        timestamp
        blockNumber
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
            totalAssets
          }
          ... on PeriodSummary {
            tvl
            deposits
            withdrawals
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
 * Transaction data types
 */
interface TotalAssetsUpdatedData {
  totalAssetsUsd: number;
  totalAssets: string;
}

interface PeriodSummaryData {
  tvl: number;
  deposits: string;
  withdrawals: string;
}

interface Transaction {
  id: string;
  type: 'TotalAssetsUpdated' | 'PeriodSummary';
  timestamp: string; // BigInt as string
  blockNumber: string; // BigInt as string
  data: TotalAssetsUpdatedData | PeriodSummaryData;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * GraphQL response type
 */
interface VaultPerformanceResponse {
  transactions: {
    items: Transaction[];
    pageInfo: PageInfo;
  };
}

/**
 * Time-series metric point
 */
interface MetricPoint {
  timestamp: number;
  totalAssetsUsd: number;
  blockNumber: string;
}

/**
 * Summary statistics
 */
interface PerformanceSummary {
  startValue: number;
  endValue: number;
  percentChange: number;
  volumeUsd: number;
  transactionCount: number;
}

/**
 * Complete performance output
 */
interface VaultPerformanceOutput {
  vaultAddress: string;
  chainId: number;
  timeRange: string;
  metrics: MetricPoint[];
  summary: PerformanceSummary;
  hasMoreData: boolean;
}

/**
 * Type guard for TotalAssetsUpdatedData
 */
function isTotalAssetsUpdated(data: unknown): data is TotalAssetsUpdatedData {
  return (
    typeof data === 'object' && data !== null && 'totalAssetsUsd' in data && 'totalAssets' in data
  );
}

/**
 * Type guard for PeriodSummaryData
 */
function isPeriodSummary(data: unknown): data is PeriodSummaryData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'tvl' in data &&
    'deposits' in data &&
    'withdrawals' in data
  );
}

/**
 * Aggregate transaction data into time-series metrics
 */
function aggregateMetrics(transactions: Transaction[]): MetricPoint[] {
  const metrics: MetricPoint[] = [];

  for (const tx of transactions) {
    if (tx.type === 'TotalAssetsUpdated' && isTotalAssetsUpdated(tx.data)) {
      metrics.push({
        timestamp: parseInt(tx.timestamp, 10),
        totalAssetsUsd: tx.data.totalAssetsUsd,
        blockNumber: tx.blockNumber,
      });
    } else if (tx.type === 'PeriodSummary' && isPeriodSummary(tx.data)) {
      // PeriodSummary contains TVL which is equivalent to totalAssetsUsd
      metrics.push({
        timestamp: parseInt(tx.timestamp, 10),
        totalAssetsUsd: tx.data.tvl,
        blockNumber: tx.blockNumber,
      });
    }
  }

  return metrics;
}

/**
 * Calculate summary statistics from metrics
 */
function calculateSummary(metrics: MetricPoint[], transactions: Transaction[]): PerformanceSummary {
  if (metrics.length === 0) {
    return {
      startValue: 0,
      endValue: 0,
      percentChange: 0,
      volumeUsd: 0,
      transactionCount: 0,
    };
  }

  const startValue = metrics[0].totalAssetsUsd;
  const endValue = metrics[metrics.length - 1].totalAssetsUsd;
  const percentChange = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;

  // Calculate total volume from PeriodSummary transactions
  let volumeUsd = 0;
  for (const tx of transactions) {
    if (tx.type === 'PeriodSummary' && isPeriodSummary(tx.data)) {
      // Convert BigInt strings to numbers and add to volume
      const deposits = parseFloat(tx.data.deposits);
      const withdrawals = parseFloat(tx.data.withdrawals);
      volumeUsd += deposits + withdrawals;
    }
  }

  return {
    startValue,
    endValue,
    percentChange,
    volumeUsd,
    transactionCount: transactions.length,
  };
}

/**
 * Fetch vault performance data with historical metrics
 *
 * @param input - Vault address, chain ID, and time range
 * @returns Time-series metrics and summary statistics
 */
export async function executeGetVaultPerformance(
  input: GetVaultPerformanceInput
): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = getVaultPerformanceInputSchema.parse(input);

    // Generate cache key
    const cacheKey = cacheKeys.vaultPerformance(
      validatedInput.vaultAddress,
      validatedInput.chainId,
      validatedInput.timeRange
    );

    // Check cache first
    const cachedData = cache.get<VaultPerformanceOutput>(cacheKey);
    if (cachedData) {
      return createSuccessResponse(cachedData);
    }

    // Calculate timestamp threshold
    const now = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[validatedInput.timeRange];
    const timestampGte = now - timeRangeSeconds;

    // Execute GraphQL query
    const data = await graphqlClient.request<VaultPerformanceResponse>(
      GET_VAULT_PERFORMANCE_QUERY,
      {
        vault_in: [validatedInput.vaultAddress],
        timestamp_gte: timestampGte.toString(),
        first: 1000, // Maximum transactions to fetch
      }
    );

    // Handle empty results
    if (!data.transactions || data.transactions.items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No transaction data found for vault ${validatedInput.vaultAddress} on chain ${validatedInput.chainId} in the ${validatedInput.timeRange} time range.`,
          },
        ],
        isError: false,
      };
    }

    // Aggregate metrics from transactions
    const metrics = aggregateMetrics(data.transactions.items);

    // Calculate summary statistics
    const summary = calculateSummary(metrics, data.transactions.items);

    // Build output
    const output: VaultPerformanceOutput = {
      vaultAddress: validatedInput.vaultAddress,
      chainId: validatedInput.chainId,
      timeRange: validatedInput.timeRange,
      metrics,
      summary,
      hasMoreData: data.transactions.pageInfo.hasNextPage,
    };

    // Store in cache with 30-minute TTL
    cache.set(cacheKey, output, cacheTTL.performance);

    // Return successful response
    return createSuccessResponse(output);
  } catch (error) {
    return handleToolError(error, 'get_vault_performance');
  }
}
