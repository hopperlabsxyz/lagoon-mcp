/**
 * Tests for get_price_history Tool
 *
 * Comprehensive test suite covering:
 * - Basic price history fetching for all time ranges
 * - OHLCV data aggregation and daily bucketing
 * - Price statistics calculations (volatility, percent change)
 * - Cache workflow and TTL validation
 * - Empty data and edge case handling
 * - Input validation for all parameters
 * - Error handling for network and GraphQL failures
 * - Output formatting and markdown generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphqlClient } from '../../src/graphql/client.js';
import { cache } from '../../src/cache/index.js';
import { createExecuteGetPriceHistory } from '../../src/tools/get-price-history.js';
import { createMockContainer } from '../helpers/test-container.js';
import type { ServiceContainer } from '../../src/core/container.js';

// Mock dependencies
vi.mock('../../src/graphql/client.js', () => ({
  graphqlClient: {
    request: vi.fn<[unknown, unknown?], Promise<unknown>>(),
  },
}));

/**
 * Helper: Create mock price transaction
 */
function createMockPriceTransaction(
  timestamp: number,
  pricePerShareUsd: number,
  totalAssetsUsd: number = 1000000
): {
  id: string;
  timestamp: string;
  blockNumber: string;
  data: {
    totalAssets: string;
    totalAssetsUsd: number;
    totalSupply: string;
    pricePerShare: string;
    pricePerShareUsd: number;
  };
} {
  return {
    id: `tx-${timestamp}`,
    timestamp: timestamp.toString(),
    blockNumber: '1000000',
    data: {
      totalAssets: '1000000000000000000',
      totalAssetsUsd,
      // totalSupply should be totalAssetsUsd / pricePerShareUsd in wei
      // If totalAssetsUsd = 1M and pricePerShareUsd = 1.0, totalSupply = 1M tokens = 1e24 wei
      totalSupply: ((totalAssetsUsd / pricePerShareUsd) * 1e18).toString(),
      pricePerShare: '1000000000000000000',
      pricePerShareUsd,
    },
  };
}

