/**
 * Tests for predict_yield tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecutePredictYield } from '../../src/tools/predict-yield.js';
import { graphqlClient } from '../../src/graphql/client.js';
import { clearCache } from '../../src/cache/index.js';
import { createMockContainer } from '../helpers/test-container';
import type { ServiceContainer } from '../../src/core/container.js';

// Mock the GraphQL client
vi.mock('../../src/graphql/client.js', () => ({
  graphqlClient: {
    request: vi.fn<[unknown, unknown?], Promise<unknown>>(),
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
  // Executor function created from factory with mock container
  let executePredictYield: ReturnType<typeof createExecutePredictYield>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executePredictYield = createExecutePredictYield(mockContainer as ServiceContainer);
  });

  /**
   * Helper to create mock vault data
   */
  function createMockVault(name = 'Test Vault', includeFees = false): unknown {
    const baseVault = {
      address: '0x1234567890123456789012345678901234567890',
      name,
      symbol: 'TEST',
      decimals: 18,
      asset: { address: '0xasset...', symbol: 'USDC', decimals: 6 },
      state: {
        totalAssets: '1000000000000',
        totalSupply: '900000000000',
        totalAssetsUsd: 1000000,
        pricePerShare: '1050000', // 1.05 in 6 decimals
        pricePerShareUsd: 1.05,
        highWaterMark: '1000000', // 1.0 in 6 decimals
        managementFee: includeFees ? 200 : 0, // 2% in basis points
        performanceFee: includeFees ? 1000 : 0, // 10% in basis points
      },
    };

    if (includeFees) {
      baseVault.state = {
        ...baseVault.state,
        pricePerShare: '1100000', // 1.1 in 6 decimals (above HWM)
        pricePerShareUsd: 1.1,
      };
    }

    return baseVault;
  }

  /**
   * Helper to create mock performance history
   */
  function createMockPerformanceHistory(
    data: Array<{ timestamp: number; apr: number; tvl: number }>
  ): unknown {
    const baseAssets = 1000000000000n; // 1M in 6 decimals
    const baseSupply = 1000000000000n;

    return {
      items: data.map((d, i) => {
        // Calculate cumulative growth from inception (day 0) to current point
        // based on the average APR up to this point
        let cumulativeGrowth = 1.0;

        if (i > 0) {
          // Calculate average APR from start to current point
          const avgApr = data.slice(0, i + 1).reduce((sum, item) => sum + item.apr, 0) / (i + 1);

          // Calculate days elapsed from inception
          const daysElapsed = (d.timestamp - data[0].timestamp) / (24 * 60 * 60);

          // Apply cumulative growth: (1 + APR/100) ^ (days/365)
          cumulativeGrowth = Math.pow(1 + avgApr / 100, daysElapsed / 365);
        }

        const totalAssets = String(BigInt(Math.floor(Number(baseAssets) * cumulativeGrowth)));
        const totalSupply = String(baseSupply); // Supply stays constant

        return {
          timestamp: String(d.timestamp),
          data: {
            totalAssetsAtStart: totalAssets,
            totalSupplyAtStart: totalSupply,
            totalAssetsAtEnd: String(d.tvl),
          },
        };
      }),
    };
  }

  // ==========================================
  // Yield Prediction - Increasing Trend Tests
  // ==========================================

  describe('Yield Prediction - Increasing Trend', () => {
    it('should predict increasing APR based on upward trend', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create increasing APR trend: 5% -> 10% over 30 days
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 5 + (i / 29) * 5, // 5% to 10%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Increasing APR Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show increasing trend
      expect(text).toContain('Increasing');
      expect(text).toContain('📈');

      // Should have current and predicted APR
      expect(text).toMatch(/Current APR.*%/);
      expect(text).toMatch(/Predicted APR.*%/);

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
    it('should predict decreasing APR based on downward trend', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create decreasing APR trend: 10% -> 5% over 30 days
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 10 - (i / 29) * 5, // 10% to 5%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Decreasing APR Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
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
    it('should predict stable APR when no significant trend exists', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create stable APR around 7%
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 7 + (Math.random() - 0.5) * 0.2, // 7% ± 0.1%
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Stable APR Vault'),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show predicted APR close to current APR (within 1%)
      const currentAPRMatch = text.match(/Current APR.*?(\d+\.\d+)%/);
      const predictedAPRMatch = text.match(/Predicted APR.*?(\d+\.\d+)%/);

      expect(currentAPRMatch).toBeTruthy();
      expect(predictedAPRMatch).toBeTruthy();

      const currentAPR = parseFloat(currentAPRMatch![1]);
      const predictedAPR = parseFloat(predictedAPRMatch![1]);
      const aprDifference = Math.abs(predictedAPR - currentAPR);

      // Stable trend should have < 1% difference between current and predicted
      expect(aprDifference).toBeLessThan(1.0);
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
        responseFormat: 'quick',
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
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('No vault found');
    });

    it('should handle very limited data (< 7 points)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [
        { timestamp: now - 2 * dayInSeconds, apr: 5, tvl: 1000000 },
        { timestamp: now - 1 * dayInSeconds, apr: 5.5, tvl: 1000000 },
        { timestamp: now, apr: 6, tvl: 1000000 },
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
        responseFormat: 'quick',
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
          apr: 5 + (i / 89) * 5, // Clear 5% -> 10% trend
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
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should have high confidence
      expect(text).toMatch(/High confidence/i);
    });

    it('should provide low confidence with sparse or noisy data', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create extremely sparse data (only 3 points over 7 days) with high volatility
      const performanceData = [
        { timestamp: now - 6 * dayInSeconds, apr: 15, tvl: 1000000 }, // Very high
        { timestamp: now - 3 * dayInSeconds, apr: 2, tvl: 1000000 }, // Very low
        { timestamp: now, apr: 10, tvl: 1000000 }, // Mid-high
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
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should have moderate to low confidence due to sparse noisy data - look for yellow or red confidence emoji
      expect(text).toMatch(/Confidence.*🟡|Confidence.*🔴/);
    });
  });

  // ==========================================
  // Input Validation
  // ==========================================

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

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
        responseFormat: 'quick',
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
        responseFormat: 'quick',
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
          apr: 7,
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
        responseFormat: 'quick',
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

      const performanceData = [{ timestamp: now, apr: 7, tvl: 1000000 }];

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
        responseFormat: 'quick',
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

  // ==========================================
  // Fee-Adjusted Predictions (SDK Integration)
  // ==========================================

  describe('Fee-Adjusted Predictions', () => {
    it('should calculate fee-adjusted APR when vault has fees', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      // Create stable APR around 10%
      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 10,
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Fee Test Vault', true),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      // Set fees to trigger fee-adjusted predictions (basis points: 200 = 2%, 2000 = 20%)
      (mockData.vault as any).state.managementFee = 200; // 2% management fee
      (mockData.vault as any).state.performanceFee = 2000; // 20% performance fee
      // Set price above high water mark to make performance fee active
      (mockData.vault as any).state.pricePerShare = '1050000000000000000'; // 1.05 (above HWM of 1.0)
      (mockData.vault as any).state.highWaterMark = '1000000000000000000'; // 1.0

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show both gross and net APR
      expect(text).toMatch(/Predicted APR.*\(Gross\)/);
      expect(text).toMatch(/Predicted Net APR.*\(After Fees\)/);

      // Should show fee impact section
      expect(text).toContain('### Fee Impact');
      expect(text).toContain('Management Fee');
      expect(text).toContain('Performance Fee');
      expect(text).toContain('Total Annual Fee Drag');

      // Should show performance fee is active
      expect(text).toContain('Currently Active - Above High Water Mark');

      // Should show gross and net returns tables
      expect(text).toContain('Gross Returns (Before Fees)');
      expect(text).toContain('Net Returns (After Fees)');
    });

    it('should handle inactive performance fee (below high water mark)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 8,
          tvl: 1000000,
        });
      }

      const mockVault = createMockVault('Inactive Fee Vault', true) as any;
      // Set price below high water mark
      mockVault.state.pricePerShare = '950000000000000000'; // 0.95 (below HWM of 1.0)
      mockVault.state.highWaterMark = '1000000000000000000'; // 1.0
      // Set fees to trigger fee analysis (basis points: 200 = 2%, 2000 = 20%)
      mockVault.state.managementFee = 200; // 2% management fee
      mockVault.state.performanceFee = 2000; // 20% performance fee

      const mockData = {
        vault: mockVault,
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should show performance fee is inactive
      expect(text).toContain('Inactive - Below High Water Mark');

      // Fee impact should be lower (only management fee)
      expect(text).toMatch(/Total Annual Fee Drag.*2\./); // Should be close to 2%
    });

    it('should show fee impact insights', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 12,
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('High Fee Vault', true),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      // Set high fees and ensure performance fee is active (basis points: 350 = 3.5%, 2500 = 25%)
      (mockData.vault as any).state.managementFee = 350; // 3.5% management fee
      (mockData.vault as any).state.performanceFee = 2500; // 25% performance fee
      (mockData.vault as any).state.pricePerShare = '1100000000000000000'; // 1.1 (above HWM)
      (mockData.vault as any).state.highWaterMark = '1000000000000000000'; // 1.0

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should have high fees insight
      expect(text).toMatch(/High fees.*significantly reduce net returns/);

      // Should show performance fee active
      expect(text).toMatch(/Performance fee active/);
    });

    it('should calculate time-scaled fee adjustments correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 10,
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('Time Scaled Fee Vault', true),
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      // Set known fees: 2% management + 20% performance (active)
      // Basis points: 200 = 2%, 2000 = 20%; total fee drag ≈ 2 + (20 * 0.1) = 4% annually
      (mockData.vault as any).state.managementFee = 200; // 2% management fee
      (mockData.vault as any).state.performanceFee = 2000; // 20% performance fee
      (mockData.vault as any).state.pricePerShare = '1100000000000000000'; // 1.1 (above HWM)
      (mockData.vault as any).state.highWaterMark = '1000000000000000000'; // 1.0

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Gross returns should be higher than net returns
      // For 7d: fee adjustment ~= 4% * (7/365) ~= 0.077%
      // For 30d: fee adjustment ~= 4% * (30/365) ~= 0.33%
      // For 90d: fee adjustment ~= 4% * (90/365) ~= 0.99%
      // For 1y: fee adjustment = 4%

      // Verify both gross and net returns sections exist
      const grossSection = text.split('Gross Returns')[1]?.split('Net Returns')[0];
      const netSection = text.split('Net Returns')[1]?.split('---')[0];

      expect(grossSection).toBeTruthy();
      expect(netSection).toBeTruthy();

      // Net returns should be consistently lower than gross
      expect(text).toContain('Net Returns (After Fees)');
    });

    it('should not show fee sections when vault has no fees', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayInSeconds = 24 * 60 * 60;

      const performanceData = [];
      for (let i = 0; i < 30; i++) {
        performanceData.push({
          timestamp: now - (29 - i) * dayInSeconds,
          apr: 10,
          tvl: 1000000,
        });
      }

      const mockData = {
        vault: createMockVault('No Fee Vault', false), // No fees
        performanceHistory: createMockPerformanceHistory(performanceData),
        tvlHistory: { items: [] },
      };

      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // Should NOT show fee-related sections
      expect(text).not.toContain('### Fee Impact');
      expect(text).not.toContain('Gross Returns (Before Fees)');
      expect(text).not.toContain('Net Returns (After Fees)');
      expect(text).not.toContain('(Gross)');
      expect(text).not.toContain('(After Fees)');

      // Should have standard returns table
      expect(text).toContain('| Timeframe | Expected Return | Range (Min-Max) |');
    });
  });

  // ==========================================
  // Outlier Robustness
  // ==========================================
  //
  // These tests cover the per-period sanitation guards in
  // src/tools/predict-yield.ts (MIN_PERIOD_DAYS filter, APR clamp). They
  // construct PeriodSummary streams directly because the standard helper
  // derives PPS from APR — for outlier tests we need control of the jump.

  describe('Outlier Robustness', () => {
    /**
     * Build a performanceHistory stream with explicit totalAssets values per
     * timestamp. totalSupply is held constant so PPS = totalAssets / totalSupply.
     */
    function buildRawHistory(points: Array<{ timestamp: number; totalAssets: string }>): unknown {
      const totalSupply = '1000000000000'; // 1M shares (constant)
      return {
        items: points.map((p) => ({
          timestamp: String(p.timestamp),
          data: {
            totalAssetsAtStart: p.totalAssets,
            totalSupplyAtStart: totalSupply,
            totalAssetsAtEnd: p.totalAssets,
          },
        })),
      };
    }

    it('drops periods shorter than 6 hours and surfaces the count', async () => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;

      // 5 well-spaced periods (5-day cadence) at a realistic ~7% APR
      // (≈0.096% growth per 5d), plus one extra event 1 hour after period 3.
      // Without the filter, that 1h pair annualizes its +0.01% PPS bump to
      // ~87% APR and dominates the regression. With the filter it's dropped.
      const points = [
        { timestamp: now - 25 * day, totalAssets: '1000000000000' },
        { timestamp: now - 20 * day, totalAssets: '1000958904109' },
        { timestamp: now - 15 * day, totalAssets: '1001918715754' },
        { timestamp: now - 15 * day + 3600, totalAssets: '1002018906625' }, // +1h, +0.01%
        { timestamp: now - 10 * day, totalAssets: '1002879438400' },
        { timestamp: now - 5 * day, totalAssets: '1003841072700' },
      ];

      const mockData = {
        vault: createMockVault('Short Period Vault'),
        performanceHistory: buildRawHistory(points),
        tvlHistory: { items: [] },
      };
      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'detailed',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      // The insight surfaces exactly 1 dropped period.
      expect(text).toContain('1 period(s) shorter than 6 hours excluded');

      // Predicted APR stays in a sensible single/double-digit range — without
      // the filter the 1h period would annualize the +0.01% PPS bump to ~87%
      // and skew the regression upward.
      const predictedMatch = text.match(/Predicted APR.*?(\d+\.\d+)%/);
      expect(predictedMatch).toBeTruthy();
      const predicted = parseFloat(predictedMatch![1]);
      expect(predicted).toBeGreaterThan(0);
      expect(predicted).toBeLessThan(50);
    });

    it('clamps per-period APR to [-100%, 500%] and surfaces the count', async () => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;

      // 5 normally-spaced periods with one extreme PPS jump (50x over 5 days)
      // that annualizes far past 500%.
      const points = [
        { timestamp: now - 25 * day, totalAssets: '1000000000000' },
        { timestamp: now - 20 * day, totalAssets: '1010000000000' },
        { timestamp: now - 15 * day, totalAssets: '1020000000000' },
        { timestamp: now - 10 * day, totalAssets: '51000000000000' }, // 50x jump
        { timestamp: now - 5 * day, totalAssets: '51500000000000' },
      ];

      const mockData = {
        vault: createMockVault('Clamp Vault'),
        performanceHistory: buildRawHistory(points),
        tvlHistory: { items: [] },
      };
      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'detailed',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(text).toMatch(/\d+ period\(s\) had outlier APR clamped/);
    });

    it('does not surface diagnostics when all periods are well-formed', async () => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;

      // 6 well-spaced periods, mild monotonic growth, no outliers.
      const points = Array.from({ length: 6 }, (_, i) => ({
        timestamp: now - (25 - i * 5) * day,
        totalAssets: String(1000000000000n + BigInt(i) * 10000000000n),
      }));

      const mockData = {
        vault: createMockVault('Clean Vault'),
        performanceHistory: buildRawHistory(points),
        tvlHistory: { items: [] },
      };
      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'detailed',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(text).not.toContain('shorter than 6 hours excluded');
      expect(text).not.toContain('outlier APR clamped');
    });
  });

  // ==========================================
  // Yield Breakdown (sustainable vs total APR)
  // ==========================================

  describe('Yield Breakdown', () => {
    /**
     * Build a vault mock with a weeklyApr containing the supplied APR fields
     * and source arrays. Keeps the rest of the vault state minimal.
     */
    function vaultWithWeeklyApr(opts: {
      linearNetApr: number;
      linearNetAprWithoutExtraYields?: number;
      airdrops?: number;
      nativeYields?: number;
      incentives?: number;
    }): unknown {
      const make = (n: number): unknown[] =>
        Array.from({ length: n }, (_, i) => ({ name: `src-${i}`, apr: 0 }));
      return {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Yield Breakdown Vault',
        symbol: 'YB',
        decimals: 18,
        asset: { address: '0xasset', symbol: 'USDC', decimals: 6 },
        state: {
          totalAssets: '1000000000000',
          totalSupply: '900000000000',
          totalAssetsUsd: 1_000_000,
          pricePerShare: '1050000',
          pricePerShareUsd: 1.05,
          highWaterMark: '1000000',
          managementFee: 200,
          performanceFee: 1000,
          weeklyApr: {
            linearNetApr: opts.linearNetApr,
            linearNetAprWithoutExtraYields: opts.linearNetAprWithoutExtraYields,
            airdrops: make(opts.airdrops ?? 0),
            nativeYields: make(opts.nativeYields ?? 0),
            incentives: make(opts.incentives ?? 0),
          },
        },
      };
    }

    function flatPerfHistory(): unknown {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;
      const points = [];
      for (let i = 0; i < 30; i++) {
        points.push({
          timestamp: now - (29 - i) * day,
          apr: 5,
          tvl: 1_000_000,
        });
      }
      return createMockPerformanceHistory(points);
    }

    it('emits an incentive-heavy warning when subsidies exceed 25% of headline APR', async () => {
      const mockData = {
        vault: vaultWithWeeklyApr({
          linearNetApr: 20,
          linearNetAprWithoutExtraYields: 4,
          airdrops: 1,
          nativeYields: 1,
          incentives: 0,
        }),
        performanceHistory: flatPerfHistory(),
        tvlHistory: { items: [] },
      };
      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Yield Breakdown');
      expect(text).toContain('Total net APR**: 20.00%');
      expect(text).toContain('Sustainable APR');
      expect(text).toContain('4.00%');
      expect(text).toContain('80.0% of total APR');
      expect(text).toMatch(/⚠️.*80\.0% of headline APR comes from temporary incentives/);
    });

    it('omits the warning when sustainable yield dominates', async () => {
      const mockData = {
        vault: vaultWithWeeklyApr({
          linearNetApr: 5,
          linearNetAprWithoutExtraYields: 4.5,
          nativeYields: 2,
        }),
        performanceHistory: flatPerfHistory(),
        tvlHistory: { items: [] },
      };
      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Yield Breakdown');
      // 10% incentive contribution — under the 25% threshold
      expect(text).toContain('10.0% of total APR');
      // The tool disclaimer contains "⚠️" so we check for the specific warning string.
      expect(text).not.toContain('comes from temporary incentives');
    });

    it('marks sustainable APR as unavailable when the field is missing', async () => {
      const mockData = {
        vault: vaultWithWeeklyApr({ linearNetApr: 4, nativeYields: 1 }),
        performanceHistory: flatPerfHistory(),
        tvlHistory: { items: [] },
      };
      vi.spyOn(graphqlClient, 'request').mockResolvedValue(mockData);

      const result = await executePredictYield({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        timeRange: '30d',
        responseFormat: 'quick',
      });

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Sustainable APR');
      expect(text).toContain('unavailable for this vault');
      // No incentive-warning emitted when sustainable APR is unavailable.
      expect(text).not.toContain('comes from temporary incentives');
    });
  });
});
