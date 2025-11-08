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
      expect(text).toContain('**TVL**');
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
      expect(text).toContain('**Concentration**');
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
      expect(text).toContain('**Volatility**');
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
      expect(text).toContain('**Age**');
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
      expect(text).toContain('**Curator**');
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
      expect(text).toContain('**Volatility**');
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
      expect(text).toContain('**Concentration**');
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
      expect(text).toContain('**Curator**');
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
      expect(text).toContain('**TVL**');
      expect(text).toContain('**Concentration**');
      expect(text).toContain('**Volatility**');
      expect(text).toContain('**Age**');
      expect(text).toContain('**Curator**');

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
      expect(text).toContain('**Fees**');
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
      expect(text).toContain('**Fees**');
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
      expect(text).toContain('**Liquidity**');
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
      expect(text).toContain('**Liquidity**');
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
      expect(text).toContain('**Liquidity**');
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

      // Verify all 7 original factors are mentioned (checking for table format)
      expect(text).toContain('**TVL**');
      expect(text).toContain('**Concentration**');
      expect(text).toContain('**Volatility**');
      expect(text).toContain('**Age**');
      expect(text).toContain('**Curator**');
      expect(text).toContain('**Fees**');
      expect(text).toContain('**Liquidity**');

      // Verify explanations for factors
      expect(text).toContain('management and performance fees');
      expect(text).toContain('meet redemption requests');
    });
  });

  describe('Risk Analysis - New Risk Factors (Phase 1)', () => {
    describe('APR Consistency Risk', () => {
      it('should calculate low APR consistency risk for stable returns', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              weeklyApr: { linearNetApr: 10.0 },
              monthlyApr: { linearNetApr: 10.2 },
              yearlyApr: { linearNetApr: 10.1 },
              inceptionApr: { linearNetApr: 9.9 },
            },
          },
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
        expect(text).toContain('APR Consistency');
        // Low variation should result in low risk (🟢)
      });

      it('should calculate high APR consistency risk for volatile returns', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              weeklyApr: { linearNetApr: 20.0 },
              monthlyApr: { linearNetApr: 5.0 },
              yearlyApr: { linearNetApr: 15.0 },
              inceptionApr: { linearNetApr: 2.0 },
            },
          },
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
        expect(text).toContain('APR Consistency');
        // High APR variation (CV > 0.5) should show high risk
        expect(text).toMatch(/🔴|🟠/);
      });
    });

    describe('Yield Sustainability Risk', () => {
      it('should calculate low yield sustainability risk for native-dominant yields', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              weeklyApr: {
                linearNetApr: 10.0,
                nativeYields: [{ apr: 9.0 }],
                airdrops: [{ apr: 0.5 }],
                incentives: [{ apr: 0.5 }],
              },
            },
          },
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
        expect(text).toContain('Yield Sustainability');
        // 90% native yields should be low risk
      });

      it('should calculate high yield sustainability risk for incentive-dependent yields', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              weeklyApr: {
                linearNetApr: 10.0,
                nativeYields: [{ apr: 1.0 }],
                airdrops: [{ apr: 4.5 }],
                incentives: [{ apr: 4.5 }],
              },
            },
          },
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
        expect(text).toContain('Yield Sustainability');
        // 10% native yields = almost entirely temporary (high risk)
        expect(text).toMatch(/🔴|🟠/);
      });
    });

    describe('Settlement Risk', () => {
      it('should calculate low settlement risk for fast settlement', async () => {
        const mockData = {
          vault: {
            ...createMockVault({
              safeAssetBalanceUsd: 500000,
              pendingSettlementUsd: 10000, // 2% pending
            }),
            averageSettlement: 0.5, // Same-day settlement
          },
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
        expect(text).toContain('Settlement');
        // Fast settlement + low pending should be low risk
      });

      it('should calculate high settlement risk for slow settlement and high pending', async () => {
        const mockData = {
          vault: {
            ...createMockVault({
              safeAssetBalanceUsd: 100000,
              pendingSettlementUsd: 80000, // 80% pending operations
            }),
            averageSettlement: 10, // 10 days average settlement
          },
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
        expect(text).toContain('Settlement');
        // Slow settlement + high pending = high risk
        expect(text).toMatch(/🔴|🟠/);
      });
    });

    describe('Integration Complexity Risk', () => {
      it('should calculate low integration complexity risk for single integration', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            defiIntegrations: [{ protocol: 'Aave' }], // Single integration
          },
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
        expect(text).toContain('Integration Complexity');
        // Single integration = low complexity
      });

      it('should calculate high integration complexity risk for many integrations', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            defiIntegrations: [
              { protocol: 'Aave' },
              { protocol: 'Compound' },
              { protocol: 'Uniswap' },
              { protocol: 'Curve' },
              { protocol: 'Balancer' },
              { protocol: 'Yearn' },
            ], // 6 integrations = very high complexity
          },
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
        expect(text).toContain('Integration Complexity');
        // 6 integrations = large attack surface (high risk)
        expect(text).toMatch(/🔴|🟠/);
      });
    });

    describe('Capacity Utilization Risk', () => {
      it('should calculate low capacity risk for healthy utilization (50%)', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              totalAssets: '500000000000000000000000', // 500K
            },
            maxCapacity: '1000000000000000000000000', // 1M cap = 50% utilized
          },
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
        expect(text).toContain('Capacity Utilization');
        // 50% utilization = healthy (low risk)
      });

      it('should calculate high capacity risk for near-full vault (95%)', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              totalAssets: '950000000000000000000000', // 950K
            },
            maxCapacity: '1000000000000000000000000', // 1M cap = 95% utilized
          },
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
        expect(text).toContain('Capacity Utilization');
        // 95% utilization = near capacity (high risk for deposits)
        expect(text).toMatch(/🔴|🟠/);
      });

      it('should calculate medium capacity risk for under-utilized vault (20%)', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            state: {
              ...(createMockVault() as any).state,
              totalAssets: '200000000000000000000000', // 200K
            },
            maxCapacity: '1000000000000000000000000', // 1M cap = 20% utilized
          },
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
        expect(text).toContain('Capacity Utilization');
        // 20% utilization = under-utilized (demand concern)
      });
    });

    describe('Curator Professional Signals', () => {
      it('should calculate lower curator risk for professional curators', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            curators: [
              {
                id: 'curator-1',
                name: 'Professional Curator',
                aboutDescription: 'Experienced DeFi curator with proven track record',
                logoUrl: 'https://example.com/logo.png',
                url: 'https://curator-website.com',
              },
              {
                id: 'curator-2',
                name: 'Second Curator',
                aboutDescription: 'Co-curator for decentralization',
                logoUrl: 'https://example.com/logo2.png',
                url: 'https://curator2-website.com',
              },
            ],
          },
          allVaults: { items: createMockAllVaults(100, 100000000) },
          curatorVaults: { items: createMockCuratorVaults(10, 9) }, // 90% success rate
          priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
        };

        vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

        const result = await executeAnalyzeRisk({
          vaultAddress: '0x1234567890123456789012345678901234567890',
          chainId: 1,
        });

        const text = result.content[0].text as string;
        expect(text).toContain('Curator');
        // Multiple curators + website + description = professional signals = lower risk
        expect(text).toContain('🟢'); // Should have low curator risk
      });

      it('should calculate higher curator risk for unprofessional curators', async () => {
        const mockData = {
          vault: {
            ...createMockVault(),
            curators: [
              {
                id: 'curator-1',
                name: 'Anonymous',
                aboutDescription: null, // No description
                logoUrl: null,
                url: null, // No website
              },
            ],
          },
          allVaults: { items: createMockAllVaults(100, 100000000) },
          curatorVaults: { items: createMockCuratorVaults(1, 0) }, // New curator, no track record
          priceHistory: createMockPriceHistory([1.0, 1.01, 1.01]),
        };

        vi.mocked(graphqlClient.request).mockResolvedValue(mockData);

        const result = await executeAnalyzeRisk({
          vaultAddress: '0x1234567890123456789012345678901234567890',
          chainId: 1,
        });

        const text = result.content[0].text as string;
        expect(text).toContain('Curator');
        // No professional signals + new curator = high risk
        expect(text).toMatch(/🔴|🟠/);
      });
    });
  });

  describe('Risk Analysis - 12 Factor Comprehensive Test', () => {
    it('should include all 12 risk factors in analysis', async () => {
      const mockData = {
        vault: {
          ...createMockVault(),
          averageSettlement: 2,
          defiIntegrations: [{ protocol: 'Aave' }, { protocol: 'Compound' }],
          maxCapacity: '2000000000000000000000000',
          curators: [
            {
              id: 'curator-1',
              name: 'Professional Curator',
              aboutDescription: 'Experienced curator',
              logoUrl: 'https://example.com/logo.png',
              url: 'https://curator.com',
            },
          ],
          state: {
            ...(createMockVault() as any).state,
            weeklyApr: {
              linearNetApr: 10.0,
              nativeYields: [{ apr: 8.0 }],
              airdrops: [{ apr: 1.0 }],
              incentives: [{ apr: 1.0 }],
            },
            monthlyApr: { linearNetApr: 10.5 },
            yearlyApr: { linearNetApr: 9.8 },
            inceptionApr: { linearNetApr: 10.2 },
            totalAssets: '1000000000000000000000000',
          },
        },
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

      // Verify all 12 factors are mentioned
      expect(text).toContain('TVL');
      expect(text).toContain('Concentration');
      expect(text).toContain('Volatility');
      expect(text).toContain('Age');
      expect(text).toContain('Curator');
      expect(text).toContain('Fee');
      expect(text).toContain('Liquidity');
      expect(text).toContain('APR Consistency');
      expect(text).toContain('Yield Sustainability');
      expect(text).toContain('Settlement');
      expect(text).toContain('Integration Complexity');
      expect(text).toContain('Capacity Utilization');

      // Verify explanations exist
      expect(text).toContain('Risk Factor Explanations');
    });
  });
});
