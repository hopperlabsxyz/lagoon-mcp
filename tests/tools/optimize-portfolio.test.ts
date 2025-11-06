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
      state: { totalAssetsUsd: 1000000, sharePrice: 1.05 },
    },
    priceHistory: {
      items: [
        { timestamp: '1704067200', data: { pricePerShareUsd: 1.0 } },
        { timestamp: '1704153600', data: { pricePerShareUsd: 1.02 } },
        { timestamp: '1704240000', data: { pricePerShareUsd: 1.05 } },
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
      state: { totalAssetsUsd: 500000, sharePrice: 1.02 },
    },
    priceHistory: {
      items: [
        { timestamp: '1704067200', data: { pricePerShareUsd: 1.0 } },
        { timestamp: '1704153600', data: { pricePerShareUsd: 1.01 } },
        { timestamp: '1704240000', data: { pricePerShareUsd: 1.02 } },
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
      state: { totalAssetsUsd: 250000, sharePrice: 1.08 },
    },
    priceHistory: {
      items: [
        { timestamp: '1704067200', data: { pricePerShareUsd: 1.0 } },
        { timestamp: '1704153600', data: { pricePerShareUsd: 1.04 } },
        { timestamp: '1704240000', data: { pricePerShareUsd: 1.08 } },
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

      // Vault C has highest APY (8.25%) so should get higher allocation
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
      // Should use 0 APY when no performance data
    });

    it('should handle GraphQL errors', async () => {
      mockGraphqlRequest.mockRejectedValue(new Error('GraphQL request failed'));

      const result = await executeOptimizePortfolio(baseInput);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('GraphQL request failed');
    });
  });
});
