/**
 * get_vault_performance Tool Tests
 *
 * Tests for the get_vault_performance tool handler covering:
 * - Time range calculations (7d, 30d, 90d, 1y)
 * - Transaction aggregation logic
 * - Summary statistics calculations
 * - Cache functionality
 * - Empty data handling
 * - GraphQL error handling
 * - Input validation
 *
 * Phase 3.2 implementation (2025-01-04)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeGetVaultPerformance } from '../../src/tools/vault-performance';
import * as graphqlClientModule from '../../src/graphql/client';
import { cache, cacheKeys, cacheTTL } from '../../src/cache';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

/**
 * Helper to create mock TotalAssetsUpdated transaction
 */
function createMockTotalAssetsUpdated(
  timestamp: number,
  totalAssetsUsd: number,
  totalAssets: string = '1000000000000000000000'
): unknown {
  return {
    id: `tx-${timestamp}`,
    type: 'TotalAssetsUpdated',
    timestamp: timestamp.toString(),
    blockNumber: '1000000',
    data: {
      totalAssetsUsd,
      totalAssets,
    },
  };
}

/**
 * Helper to create mock PeriodSummary transaction
 */
function createMockPeriodSummary(
  timestamp: number,
  tvl: number,
  deposits: string = '1000000000000000000000',
  withdrawals: string = '500000000000000000000'
): unknown {
  return {
    id: `tx-${timestamp}`,
    type: 'PeriodSummary',
    timestamp: timestamp.toString(),
    blockNumber: '1000000',
    data: {
      tvl,
      deposits,
      withdrawals,
    },
  };
}

/**
 * Helper to create mock performance response
 */
