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
import { GetVaultPerformanceInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import {
  GET_VAULT_FOR_APR_QUERY,
  GET_VAULT_PERFORMANCE_QUERY,
  GET_PERIOD_SUMMARIES_QUERY,
} from '../graphql/queries/index.js';
import { VaultData } from '../graphql/fragments/index.js';
import {
  transformPeriodSummariesToAPRData,
  calculateCurrentAPR,
  type PeriodSummary,
} from '../sdk/apr-service.js';

/**
 * Time range constants (in seconds)
 */
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
} as const;

// Queries now imported from ../graphql/queries/index.js

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
 * SDK-calculated APR data point
 */
interface SDKAPRDataPoint {
  timestamp: number;
  pricePerShare: string;
  pricePerShareDecimal: string;
  apr: number;
}

/**
 * SDK-calculated APR section
 */
interface SDKCalculatedAPR {
  method: string;
  dataSource: string;
  thirtyDay?: SDKAPRDataPoint;
  inception?: SDKAPRDataPoint;
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
  sdkCalculatedAPR?: SDKCalculatedAPR;
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
 * Calculate SDK APR data for vault
 *
 * Fetches period summaries and vault data to calculate protocol-accurate APR
 * using Lagoon SDK functions.
 *
 * @param vaultAddress - Vault address
 * @param chainId - Chain ID
 * @returns SDK-calculated APR data or undefined if unavailable
 */
async function calculateSDKAPR(
  vaultAddress: string,
  chainId: number
): Promise<SDKCalculatedAPR | undefined> {
  try {
    // Fetch period summaries for historical APR data
    const periodSummariesData = await graphqlClient.request<{
      periodSummaries: PeriodSummary[];
    }>(GET_PERIOD_SUMMARIES_QUERY, {
      vaultAddress,
      chainId,
    });

    // Fetch vault data for current price per share
    const vaultData = await graphqlClient.request<{ vaultByAddress: VaultData | null }>(
      GET_VAULT_FOR_APR_QUERY,
      {
        address: vaultAddress,
        chainId,
      }
    );

    // Graceful degradation if no data available
    if (!periodSummariesData.periodSummaries?.length || !vaultData.vaultByAddress) {
      return undefined;
    }

    const vault = vaultData.vaultByAddress;

    // Transform period summaries to APR historical data
    const aprData = transformPeriodSummariesToAPRData(periodSummariesData.periodSummaries, vault);

    // Check if we have any APR data
    if (!aprData.thirtyDay && !aprData.inception) {
      return undefined;
    }

    // Get current price per share
    const currentPricePerShare = BigInt(vault.state.pricePerShare);

    // Calculate current APR values
    const aprs = calculateCurrentAPR(aprData, currentPricePerShare);

    // Build SDK APR response
    const result: SDKCalculatedAPR = {
      method: 'Lagoon SDK v0.10.1',
      dataSource: 'Lagoon GraphQL period summaries',
    };

    // Add 30-day APR if available
    if (aprData.thirtyDay && aprs.thirtyDay !== undefined) {
      const assetDecimals = vault.asset.decimals;
      result.thirtyDay = {
        timestamp: aprData.thirtyDay.timestamp,
        pricePerShare: aprData.thirtyDay.pricePerShare.toString(),
        pricePerShareDecimal: (
          Number(aprData.thirtyDay.pricePerShare) /
          10 ** assetDecimals
        ).toFixed(assetDecimals),
        apr: aprs.thirtyDay,
      };
    }

    // Add inception APR if available
    if (aprData.inception && aprs.inception !== undefined) {
      const assetDecimals = vault.asset.decimals;
      result.inception = {
        timestamp: aprData.inception.timestamp,
        pricePerShare: aprData.inception.pricePerShare.toString(),
        pricePerShareDecimal: (
          Number(aprData.inception.pricePerShare) /
          10 ** assetDecimals
        ).toFixed(assetDecimals),
        apr: aprs.inception,
      };
    }

    return result;
  } catch (error) {
    // Log error but don't fail the entire request
    console.error('Failed to calculate SDK APR:', error);
    return undefined;
  }
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
    // Input already validated by createToolHandler

    // Generate cache key
    const cacheKey = cacheKeys.vaultPerformance(input.vaultAddress, input.chainId, input.timeRange);

    // Check cache first
    const cachedData = cache.get<VaultPerformanceOutput>(cacheKey);
    if (cachedData) {
      return createSuccessResponse(cachedData);
    }

    // Calculate timestamp threshold
    const now = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[input.timeRange];
    const timestampGte = now - timeRangeSeconds;

    // Execute GraphQL query
    const data = await graphqlClient.request<VaultPerformanceResponse>(
      GET_VAULT_PERFORMANCE_QUERY,
      {
        vault_in: [input.vaultAddress],
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
            text: `No transaction data found for vault ${input.vaultAddress} on chain ${input.chainId} in the ${input.timeRange} time range.`,
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
      vaultAddress: input.vaultAddress,
      chainId: input.chainId,
      timeRange: input.timeRange,
      metrics,
      summary,
      hasMoreData: data.transactions.pageInfo.hasNextPage,
    };

    // Add SDK-calculated APR if requested (default: true)
    if (input.includeSDKCalculations) {
      const sdkAPR = await calculateSDKAPR(input.vaultAddress, input.chainId);
      if (sdkAPR) {
        output.sdkCalculatedAPR = sdkAPR;
      }
    }

    // Store in cache with 30-minute TTL
    cache.set(cacheKey, output, cacheTTL.performance);

    // Return successful response
    return createSuccessResponse(output);
  } catch (error) {
    return handleToolError(error, 'get_vault_performance');
  }
}
