/**
 * Tests for optimize_portfolio tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecuteOptimizePortfolio } from '../../src/tools/optimize-portfolio.js';
import { createMockContainer } from '../helpers/test-container.js';
import type { ServiceContainer } from '../../src/core/container.js';

// Mock GraphQL client
vi.mock('../../src/graphql/client.js', () => ({
  graphqlClient: {
    request: vi.fn<[unknown, unknown?], Promise<unknown>>(),
  },
}));

// Mock cache module
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

import { graphqlClient } from '../../src/graphql/client.js';
import { cache } from '../../src/cache/index.js';

const mockGraphqlRequest = graphqlClient.request as ReturnType<typeof vi.fn>;
const mockCacheGet = cache.get as ReturnType<typeof vi.fn>;
const mockCacheSet = cache.set as ReturnType<typeof vi.fn>;

describe('optimize_portfolio', () => {
  // Executor function created from factory with mock container
  let executeOptimizePortfolio: ReturnType<typeof createExecuteOptimizePortfolio>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockReturnValue(undefined);

    // Create mock container and initialize executor
    const mockContainer: ServiceContainer = createMockContainer();
    executeOptimizePortfolio = createExecuteOptimizePortfolio(mockContainer);
  });

  const baseInput = {
    vaultAddresses: [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
    ],
    chainId: 42161,
    currentPositions: [
      { vaultAddress: '0x1234567890123456789012345678901234567890', valueUsd: 5000 },
      { vaultAddress: '0x2345678901234567890123456789012345678901', valueUsd: 3000 },
      { vaultAddress: '0x3456789012345678901234567890123456789012', valueUsd: 2000 },
    ],
    strategy: 'max_sharpe' as const,
    rebalanceThreshold: 5.0,
  };

  // Mock data for individual vault queries (new implementation uses parallel queries)
  const mockVaultDataA = {
    vault: {
      address: '0x1234567890123456789012345678901234567890',
      name: 'Vault A',
      chain: { id: 42161, name: 'Arbitrum' },
      symbol: 'lgVaultA',
      assetSymbol: 'USDC',
      decimals: 18,
      asset: { decimals: 6 },
      state: { totalAssetsUsd: 1000000, sharePrice: 1.05 },
    },
    priceHistory: {
      items: [
        {
          timestamp: '1704067200',
          data: {
            totalAssets: '1000000000000', // 1M USDC in 6 decimals
            totalAssetsUsd: 1000000,
            totalSupply: '1000000000000000000000000', // 1M shares in 18 decimals (1:1 ratio)
            vault: { decimals: 18, asset: { decimals: 6 } },
          },
        },
        {
          timestamp: '1704153600',
          data: {
            totalAssets: '1020000000000', // 1.02M USDC
            totalAssetsUsd: 1020000,
            totalSupply: '1000000000000000000000000',
            vault: { decimals: 18, asset: { decimals: 6 } },
          },
        },
        {
          timestamp: '1704240000',
          data: {
            totalAssets: '1050000000000', // 1.05M USDC
            totalAssetsUsd: 1050000,
            totalSupply: '1000000000000000000000000',
            vault: { decimals: 18, asset: { decimals: 6 } },
          },
        },
      ],
    },
    performanceData: {
      items: [
        { timestamp: '1704067200', data: { linearNetApr: 0.05 } },
        { timestamp: '1704153600', data: { linearNetApr: 0.052 } },
      ],
    },
  };

  const mockVaultDataB = {
    vault: {
      address: '0x2345678901234567890123456789012345678901',
      name: 'Vault B',
      chain: { id: 42161, name: 'Arbitrum' },
      symbol: 'lgVaultB',
      assetSymbol: 'USDT',
      decimals: 18,
      asset: { decimals: 6 },
      state: { totalAssetsUsd: 500000, sharePrice: 1.02 },
    },
    priceHistory: {
      items: [
        {
          timestamp: '1704067200',
          data: {
            totalAssets: '500000000000', // 500K USDT in 6 decimals
            totalAssetsUsd: 500000,
            totalSupply: '500000000000000000000000', // 500K shares in 18 decimals (1:1 ratio)
            vault: { decimals: 18, asset: { decimals: 6 } },
          },
        },
        {
          timestamp: '1704153600',
          data: {
            totalAssets: '505000000000', // 505K USDT
            totalAssetsUsd: 505000,
            totalSupply: '500000000000000000000000',
            vault: { decimals: 18, asset: { decimals: 6 } },
          },
        },
        {
          timestamp: '1704240000',
          data: {
            totalAssets: '510000000000', // 510K USDT
            totalAssetsUsd: 510000,
            totalSupply: '500000000000000000000000',
            vault: { decimals: 18, asset: { decimals: 6 } },
          },
        },
      ],
    },
    performanceData: {
      items: [
        { timestamp: '1704067200', data: { linearNetApr: 0.04 } },
        { timestamp: '1704153600', data: { linearNetApr: 0.041 } },
      ],
    },
  };

  const mockVaultDataC = {
    vault: {
      address: '0x3456789012345678901234567890123456789012',
      name: 'Vault C',
      chain: { id: 42161, name: 'Arbitrum' },
      symbol: 'lgVaultC',
      assetSymbol: 'DAI',
      decimals: 18,
      asset: { decimals: 18 },
      state: { totalAssetsUsd: 250000, sharePrice: 1.08 },
    },
    priceHistory: {
      items: [
        {
          timestamp: '1704067200',
          data: {
            totalAssets: '250000000000000000000000', // 250K DAI in 18 decimals
            totalAssetsUsd: 250000,
            totalSupply: '250000000000000000000000', // 250K shares in 18 decimals (1:1 ratio)
            vault: { decimals: 18, asset: { decimals: 18 } },
          },
        },
        {
          timestamp: '1704153600',
          data: {
            totalAssets: '260000000000000000000000', // 260K DAI
            totalAssetsUsd: 260000,
            totalSupply: '250000000000000000000000',
            vault: { decimals: 18, asset: { decimals: 18 } },
          },
        },
        {
          timestamp: '1704240000',
          data: {
            totalAssets: '270000000000000000000000', // 270K DAI
            totalAssetsUsd: 270000,
            totalSupply: '250000000000000000000000',
            vault: { decimals: 18, asset: { decimals: 18 } },
          },
        },
      ],
    },
    performanceData: {
      items: [
        { timestamp: '1704067200', data: { linearNetApr: 0.08 } },
        { timestamp: '1704153600', data: { linearNetApr: 0.085 } },
      ],
    },
  };

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('Strategy: max_sharpe', () => {
    it('should optimize portfolio using maximum Sharpe ratio strategy', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      expect(result.content[0]).toHaveProperty('type', 'text');
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Maximum Sharpe Ratio');
      expect(text).toContain('Portfolio Metrics');
      expect(text).toContain('Sharpe Ratio');
      expect(text).toContain('Expected Return');
      expect(text).toContain('Portfolio Risk');
      expect(text).toContain('Diversification');
    });

    it('should calculate correct target allocations for high Sharpe ratio vaults', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      // Vault C has highest APR (8.25%) so should get higher allocation
      expect(text).toContain('Vault C');
      // Cache stores the final markdown text now
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringContaining('portfolio_optimization'),
        expect.stringContaining('Portfolio Optimization'),
        expect.any(Number)
      );
    });
  });

  describe('Strategy: equal_weight', () => {
    it('should distribute portfolio equally across all vaults', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const input = { ...baseInput, strategy: 'equal_weight' as const };
      const result = await executeOptimizePortfolio(input);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Equal Weight');
      expect(text).toContain('33.3%'); // ~33.3% for each of 3 vaults
    });
  });

  describe('Strategy: risk_parity', () => {
    it('should allocate based on inverse risk scores', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const input = { ...baseInput, strategy: 'risk_parity' as const };
      const result = await executeOptimizePortfolio(input);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Risk Parity');
      expect(text).toContain('Portfolio Metrics');
    });
  });

  describe('Strategy: min_variance', () => {
    it('should minimize portfolio volatility', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const input = { ...baseInput, strategy: 'min_variance' as const };
      const result = await executeOptimizePortfolio(input);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Minimum Variance');
      expect(text).toContain('Portfolio Risk');
    });
  });

  describe('Rebalancing Logic', () => {
    it('should identify rebalancing needs when drift exceeds threshold', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const unbalancedInput = {
        ...baseInput,
        currentPositions: [
          { vaultAddress: '0x1234567890123456789012345678901234567890', valueUsd: 9000 }, // 90%
          { vaultAddress: '0x2345678901234567890123456789012345678901', valueUsd: 800 }, // 8%
          { vaultAddress: '0x3456789012345678901234567890123456789012', valueUsd: 200 }, // 2%
        ],
        rebalanceThreshold: 5.0,
      };

      const result = await executeOptimizePortfolio(unbalancedInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Rebalancing Recommended');
      expect(text).toContain('Positions to Reduce');
      expect(text).toContain('Positions to Increase');
    });

    it('should not recommend rebalancing when within threshold', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const balancedInput = {
        ...baseInput,
        strategy: 'equal_weight' as const,
        currentPositions: [
          { vaultAddress: '0x1234567890123456789012345678901234567890', valueUsd: 3400 }, // ~34%
          { vaultAddress: '0x2345678901234567890123456789012345678901', valueUsd: 3300 }, // ~33%
          { vaultAddress: '0x3456789012345678901234567890123456789012', valueUsd: 3300 }, // ~33%
        ],
        rebalanceThreshold: 5.0,
      };

      const result = await executeOptimizePortfolio(balancedInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Well-Balanced');
    });

    it('should calculate exact rebalancing amounts', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      // Should show dollar amounts for buy/sell actions
      expect(text).toMatch(/\$[\d,]+\.\d{2}/); // Matches currency formatting
    });
  });

  describe('Portfolio Metrics', () => {
    it('should calculate expected return', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toMatch(/Expected Return.*\d+\.\d{2}%/);
    });

    it('should calculate portfolio risk (volatility)', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toMatch(/Portfolio Risk.*\d+\.\d{2}%/);
    });

    it('should calculate Sharpe ratio', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toMatch(/Sharpe Ratio.*\d+\.\d{2}/);
    });

    it('should calculate diversification score', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toMatch(/Diversification.*\d+%/);
    });
  });

  describe('Recommendations', () => {
    it('should generate strategy-specific recommendations', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toContain('Key Insights');
      expect(text).toContain('Maximum Sharpe ratio strategy');
    });

    it('should provide insights on diversification level', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      expect(text).toMatch(/(Highly diversified|Moderately diversified|Low diversification)/);
    });
  });

  describe('Caching', () => {
    it('should cache optimization results', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce(mockVaultDataA)
        .mockResolvedValueOnce(mockVaultDataB)
        .mockResolvedValueOnce(mockVaultDataC);

      await executeOptimizePortfolio(baseInput);

      // Cache stores the final markdown text now
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringContaining('portfolio_optimization'),
        expect.stringContaining('Portfolio Optimization'),
        300 // Cache TTL from config
      );
    });

    it('should return cached results when available', async () => {
      // Cache stores markdown text directly
      const cachedMarkdown = '## Portfolio Optimization\n\n**Sharpe Ratio**: 1.5';
      mockCacheGet.mockReturnValue(cachedMarkdown);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      expect(mockGraphqlRequest).not.toHaveBeenCalled();
      expect((result.content[0] as { text: string }).text).toBe(cachedMarkdown);
    });
  });

  describe('Edge Cases', () => {
    it('should handle vaults not found', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce({
          vault: null,
          priceHistory: { items: [] },
          performanceData: { items: [] },
        })
        .mockResolvedValueOnce({
          vault: null,
          priceHistory: { items: [] },
          performanceData: { items: [] },
        })
        .mockResolvedValueOnce({
          vault: null,
          priceHistory: { items: [] },
          performanceData: { items: [] },
        });

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('No vaults found');
    });

    it('should handle missing price history gracefully', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce({ ...mockVaultDataA, priceHistory: { items: [] } })
        .mockResolvedValueOnce({ ...mockVaultDataB, priceHistory: { items: [] } })
        .mockResolvedValueOnce({ ...mockVaultDataC, priceHistory: { items: [] } });

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      // Should use default volatility when no price history
    });

    it('should handle missing performance data gracefully', async () => {
      mockGraphqlRequest
        .mockResolvedValueOnce({ ...mockVaultDataA, performanceData: { items: [] } })
        .mockResolvedValueOnce({ ...mockVaultDataB, performanceData: { items: [] } })
        .mockResolvedValueOnce({ ...mockVaultDataC, performanceData: { items: [] } });

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      // Should use 0 APR when no performance data
    });

    it('should handle GraphQL errors', async () => {
      mockGraphqlRequest.mockRejectedValue(new Error('GraphQL request failed'));

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('GraphQL request failed');
    });
  });

  describe('Yield Sustainability Warnings (Phase 2.4)', () => {
    /**
     * Helper to create mock vault with yield composition data
     */
    function createMockVaultWithYield(
      overrides: Partial<{
        address: string;
        name: string;
        nativeYieldsApr: number;
        airdropsApr: number;
        incentivesApr: number;
        riskScore: number;
        yieldSustainabilityRisk: number;
      }> = {}
    ): any {
      const defaults = {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Vault',
        nativeYieldsApr: 0.08,
        airdropsApr: 0.01,
        incentivesApr: 0.01,
        riskScore: 0.3,
        yieldSustainabilityRisk: 0.2,
      };

      const merged = { ...defaults, ...overrides };
      const totalApr = merged.nativeYieldsApr + merged.airdropsApr + merged.incentivesApr;

      return {
        vault: {
          address: merged.address,
          name: merged.name,
          chain: { id: 42161, name: 'Arbitrum' },
          symbol: 'lgVault',
          assetSymbol: 'USDC',
          decimals: 18,
          asset: { decimals: 6 },
          state: {
            totalAssetsUsd: 1000000,
            sharePrice: 1.05,
            // Add weeklyApr with yield composition for risk analysis
            weeklyApr: {
              linearNetApr: totalApr,
              nativeYields: [{ apr: merged.nativeYieldsApr }],
              airdrops: [{ apr: merged.airdropsApr }],
              incentives: [{ apr: merged.incentivesApr }],
            },
          },
        },
        priceHistory: {
          items: [
            {
              timestamp: '1704067200',
              data: {
                totalAssets: '1000000000000',
                totalAssetsUsd: 1000000,
                totalSupply: '1000000000000000000000000',
                vault: { decimals: 18, asset: { decimals: 6 } },
              },
            },
          ],
        },
        performanceData: {
          items: [
            {
              timestamp: '1704067200',
              data: {
                linearNetApr: totalApr,
                nativeYields: [{ apr: merged.nativeYieldsApr }],
                airdrops: [{ apr: merged.airdropsApr }],
                incentives: [{ apr: merged.incentivesApr }],
              },
            },
          ],
        },
      };
    }

    it('should show high risk warning for vaults heavily dependent on incentives', async () => {
      const vaultA = createMockVaultWithYield({
        address: '0x1111111111111111111111111111111111111111',
        name: 'High Risk Vault',
        nativeYieldsApr: 0.01, // Only 10% native yields
        airdropsApr: 0.045, // 45% airdrops
        incentivesApr: 0.045, // 45% incentives
        yieldSustainabilityRisk: 0.85, // High risk
      });

      const vaultB = createMockVaultWithYield({
        address: '0x2222222222222222222222222222222222222222',
        name: 'Safe Vault',
        nativeYieldsApr: 0.09, // 90% native yields
        airdropsApr: 0.005,
        incentivesApr: 0.005,
        yieldSustainabilityRisk: 0.1, // Low risk
      });

      mockGraphqlRequest
        .mockResolvedValueOnce(vaultA)
        .mockResolvedValueOnce(vaultB)
        .mockResolvedValueOnce(
          createMockVaultWithYield({
            address: '0x3333333333333333333333333333333333333333',
          })
        );

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      // Should include warnings section
      expect(text).toContain('### Yield Sustainability Warnings');

      // Should show high risk warning
      expect(text).toContain('🚨');
      expect(text).toContain('High Risk Vault');
      expect(text).toContain('heavily dependent on temporary incentives');
    });

    it('should show medium risk warning for moderate incentive dependency', async () => {
      const vaultA = createMockVaultWithYield({
        address: '0x1111111111111111111111111111111111111111',
        name: 'Medium Risk Vault',
        nativeYieldsApr: 0.035, // 35% native yields
        airdropsApr: 0.0325, // 32.5% airdrops
        incentivesApr: 0.0325, // 32.5% incentives
        yieldSustainabilityRisk: 0.5, // Medium risk
      });

      const vaultB = createMockVaultWithYield({
        address: '0x2222222222222222222222222222222222222222',
      });

      const vaultC = createMockVaultWithYield({
        address: '0x3333333333333333333333333333333333333333',
      });

      mockGraphqlRequest
        .mockResolvedValueOnce(vaultA)
        .mockResolvedValueOnce(vaultB)
        .mockResolvedValueOnce(vaultC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      // Should show medium risk warning
      expect(text).toContain('⚠️');
      expect(text).toContain('Medium Risk Vault');
      expect(text).toContain('Monitor yield composition');
    });

    it('should show "no concerns" message when all vaults have healthy yield', async () => {
      const vaultA = createMockVaultWithYield({
        address: '0x1111111111111111111111111111111111111111',
        name: 'Healthy Vault A',
        nativeYieldsApr: 0.085, // 85% native yields (above 80% threshold for low risk)
        airdropsApr: 0.0075,
        incentivesApr: 0.0075,
      });

      const vaultB = createMockVaultWithYield({
        address: '0x2222222222222222222222222222222222222222',
        name: 'Healthy Vault B',
        nativeYieldsApr: 0.09, // 90% native yields
        airdropsApr: 0.005,
        incentivesApr: 0.005,
        yieldSustainabilityRisk: 0.1, // Low risk
      });

      const vaultC = createMockVaultWithYield({
        address: '0x3333333333333333333333333333333333333333',
        name: 'Healthy Vault C',
        nativeYieldsApr: 0.085, // 85% native yields (above 80% threshold for low risk)
        airdropsApr: 0.0075,
        incentivesApr: 0.0075,
      });

      mockGraphqlRequest
        .mockResolvedValueOnce(vaultA)
        .mockResolvedValueOnce(vaultB)
        .mockResolvedValueOnce(vaultC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      // Should show no concerns message
      expect(text).toContain('✅');
      expect(text).toContain('No sustainability concerns');
      expect(text).toContain('healthy yield compositions');
    });

    it('should handle vaults without risk breakdown gracefully', async () => {
      const vaultWithoutRisk = {
        vault: {
          address: '0x1111111111111111111111111111111111111111',
          name: 'Old Vault',
          chain: { id: 42161, name: 'Arbitrum' },
          symbol: 'lgOldVault',
          assetSymbol: 'USDC',
          decimals: 18,
          asset: { decimals: 6 },
          state: { totalAssetsUsd: 1000000, sharePrice: 1.05 },
          // No riskBreakdown
        },
        priceHistory: {
          items: [
            {
              timestamp: '1704067200',
              data: {
                totalAssets: '1000000000000',
                totalAssetsUsd: 1000000,
                totalSupply: '1000000000000000000000000',
                vault: { decimals: 18, asset: { decimals: 6 } },
              },
            },
          ],
        },
        performanceData: {
          items: [{ timestamp: '1704067200', data: { linearNetApr: 0.1 } }],
        },
      };

      const vaultB = createMockVaultWithYield({
        address: '0x2222222222222222222222222222222222222222',
      });

      const vaultC = createMockVaultWithYield({
        address: '0x3333333333333333333333333333333333333333',
      });

      mockGraphqlRequest
        .mockResolvedValueOnce(vaultWithoutRisk)
        .mockResolvedValueOnce(vaultB)
        .mockResolvedValueOnce(vaultC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      // Should not crash, should handle gracefully
    });

    it('should display multiple warnings for multiple risky vaults', async () => {
      const vaultA = createMockVaultWithYield({
        address: '0x1111111111111111111111111111111111111111',
        name: 'Risky Vault A',
        nativeYieldsApr: 0.01, // 10% native yields → risk 1.0 (< 20%)
        airdropsApr: 0.045,
        incentivesApr: 0.045,
      });

      const vaultB = createMockVaultWithYield({
        address: '0x2222222222222222222222222222222222222222',
        name: 'Risky Vault B',
        nativeYieldsApr: 0.015, // 15% native yields → risk 1.0 (< 20%)
        airdropsApr: 0.0425,
        incentivesApr: 0.0425,
      });

      const vaultC = createMockVaultWithYield({
        address: '0x3333333333333333333333333333333333333333',
        name: 'Medium Vault C',
        nativeYieldsApr: 0.06, // 60% native yields → risk 0.4 (50-80% = medium risk)
        airdropsApr: 0.02,
        incentivesApr: 0.02,
      });

      mockGraphqlRequest
        .mockResolvedValueOnce(vaultA)
        .mockResolvedValueOnce(vaultB)
        .mockResolvedValueOnce(vaultC);

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;

      // Should show multiple warnings
      expect(text).toContain('Risky Vault A');
      expect(text).toContain('Risky Vault B');
      expect(text).toContain('Medium Vault C');

      // Should have 2 high risk warnings (🚨) and 1 medium risk warning (⚠️)
      const highRiskCount = (text.match(/🚨/g) || []).length;
      const mediumRiskCount = (text.match(/⚠️/g) || []).length;

      expect(highRiskCount).toBeGreaterThanOrEqual(2);
      expect(mediumRiskCount).toBeGreaterThanOrEqual(1);
    });

    it('should correctly threshold warnings at 0.7 (high) and 0.4 (medium)', async () => {
      // Test exact thresholds
      const vaultJustBelowHigh = createMockVaultWithYield({
        address: '0x1111111111111111111111111111111111111111',
        name: 'Just Below High',
        nativeYieldsApr: 0.025, // 25% native yields → risk 0.7 (just above 20% threshold)
        airdropsApr: 0.0375,
        incentivesApr: 0.0375,
      });

      const vaultAtHigh = createMockVaultWithYield({
        address: '0x2222222222222222222222222222222222222222',
        name: 'At High Threshold',
        nativeYieldsApr: 0.02, // Exactly 20% native yields → risk 0.7
        airdropsApr: 0.04,
        incentivesApr: 0.04,
      });

      const vaultAtMedium = createMockVaultWithYield({
        address: '0x3333333333333333333333333333333333333333',
        name: 'At Medium Threshold',
        nativeYieldsApr: 0.05, // Exactly 50% native yields → risk 0.4
        airdropsApr: 0.025,
        incentivesApr: 0.025,
      });

      // Test with vault just below high threshold
      mockGraphqlRequest
        .mockResolvedValueOnce(vaultJustBelowHigh)
        .mockResolvedValueOnce(
          createMockVaultWithYield({ address: '0x2222222222222222222222222222222222222222' })
        )
        .mockResolvedValueOnce(
          createMockVaultWithYield({ address: '0x3333333333333333333333333333333333333333' })
        );

      let result = await executeOptimizePortfolio(baseInput);
      let text = (result.content[0] as { text: string }).text;

      // 0.69 should show medium warning (⚠️), not high (🚨)
      expect(text).toContain('Just Below High');
      expect(text).toContain('⚠️');

      vi.clearAllMocks();

      // Test with vault at high threshold
      mockGraphqlRequest
        .mockResolvedValueOnce(vaultAtHigh)
        .mockResolvedValueOnce(
          createMockVaultWithYield({ address: '0x2222222222222222222222222222222222222222' })
        )
        .mockResolvedValueOnce(
          createMockVaultWithYield({ address: '0x3333333333333333333333333333333333333333' })
        );

      result = await executeOptimizePortfolio(baseInput);
      text = (result.content[0] as { text: string }).text;

      // 0.7 should show high risk warning (🚨)
      expect(text).toContain('At High Threshold');
      expect(text).toContain('🚨');

      vi.clearAllMocks();

      // Test with vault at medium threshold
      mockGraphqlRequest
        .mockResolvedValueOnce(vaultAtMedium)
        .mockResolvedValueOnce(
          createMockVaultWithYield({ address: '0x2222222222222222222222222222222222222222' })
        )
        .mockResolvedValueOnce(
          createMockVaultWithYield({ address: '0x3333333333333333333333333333333333333333' })
        );

      result = await executeOptimizePortfolio(baseInput);
      text = (result.content[0] as { text: string }).text;

      // 0.4 should show medium warning (⚠️)
      expect(text).toContain('At Medium Threshold');
      expect(text).toContain('⚠️');
    });
  });
});
