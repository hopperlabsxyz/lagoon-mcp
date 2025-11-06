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
 * - Cache tags: [CacheTag.VAULT, CacheTag.APR] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetVaultPerformanceInput } from '../utils/validators.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
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
  duration: string;
  totalAssetsAtStart: string;
  totalAssetsAtEnd: string;
  totalSupplyAtStart: string;
  totalSupplyAtEnd: string;
  netTotalSupplyAtEnd: string;
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
    'duration' in data &&
    'totalAssetsAtStart' in data &&
    'totalSupplyAtStart' in data
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
      // PeriodSummary contains totalAssetsAtEnd which represents the total assets at period end
      metrics.push({
        timestamp: parseInt(tx.timestamp, 10),
        totalAssetsUsd: parseFloat(tx.data.totalAssetsAtEnd),
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

  // Volume calculation: deposit/withdrawal fields not available in current schema
  // Frontend confirmed it doesn't use volume metrics, so we set to 0
  // If volume is needed in future, fields must be added to GraphQL schema first
  const volumeUsd = 0;

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
 * @param container - Service container with GraphQL client
 * @param vaultAddress - Vault address
 * @param chainId - Chain ID
 * @returns SDK-calculated APR data or undefined if unavailable
 */
async function calculateSDKAPR(
  container: ServiceContainer,
  vaultAddress: string,
  chainId: number
): Promise<SDKCalculatedAPR | undefined> {
  try {
    // Fetch period summaries for historical APR data
    const periodSummariesData = await container.graphqlClient.request<{
      transactions: {
        items: Array<{
          timestamp: string;
          data: PeriodSummaryData;
        }>;
        pageInfo: PageInfo;
      };
    }>(GET_PERIOD_SUMMARIES_QUERY, {
      vault_in: [vaultAddress],
      chainId,
      first: 1000,
    });

    // Fetch vault data for current price per share
    const vaultData = await container.graphqlClient.request<{ vaultByAddress: VaultData | null }>(
      GET_VAULT_FOR_APR_QUERY,
      {
        address: vaultAddress,
        chainId,
      }
    );

    // Graceful degradation if no data available
    if (!periodSummariesData.transactions?.items?.length || !vaultData.vaultByAddress) {
      return undefined;
    }

    const vault = vaultData.vaultByAddress;

    // Extract PeriodSummary data from transaction items
    const periodSummaries: PeriodSummary[] = periodSummariesData.transactions.items.map((tx) => ({
      timestamp: tx.timestamp,
      totalAssetsAtStart: tx.data.totalAssetsAtStart,
      totalSupplyAtStart: tx.data.totalSupplyAtStart,
    }));

    // Transform period summaries to APR historical data
    const aprData = transformPeriodSummariesToAPRData(periodSummaries, vault);

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
 * GraphQL variables type for GET_VAULT_PERFORMANCE_QUERY
 */
interface GetVaultPerformanceVariables {
  vault_in: string[];
  timestamp_gte: string;
  first: number;
}

/**
 * Transform raw GraphQL response into performance output
 * Uses closure to capture input values
 */
function createTransformPerformanceData(input: GetVaultPerformanceInput) {
  return (data: VaultPerformanceResponse): VaultPerformanceOutput => {
    // Aggregate metrics from transactions
    const metrics = aggregateMetrics(data.transactions.items);

    // Calculate summary statistics
    const summary = calculateSummary(metrics, data.transactions.items);

    // Build output
    return {
      vaultAddress: input.vaultAddress,
      chainId: input.chainId,
      timeRange: input.timeRange,
      metrics,
      summary,
      hasMoreData: data.transactions.pageInfo.hasNextPage,
    };
  };
}

/**
 * Create the executeGetVaultPerformance function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteGetVaultPerformance(
  container: ServiceContainer
): (input: GetVaultPerformanceInput) => Promise<CallToolResult> {
  return async (input: GetVaultPerformanceInput): Promise<CallToolResult> => {
    // Calculate timestamp threshold for GraphQL query
    const now = Math.floor(Date.now() / 1000);
    const timeRangeSeconds = TIME_RANGES[input.timeRange];
    const timestampGte = now - timeRangeSeconds;

    // Create executor with caching
    const executor = executeToolWithCache<
      GetVaultPerformanceInput,
      VaultPerformanceResponse,
      GetVaultPerformanceVariables,
      VaultPerformanceOutput
    >({
      container,
      cacheKey: (input) =>
        cacheKeys.vaultPerformance(input.vaultAddress, input.chainId, input.timeRange),
      cacheTTL: cacheTTL.performance,
      query: GET_VAULT_PERFORMANCE_QUERY,
      variables: (input) => ({
        vault_in: [input.vaultAddress],
        timestamp_gte: timestampGte.toString(),
        first: 1000, // Maximum transactions to fetch
      }),
      validateResult: (data) => ({
        valid: !!(data.transactions && data.transactions.items.length > 0),
        message:
          data.transactions && data.transactions.items.length > 0
            ? undefined
            : `No transaction data found for vault ${input.vaultAddress} on chain ${input.chainId} in the ${input.timeRange} time range.`,
      }),
      transformResult: createTransformPerformanceData(input),
      toolName: 'get_vault_performance',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.vaultPerformance(input.vaultAddress, input.chainId, input.timeRange);
    container.cacheInvalidator.register(cacheKey, [CacheTag.VAULT, CacheTag.APR]);

    // Execute main query with caching
    const result = await executor(input);

    // Post-processing: Add SDK APR calculations if requested
    // This happens outside executeToolWithCache because it requires additional async GraphQL calls
    if (input.includeSDKCalculations && !result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as VaultPerformanceOutput;
        const sdkAPR = await calculateSDKAPR(container, input.vaultAddress, input.chainId);
        if (sdkAPR) {
          output.sdkCalculatedAPR = sdkAPR;
          // Update result with SDK APR data
          result.content[0].text = JSON.stringify(output, null, 2);
        }
      } catch (error) {
        // Log error but don't fail the entire request
        console.error('Failed to add SDK APR to response:', error);
      }
    }

    return result;
  };
}