function createMockPerformanceResponse(transactions: unknown[]): unknown {
  return {
    transactions: {
      items: transactions,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
  };
}

describe('get_vault_performance Tool', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890';
  const mockChainId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();
  });

  afterEach(() => {
    cache.flushAll();
  });

  describe('Time Range Calculations', () => {
    it('should calculate correct timestamp for 7d range', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      const callArgs = (graphqlClientModule.graphqlClient.request as never).mock.calls[0][1] as {
        timestamp_gte: string;
      };
      const timestampGte = parseInt(callArgs.timestamp_gte);
      const expectedTimestamp = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

      // Allow 5 second tolerance for test execution time
      expect(Math.abs(timestampGte - expectedTimestamp)).toBeLessThan(5);
    });

    it('should calculate correct timestamp for 30d range', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '30d',
      });

      // Assert
      const callArgs = (graphqlClientModule.graphqlClient.request as never).mock.calls[0][1] as {
        timestamp_gte: string;
      };
      const timestampGte = parseInt(callArgs.timestamp_gte);
      const expectedTimestamp = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

      expect(Math.abs(timestampGte - expectedTimestamp)).toBeLessThan(5);
    });

    it('should calculate correct timestamp for 90d range', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '90d',
      });

      // Assert
      const callArgs = (graphqlClientModule.graphqlClient.request as never).mock.calls[0][1] as {
        timestamp_gte: string;
      };
      const timestampGte = parseInt(callArgs.timestamp_gte);
      const expectedTimestamp = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

      expect(Math.abs(timestampGte - expectedTimestamp)).toBeLessThan(5);
    });

    it('should calculate correct timestamp for 1y range', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '1y',
      });

      // Assert
      const callArgs = (graphqlClientModule.graphqlClient.request as never).mock.calls[0][1] as {
        timestamp_gte: string;
      };
      const timestampGte = parseInt(callArgs.timestamp_gte);
      const expectedTimestamp = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

      expect(Math.abs(timestampGte - expectedTimestamp)).toBeLessThan(5);
    });
  });

  describe('Transaction Aggregation', () => {
    it('should aggregate TotalAssetsUpdated transactions', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 7200, 900000),
        createMockTotalAssetsUpdated(now - 3600, 950000),
        createMockTotalAssetsUpdated(now - 1800, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.metrics).toHaveLength(3);
      expect(data.metrics[0].totalAssetsUsd).toBe(900000);
      expect(data.metrics[1].totalAssetsUsd).toBe(950000);
      expect(data.metrics[2].totalAssetsUsd).toBe(1000000);
    });

    it('should aggregate PeriodSummary transactions', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockPeriodSummary(now - 7200, 900000),
        createMockPeriodSummary(now - 3600, 950000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.metrics).toHaveLength(2);
      expect(data.metrics[0].totalAssetsUsd).toBe(900000);
      expect(data.metrics[1].totalAssetsUsd).toBe(950000);
    });

    it('should aggregate mixed transaction types', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 7200, 900000),
        createMockPeriodSummary(now - 3600, 950000),
        createMockTotalAssetsUpdated(now - 1800, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.metrics).toHaveLength(3);
      expect(data.summary.transactionCount).toBe(3);
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate correct percent change (positive)', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000), // start
        createMockTotalAssetsUpdated(now - 1800, 1100000), // end (+10%)
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.summary.startValue).toBe(1000000);
      expect(data.summary.endValue).toBe(1100000);
      expect(data.summary.percentChange).toBeCloseTo(10, 1);
    });

    it('should calculate correct percent change (negative)', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000), // start
        createMockTotalAssetsUpdated(now - 1800, 900000), // end (-10%)
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.summary.percentChange).toBeCloseTo(-10, 1);
    });

    it('should calculate volume from PeriodSummary transactions', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockPeriodSummary(now - 3600, 1000000, '1000', '500'), // vol = 1500
        createMockPeriodSummary(now - 1800, 1100000, '2000', '1000'), // vol = 3000
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.summary.volumeUsd).toBe(4500); // 1500 + 3000
    });

    it('should count all transactions', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 7200, 900000),
        createMockPeriodSummary(now - 5400, 920000),
        createMockTotalAssetsUpdated(now - 3600, 950000),
        createMockPeriodSummary(now - 1800, 980000),
        createMockTotalAssetsUpdated(now - 900, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.summary.transactionCount).toBe(5);
    });
  });

  describe('Cache Functionality', () => {
    it('should cache performance data with 30-minute TTL', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(cacheTTL.performance).toBe(1800); // 30 minutes
      const cacheKey = cacheKeys.vaultPerformance(mockVaultAddress, mockChainId, '7d');
      const cachedData = cache.get(cacheKey);
      expect(cachedData).toBeDefined();
    });

    it('should return cached data without querying GraphQL', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act - First call (cache miss) - disable SDK calculations to isolate cache test
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
        includeSDKCalculations: false,
      });

      // Act - Second call (cache hit)
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
        includeSDKCalculations: false,
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledOnce();
    });

    it('should cache separately for different time ranges', async () => {
      // Arrange
      const mockResponse7d = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 3600, 1000000),
      ]);
      const mockResponse30d = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(Date.now() / 1000 - 86400, 900000),
      ]);

      vi.spyOn(graphqlClientModule.graphqlClient, 'request')
        .mockResolvedValueOnce(mockResponse7d)
        .mockResolvedValueOnce(mockResponse30d);

      // Act - disable SDK calculations to isolate cache test
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
        includeSDKCalculations: false,
      });
      await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '30d',
        includeSDKCalculations: false,
      });

      // Assert
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Empty Data Handling', () => {
    it('should handle vaults with no transaction history', async () => {
      // Arrange
      const mockResponse = createMockPerformanceResponse([]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No transaction data found');
    });

    it('should handle null transactions array', async () => {
      // Arrange
      const mockResponse = { transactions: null };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No transaction data found');
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL errors gracefully', async () => {
      // Arrange
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(
        new Error('GraphQL request failed')
      );

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('GraphQL request failed');
    });

    // NOTE: Validation tests removed - validation handled by wrapper
  });

  describe('Output Structure', () => {
    it('should include all required output fields', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data).toHaveProperty('vaultAddress');
      expect(data).toHaveProperty('chainId');
      expect(data).toHaveProperty('timeRange');
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('hasMoreData');
    });

    it('should indicate when more data is available', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = {
        transactions: {
          items: [createMockTotalAssetsUpdated(now - 3600, 1000000)],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
          },
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.hasMoreData).toBe(true);
    });
  });

  describe('SDK APR Calculations', () => {
    it('should include SDK APR data when explicitly requested', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockPerformanceResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000),
      ]);

      const mockPeriodSummariesResponse = {
        periodSummaries: [
          {
            timestamp: (now - 30 * 24 * 60 * 60).toString(),
            totalAssetsAtStart: '1000000000000',
            totalSupplyAtStart: '1000000000000',
          },
        ],
      };

      const mockVaultResponse = {
        vaultByAddress: {
          address: mockVaultAddress,
          decimals: 18,
          asset: {
            decimals: 6,
          },
          state: {
            pricePerShare: '1025000',
          },
        },
      };

      vi.spyOn(graphqlClientModule.graphqlClient, 'request')
        .mockResolvedValueOnce(mockPerformanceResponse)
        .mockResolvedValueOnce(mockPeriodSummariesResponse)
        .mockResolvedValueOnce(mockVaultResponse);

      // Act
      // NOTE: Test bypasses wrapper, so we must explicitly pass includeSDKCalculations: true
      // In production, the wrapper applies the default value from the schema
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
        includeSDKCalculations: true,
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data).toHaveProperty('sdkCalculatedAPR');
    });

    it('should exclude SDK APR data when includeSDKCalculations is false', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000),
      ]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
        includeSDKCalculations: false,
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data).not.toHaveProperty('sdkCalculatedAPR');
    });

    it('should handle missing period summaries gracefully', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockPerformanceResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000),
      ]);

      const mockPeriodSummariesResponse = {
        periodSummaries: [],
      };

      vi.spyOn(graphqlClientModule.graphqlClient, 'request')
        .mockResolvedValueOnce(mockPerformanceResponse)
        .mockResolvedValueOnce(mockPeriodSummariesResponse);

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data).not.toHaveProperty('sdkCalculatedAPR');
    });

    it('should handle SDK APR calculation errors gracefully', async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const mockPerformanceResponse = createMockPerformanceResponse([
        createMockTotalAssetsUpdated(now - 3600, 1000000),
      ]);

      vi.spyOn(graphqlClientModule.graphqlClient, 'request')
        .mockResolvedValueOnce(mockPerformanceResponse)
        .mockRejectedValueOnce(new Error('Period summaries fetch failed'));

      // Act
      const result = await executeGetVaultPerformance({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
        timeRange: '7d',
      });

      // Assert - Main response should still succeed
      expect(result.isError).toBe(false);
      const data = JSON.parse(result.content[0].text as string);
      expect(data).toHaveProperty('metrics');
      expect(data).not.toHaveProperty('sdkCalculatedAPR');
    });
  });
});