describe('get_price_history Tool', () => {
  // Executor function created from factory with mock container
  let executeGetPriceHistory: ReturnType<typeof createExecuteGetPriceHistory>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();

    // Create mock container and initialize executor
    const mockContainer: ServiceContainer = createMockContainer();
    executeGetPriceHistory = createExecuteGetPriceHistory(mockContainer);
  });

  describe('Basic Price History Functionality', () => {
    it('should fetch 7-day price history successfully', async () => {
      // Create mock transactions for 7 days
      const now = Math.floor(Date.now() / 1000);
      const transactions = [];
      for (let i = 0; i < 7; i++) {
        const dayTimestamp = now - i * 86400;
        transactions.push(createMockPriceTransaction(dayTimestamp, 1.0 + i * 0.01, 1000000));
      }

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text as string;
      expect(text).toContain('# Price History');
      expect(text).toContain('Time Range**: 7d');
      expect(text).toContain('Data Points**: 7');
      expect(text).toContain('OHLCV Data (Daily)');
    });

    it('should fetch 30-day price history successfully', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [];
      for (let i = 0; i < 30; i++) {
        const dayTimestamp = now - i * 86400;
        transactions.push(createMockPriceTransaction(dayTimestamp, 1.0 + Math.random() * 0.1));
      }

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '30d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Time Range**: 30d');
      expect(text).toContain('Data Points**: 30');
    });

    it('should fetch 90-day price history successfully', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [];
      for (let i = 0; i < 90; i++) {
        const dayTimestamp = now - i * 86400;
        transactions.push(createMockPriceTransaction(dayTimestamp, 1.0 + i * 0.001));
      }

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '90d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Time Range**: 90d');
      expect(text).toContain('Data Points**: 90');
    });

    it('should fetch 1-year price history successfully', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [];
      for (let i = 0; i < 365; i += 7) {
        const dayTimestamp = now - i * 86400;
        transactions.push(createMockPriceTransaction(dayTimestamp, 1.0 + Math.sin(i / 10) * 0.2));
      }

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '1y',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Time Range**: 1y');
    });

    it('should fetch complete price history with "all" time range', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [];
      for (let i = 0; i < 500; i += 10) {
        const dayTimestamp = now - i * 86400;
        transactions.push(createMockPriceTransaction(dayTimestamp, 1.0));
      }

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: 'all',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Time Range**: all');
    });
  });

  describe('OHLCV Data Aggregation', () => {
    it('should aggregate multiple transactions per day into OHLCV correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayStart = Math.floor(now / 86400) * 86400;

      // Multiple transactions on the same day with different prices
      const transactions = [
        createMockPriceTransaction(dayStart + 1000, 1.0), // Open
        createMockPriceTransaction(dayStart + 2000, 1.05), // High
        createMockPriceTransaction(dayStart + 3000, 0.95), // Low
        createMockPriceTransaction(dayStart + 4000, 1.02), // Close
      ];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;

      // Should have high price of 1.05
      expect(text).toMatch(/High.*1\.05/);
      // Should have low price of 0.95
      expect(text).toMatch(/Low.*0\.95/);
      // Should have 1 data point (1 day)
      expect(text).toContain('Data Points**: 1');
    });

    it('should handle multiple days with varying transaction counts', async () => {
      const now = Math.floor(Date.now() / 1000);
      // Align to day boundaries to ensure transactions fall in different day buckets
      const currentDayBucket = Math.floor(now / 86400) * 86400;
      const transactions = [];

      // Day 1: 5 transactions (all within the same day bucket, spaced by 10 minutes)
      const day1Start = currentDayBucket - 86400;
      for (let i = 0; i < 5; i++) {
        transactions.push(createMockPriceTransaction(day1Start + i * 600, 1.0 + i * 0.01));
      }

      // Day 2: 2 transactions (all within a different day bucket, spaced by 10 minutes)
      const day2Start = currentDayBucket - 2 * 86400;
      for (let i = 0; i < 2; i++) {
        transactions.push(createMockPriceTransaction(day2Start + i * 600, 1.1));
      }

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Data Points**: 2');
    });
  });

  describe('Price Statistics Calculation', () => {
    it('should calculate price statistics correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [
        createMockPriceTransaction(now - 6 * 86400, 1.0),
        createMockPriceTransaction(now - 5 * 86400, 1.1),
        createMockPriceTransaction(now - 4 * 86400, 1.05),
        createMockPriceTransaction(now - 3 * 86400, 1.15),
        createMockPriceTransaction(now - 2 * 86400, 1.2),
      ];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;

      // Should show start price (1.0)
      expect(text).toMatch(/Start Price.*\$1\.0/);
      // Should show current/close price (1.2)
      expect(text).toMatch(/Current Price.*\$1\.2/);
      // Should show high price (1.2)
      expect(text).toMatch(/High Price.*\$1\.2/);
      // Should show low price (1.0)
      expect(text).toMatch(/Low Price.*\$1\.0/);
      // Should show percent change (+20%)
      expect(text).toMatch(/Change.*\+20/);
    });

    it('should calculate volatility (standard deviation)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [
        createMockPriceTransaction(now - 4 * 86400, 1.0),
        createMockPriceTransaction(now - 3 * 86400, 1.5),
        createMockPriceTransaction(now - 2 * 86400, 0.8),
        createMockPriceTransaction(now - 86400, 1.2),
      ];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Volatility (σ)');
    });

    it('should handle negative price change correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [
        createMockPriceTransaction(now - 2 * 86400, 1.5),
        createMockPriceTransaction(now - 86400, 1.2),
      ];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      // Should show negative percent change (-20%)
      expect(text).toMatch(/Change.*-20/);
    });
  });

  describe('Cache Workflow', () => {
    it('should cache price history results for 30 minutes', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [createMockPriceTransaction(now, 1.0)];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      // First call should fetch from GraphQL
      const result1 = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(graphqlClient.request).toHaveBeenCalledTimes(1);
      expect(result1.isError).toBe(false);

      // Second call should use cache
      const result2 = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(graphqlClient.request).toHaveBeenCalledTimes(1); // Still 1, used cache
      expect(result2.isError).toBe(false);
    });

    it('should use different cache keys for different vaults', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [createMockPriceTransaction(now, 1.0)];

      vi.mocked(graphqlClient).request.mockResolvedValue({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      await executeGetPriceHistory({
        vaultAddress: '0x2222222222222222222222222222222222222222',
        chainId: 1,
        timeRange: '7d',
      });

      expect(graphqlClient.request).toHaveBeenCalledTimes(2); // Different vaults
    });

    it('should use different cache keys for different time ranges', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [createMockPriceTransaction(now, 1.0)];

      vi.mocked(graphqlClient).request.mockResolvedValue({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '30d',
      });

      expect(graphqlClient.request).toHaveBeenCalledTimes(2); // Different time ranges
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle no price data found', async () => {
      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('No price history data found');
    });

    it('should handle null transactions response', async () => {
      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: null,
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('No price history data found');
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('Error Handling', () => {
    it('should handle GraphQL network errors', async () => {
      vi.mocked(graphqlClient).request.mockRejectedValueOnce(new Error('Network error'));

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(true);
      const text = result.content[0].text as string;
      expect(text).toContain('Network error');
    });

    it('should handle GraphQL timeout errors', async () => {
      vi.mocked(graphqlClient).request.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(true);
      const text = result.content[0].text as string;
      expect(text).toContain('Request timeout');
    });
  });

  describe('Output Formatting', () => {
    it('should include all required sections in output', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [
        createMockPriceTransaction(now - 2 * 86400, 1.0),
        createMockPriceTransaction(now - 86400, 1.1),
      ];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;

      // Should include all major sections
      expect(text).toContain('# Price History');
      expect(text).toContain('## Price Statistics');
      expect(text).toContain('## OHLCV Data (Daily)');
      expect(text).toContain('Current Price');
      expect(text).toContain('Start Price');
      expect(text).toContain('High Price');
      expect(text).toContain('Low Price');
      expect(text).toContain('Average Price');
      expect(text).toContain('Change');
      expect(text).toContain('Volatility');
      expect(text).toContain('Total Volume');
    });

    it('should format markdown table with correct headers', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [createMockPriceTransaction(now, 1.0)];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toMatch(/\| Date \| Open \| High \| Low \| Close \| Volume \|/);
    });

    it('should indicate when more data is available (truncation)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const transactions = [createMockPriceTransaction(now, 1.0)];

      vi.mocked(graphqlClient).request.mockResolvedValueOnce({
        transactions: {
          items: transactions,
          pageInfo: { hasNextPage: true, hasPreviousPage: false },
        },
      });

      const result = await executeGetPriceHistory({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('More data available');
    });
  });
});
