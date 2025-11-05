/**
 * Tests for predict_yield tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePredictYield } from '../../src/tools/predict-yield.js';
import { graphqlClient } from '../../src/graphql/client.js';
import { clearCache } from '../../src/cache/index.js';

// Mock the GraphQL client
vi.mock('../../src/graphql/client.js', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

// Mock the cache module
vi.mock('../../src/cache/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/cache/index.js')>(
    '../../src/cache/index.js'
  );
  return {
    ...actual,
    cache: {
      get: vi.fn(() => undefined),
      set: vi.fn(),
      getStats: actual.cache.getStats,
      flushAll: actual.cache.flushAll,
    },
  };
});

describe('predict_yield Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  /**
   * Helper to create mock vault data
   */
  function createMockVault(name = 'Test Vault'): unknown {
    return {
      address: '0x1234567890123456789012345678901234567890',
      name,
      symbol: 'TEST',
      decimals: 18,
      asset: { address: '0xasset...', symbol: 'USDC' },
      state: {
        totalAssets: '1000000000000',
        totalSupply: '900000000000',
        totalAssetsUsd: 1000000,
        pricePerShareUsd: 1.05,
      },
    };
  }

  /**
   * Helper to create mock performance history
   */
  function createMockPerformanceHistory(
    data: Array<{ timestamp: number; apy: number; tvl: number }>
  ): unknown {
    return {
      items: data.map((d) => ({
        timestamp: String(d.timestamp),
        data: {
          apy: d.apy,
          totalAssetsUsd: d.tvl,
        },
      })),
    };
  }

  // ==========================================
  // Yield Prediction - Increasing Trend Tests
  // ==========================================

  describe('Yield Prediction - Increasing Trend', () => {
    it('should predict increasing APY based on upward trend', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create increasing APY trend: 5% -> 10% over 30 days
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apy: 5 + (i / 29) * 5, // 5% to 10%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Increasing APY Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show increasing trend
      expect(text).toContain('Increasing');
      expect(text).toContain('📈');

      // Should have current and predicted APY
      expect(text).toMatch(/Current APY.*%/);
      expect(text).toMatch(/Predicted APY.*%/);

      // Should have projected returns
      expect(text).toContain('7d');
      expect(text).toContain('30d');
      expect(text).toContain('90d');
      expect(text).toContain('1y');
    });
  });

  // ==========================================
  // Yield Prediction - Decreasing Trend Tests
  // ==========================================

  describe('Yield Prediction - Decreasing Trend', () => {
    it('should predict decreasing APY based on downward trend', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create decreasing APY trend: 10% -> 5% over 30 days
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apy: 10 - (i / 29) * 5, // 10% to 5%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Decreasing APY Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show decreasing trend
      expect(text).toContain('Decreasing');
      expect(text).toContain('📉');
    });
  });

  // ==========================================
  // Yield Prediction - Stable Trend Tests
  // ==========================================

  describe('Yield Prediction - Stable Trend', () => {
    it('should predict stable APY when no significant trend exists', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create stable APY around 7%
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apy: 7 + (Math.random() - 0.5) * 0.2, // 7% ± 0.1%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Stable APY Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show stable trend
      expect(text).toContain('Stable');
      expect(text).toContain('➡️');
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('should handle insufficient historical data', async () => {
      const mockData = {
        vault: createMockVault(),
        performanceHistory: { items: [] },
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should indicate insufficient data
      expect(text).toContain('Insufficient historical data');
      expect(text).toMatch(/Confidence.*0%/);
    });

    it('should handle vault not found', async () => {
      const mockData = {
        vault: null,
        performanceHistory: { items: [] },
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('No vault found');
    });

    it('should handle very limited data (< 7 points)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [
        { timestamp: now - 2 * dayInSeconds, apy: 5, tvl: 1000000 },
        { timestamp: now - 1 * dayInSeconds, apy: 5.5, tvl: 1000000 },
        { timestamp: now, apy: 6, tvl: 1000000 },
      ];

      const mockData = {
        vault: createMockVault(),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should warn about limited data
      expect(text).toContain('Limited data');
    });
  });

  // ==========================================
  // Confidence Scoring
  // ==========================================

  describe('Confidence Scoring', () => {
    it('should provide high confidence with abundant data and strong trend', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create strong linear trend with 90 days of data
      const performanceData = [];
      for (let i = 0; i < 90; i++) {
        performanceData.push({
          timestamp: now - (89 - i) * dayInSeconds,
          apy: 5 + (i / 89) * 5, // Clear 5% -> 10% trend
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault(),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '90d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should have high confidence
      expect(text).toMatch(/High confidence/i);
    });

    it('should provide low confidence with sparse or noisy data', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create very noisy data
      const performanceData = [];
      for (let i = 0; i < 10; i++) {
        performanceData.push({
          timestamp: now - (9 - i) * dayInSeconds,
          apy: 5 + Math.random() * 10, // Very noisy: 5-15%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault(),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should have lower confidence or warn about volatility/weak trend
      expect(text).toMatch(/(Low confidence|High volatility|Weak trend)/i);
    });
  });

  // ==========================================
  // Input Validation
  // ==========================================

  describe('Input Validation', () => {
    it('should reject invalid vault address', async () => {
      const result = await executePredictYield({
        vaultAddress: 'invalid-address',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Validation Error');
      expect(text).toContain('Invalid Ethereum address');
    });

    it('should reject invalid chain ID', async () => {
      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: -1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Validation Error');
    });

    it('should reject invalid time range', async () => {
      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '1y' as never,
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Validation Error');
      expect(text).toContain('Time range must be one of: 7d, 30d, 90d');
    });
  });

  // ==========================================
  // Error Handling
  // ==========================================

  describe('Error Handling', () => {
    it('should handle GraphQL network errors', async () => {
      vi.spyOn(graphqlClient, 'request').mockRejectedValue(new Error('Network error'));

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Error:');
      expect(text).toContain('Network error');
    });

    it('should handle GraphQL response errors', async () => {
      vi.spyOn(graphqlClient, 'request').mockRejectedValue({
        response: {
          errors: [{ message: 'GraphQL error' }],
        },
      });

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toMatch(/Error/i);
    });
  });

  // ==========================================
  // Output Format
  // ==========================================

  describe('Output Format', () => {
    it('should return properly formatted markdown output', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apy: 7,
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Test Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Check markdown structure
      expect(text).toContain('## Yield Prediction:');
      expect(text).toContain('### Current Performance');
      expect(text).toContain('### Projected Returns');
      expect(text).toContain('### Key Insights');
      expect(text).toContain('### Methodology');

      // Check table format
      expect(text).toContain('| Timeframe | Expected Return | Range (Min-Max) |');
      expect(text).toMatch(/\| \*\*7d\*\*/);
      expect(text).toMatch(/\| \*\*30d\*\*/);
      expect(text).toMatch(/\| \*\*90d\*\*/);
      expect(text).toMatch(/\| \*\*1y\*\*/);
    });

    it('should include methodology explanation', async () => {
      const now = Math.floor(Date.now() / 1000);

      const performanceData = [{ timestamp: now, apy: 7, tvl: 1000000 }];

      const mockData = {
        vault: createMockVault(),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '7d',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should explain methodology
      expect(text).toContain('Linear Regression');
      expect(text).toContain('Exponential Moving Averages');
      expect(text).toContain('Volatility Analysis');
      expect(text).toContain('Historical Data');
    });
  });
});
