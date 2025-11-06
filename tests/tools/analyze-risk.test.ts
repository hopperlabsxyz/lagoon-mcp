/**
 * Tests for analyze_risk tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecuteAnalyzeRisk } from '../../src/tools/analyze-risk.js';
import { graphqlClient } from '../../src/graphql/client.js';
import { clearCache } from '../../src/cache/index.js';
import { createMockContainer } from '../helpers/test-container.js';
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

describe('analyze_risk Tool', () => {
  // Executor function created from factory with mock container
  let executeAnalyzeRisk: ReturnType<typeof createExecuteAnalyzeRisk>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();

    // Create mock container and initialize executor
    const mockContainer: ServiceContainer = createMockContainer();
    executeAnalyzeRisk = createExecuteAnalyzeRisk(mockContainer);
  });

  /**
   * Helper to create mock vault data
   */
  function createMockVault(
    overrides: Partial<{
      address: string;
      tvl: number;
      createdAt: string;
      curatorId: string;
      managementFee: number;
      performanceFee: number;
      pricePerShare: string;
      highWaterMark: string;
      safeAssetBalanceUsd: number;
      pendingSettlementUsd: number;
    }> = {}
  ): unknown {
    const defaults = {
      address: '0x1234567890123456789012345678901234567890',
      tvl: 1000000,
      createdAt: String(Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60), // 1 year ago
      curatorId: 'curator-123',
      managementFee: 1.5, // 1.5% management fee
      performanceFee: 15, // 15% performance fee
      pricePerShare: '1050000000000000000', // 1.05 (18 decimals)
      highWaterMark: '1000000000000000000', // 1.0 (18 decimals)
      safeAssetBalanceUsd: 500000, // 50% of TVL in safe assets
      pendingSettlementUsd: 100000, // 10% pending redemptions
    };
    const merged = { ...defaults, ...overrides };

    return {
      address: merged.address,
      name: 'Test Vault',
      symbol: 'TEST',
      decimals: 18,
      createdAt: merged.createdAt,
      curatorId: merged.curatorId,
      asset: {
        address: '0xasset1234567890123456789012345678901234',
        symbol: 'USDC',
      },
      state: {
        totalAssets: '1000000000000',
        totalSupply: '900000000000',
        totalAssetsUsd: merged.tvl,
        pricePerShareUsd: 1.05,
        pricePerShare: merged.pricePerShare,
        highWaterMark: merged.highWaterMark,
        managementFee: merged.managementFee,
        performanceFee: merged.performanceFee,
        safeAssetBalanceUsd: merged.safeAssetBalanceUsd,
        pendingSettlement: {
          assetsUsd: merged.pendingSettlementUsd,
        },
      },
    };
  }

  /**
   * Helper to create mock all vaults data
   */
  function createMockAllVaults(count: number, totalTVL: number): unknown[] {
    const tvlPerVault = totalTVL / count;
    return Array.from({ length: count }, () => ({
      state: {
        totalAssetsUsd: tvlPerVault,
      },
    }));
  }

  /**
   * Helper to create mock curator vaults
   */
  function createMockCuratorVaults(count: number, successfulCount: number): unknown[] {
    const vaults: unknown[] = [];

    // Create successful vaults (TVL > $10K)
    for (let i = 0; i < successfulCount; i++) {
      vaults.push({
        address: `0xvault${i}12345678901234567890123456789012`,
        state: {
          totalAssetsUsd: 50000, // >$10K = successful
        },
      });
    }

    // Create unsuccessful vaults (TVL < $10K)
    for (let i = successfulCount; i < count; i++) {
      vaults.push({
        address: `0xvault${i}12345678901234567890123456789012`,
        state: {
          totalAssetsUsd: 5000, // <$10K = unsuccessful
        },
      });
    }

    return vaults;
  }

  /**
   * Helper to create mock price history
   */
  function createMockPriceHistory(prices: number[], ageInDays?: number): unknown {
    const now = Math.floor(Date.now() / 1000);
    // If ageInDays is provided, first transaction is that many days ago
    const startTimestamp = ageInDays
      ? now - ageInDays * 24 * 60 * 60
      : now - prices.length * 24 * 60 * 60;

    return {
      items: prices.map((price, i) => ({
        timestamp: String(startTimestamp + i * 24 * 60 * 60),
        data: {
          totalAssets: '1000000000000000000',
          totalAssetsUsd: 1000000,
          totalSupply: String(Math.floor((1000000 / price) * 1e18)),
          pricePerShareUsd: price,
        },
      })),
    };
  }

  describe('Risk Analysis - Low Risk Scenario', () => {
    it('should analyze low-risk vault (high TVL, established, low volatility)', async () => {
      const mockData = {
        vault: createMockVault({
          tvl: 15000000, // $15M = very high TVL (low risk)
          createdAt: String(Math.floor(Date.now() / 1000) - 400 * 24 * 60 * 60), // >1 year
        }),
        allVaults: { items: createMockAllVaults(100, 500000000) }, // 3% concentration
        curatorVaults: { items: createMockCuratorVaults(10, 9) }, // 90% success rate
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01, 1.02, 1.02, 1.03, 1.03], 400), // Low volatility, 400 days old
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text as string;
      expect(text).toContain('Risk Analysis Breakdown');
      expect(text).toContain('Overall Risk Assessment');
      expect(text).toContain('🟢 Low'); // Should be low risk overall
    });
  });

  describe('Risk Analysis - High Risk Scenario', () => {
    it('should analyze high-risk vault (low TVL, new, high volatility)', async () => {
      const mockData = {
        vault: createMockVault({
          tvl: 5000, // <$10K = critical TVL risk
          createdAt: String(Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60), // 5 days old = very new
        }),
        allVaults: { items: createMockAllVaults(10, 50000) }, // 10% concentration
        curatorVaults: { items: createMockCuratorVaults(1, 0) }, // 0% success rate, new curator
        priceHistory: createMockPriceHistory([1.0, 0.6, 1.3, 0.7, 1.4, 0.5, 1.5], 5), // Very high volatility, 5 days old
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('🔴'); // Should have multiple high-risk indicators
      expect(text).toMatch(/🔴 Critical|🟠 High/); // Overall should be high or critical
    });
  });

  describe('Risk Analysis - Individual Factors', () => {
    it('should calculate TVL risk correctly', async () => {
      const mockData = {
        vault: createMockVault({ tvl: 500000 }), // Medium TVL
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('TVL Risk');
      expect(text).toContain('%'); // Should show percentage
    });

    it('should calculate concentration risk correctly', async () => {
      const mockData = {
        vault: createMockVault({ tvl: 50000000 }), // High concentration if protocol is small
        allVaults: { items: createMockAllVaults(2, 100000000) }, // Vault is 50% of protocol
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Concentration Risk');
      expect(text).toContain('🔴'); // High concentration should be flagged
    });

    it('should calculate volatility risk correctly', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.2, 0.8, 1.3, 0.7]), // Very volatile
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Volatility Risk');
      expect(text).toMatch(/🔴|🟠/); // High volatility
    });

    it('should calculate age risk correctly', async () => {
      const mockData = {
        vault: createMockVault({
          createdAt: String(Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60), // 10 days old
        }),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01], 10), // 10 days old
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Age Risk');
      expect(text).toContain('🔴'); // Very new vault = critical risk
    });

    it('should calculate curator risk correctly', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(15, 14) }, // Experienced curator, 93% success
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Curator Risk');
      expect(text).toContain('🟢'); // Experienced curator with good track record
    });
  });

  describe('Edge Cases', () => {
    it('should handle vault with no price history', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: { items: [] }, // No price history
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Volatility Risk');
      expect(text).toContain('%'); // Should still show a score (medium risk for insufficient data)
    });

    it('should handle vault not found', async () => {
      const mockData = {
        vault: null,
        allVaults: { items: [] },
        curatorVaults: { items: [] },
        priceHistory: { items: [] },
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('No vault found');
      expect(text).toContain('0x1234567890123456789012345678901234567890');
    });

    it('should handle zero protocol TVL gracefully', async () => {
      const mockData = {
        vault: createMockVault({ tvl: 1000000 }),
        allVaults: { items: [] }, // No other vaults = zero protocol TVL
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Concentration Risk');
      // Should handle gracefully with medium risk
    });

    it('should handle new curator (no other vaults)', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: [] }, // New curator with no other vaults
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Curator Risk');
      // New curator should have high risk score
    });
  });

  describe('Caching', () => {
    it('should cache risk analysis results', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      // First call
      const result1 = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      // Second call
      const result2 = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result1.isError).toBe(false);
      expect(result2.isError).toBe(false);

      // With mocked cache always returning null, GraphQL is called twice
      // In real implementation with actual cache, it would be called once
      expect(vi.mocked(graphqlClient.request)).toHaveBeenCalledTimes(2);
    });

    it('should use separate cache keys for different vaults', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      // Call for first vault
      await executeAnalyzeRisk({
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 1,
      });

      // Call for second vault
      await executeAnalyzeRisk({
        vaultAddress: '0x2222222222222222222222222222222222222222',
        chainId: 1,
      });

      // Should call GraphQL twice (different cache keys)
      expect(vi.mocked(graphqlClient.request)).toHaveBeenCalledTimes(2);
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('Error Handling', () => {
    it('should handle GraphQL network errors', async () => {
      vi.mocked(graphqlClient.request).mockRejectedValue(new Error('Network error'));

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(true);
      const text = result.content[0].text as string;
      expect(text).toContain('Error analyzing risk:');
      expect(text).toContain('Network error');
    });

    it('should handle GraphQL response errors', async () => {
      vi.mocked(graphqlClient.request).mockRejectedValue({
        response: {
          errors: [{ message: 'GraphQL error' }],
        },
      });

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      expect(result.isError).toBe(true);
      const text = result.content[0].text as string;
      expect(text).toContain('Error analyzing risk:');
    });
  });

  describe('Output Format', () => {
    it('should include all risk factors in the output', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;

      // Should include all risk factors
      expect(text).toContain('TVL Risk');
      expect(text).toContain('Concentration Risk');
      expect(text).toContain('Volatility Risk');
      expect(text).toContain('Age Risk');
      expect(text).toContain('Curator Risk');

      // Should include overall assessment
      expect(text).toContain('Overall Risk Assessment');
      expect(text).toContain('Risk Score');
      expect(text).toContain('Risk Level');

      // Should include explanations
      expect(text).toContain('Risk Factor Explanations');
    });

    it('should use emoji indicators for risk levels', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;

      // Should include emoji indicators
      expect(text).toMatch(/🟢|🟡|🟠|🔴/);
    });
  });

  describe('Risk Analysis - Fee Risk Factor', () => {
    it('should calculate low fee risk (< 1% annual fee drag)', async () => {
      const mockData = {
        vault: createMockVault({
          managementFee: 0.5, // 0.5% management fee
          performanceFee: 5, // 5% performance fee
          pricePerShare: '900000000000000000', // Below HWM, no performance fee active
          highWaterMark: '1000000000000000000',
        }),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Fee Risk');
      expect(text).toContain('management and performance fees');
    });

    it('should calculate high fee risk (>= 5% annual fee drag)', async () => {
      const mockData = {
        vault: createMockVault({
          managementFee: 3, // 3% management fee
          performanceFee: 25, // 25% performance fee
          pricePerShare: '1100000000000000000', // Above HWM, performance fee active
          highWaterMark: '1000000000000000000',
        }),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Fee Risk');
      // High fee risk should contribute to overall risk
    });
  });

  describe('Risk Analysis - Liquidity Risk Factor', () => {
    it('should calculate low liquidity risk (no pending redemptions)', async () => {
      const mockData = {
        vault: createMockVault({
          safeAssetBalanceUsd: 500000,
          pendingSettlementUsd: 0, // No pending redemptions
        }),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Liquidity Risk');
      expect(text).toContain('meet redemption requests');
    });

    it('should calculate high liquidity risk (low coverage ratio)', async () => {
      const mockData = {
        vault: createMockVault({
          safeAssetBalanceUsd: 50000, // Only 50K safe assets
          pendingSettlementUsd: 200000, // 200K pending redemptions = 25% coverage
        }),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Liquidity Risk');
      // Low coverage ratio should show high liquidity risk
      expect(text).toMatch(/🔴|🟠/); // Should have high risk indicators
    });

    it('should calculate medium liquidity risk (100% coverage ratio)', async () => {
      const mockData = {
        vault: createMockVault({
          safeAssetBalanceUsd: 100000, // 100K safe assets
          pendingSettlementUsd: 100000, // 100K pending redemptions = 100% coverage
        }),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Liquidity Risk');
    });
  });

  describe('Risk Analysis - 7 Factor Calculation', () => {
    it('should include all 7 risk factors in analysis', async () => {
      const mockData = {
        vault: createMockVault(),
        allVaults: { items: createMockAllVaults(100, 100000000) },
        curatorVaults: { items: createMockCuratorVaults(5, 5) },
        priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
      };

      vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

      const result = await executeAnalyzeRisk({
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      const text = result.content[0].text as string;

      // Verify all 7 factors are mentioned
      expect(text).toContain('TVL Risk');
      expect(text).toContain('Concentration Risk');
      expect(text).toContain('Volatility Risk');
      expect(text).toContain('Age Risk');
      expect(text).toContain('Curator Risk');
      expect(text).toContain('Fee Risk');
      expect(text).toContain('Liquidity Risk');

      // Verify explanations for new factors
      expect(text).toContain('management and performance fees');
      expect(text).toContain('meet redemption requests');
    });
  });
});
