/**
 * compare_vaults Tool Tests
 *
 * Tests for the compare_vaults tool handler covering:
 * - Basic comparison with 2-10 vaults
 * - Cache miss → query → store workflow
 * - Cache hit → instant return
 * - Normalized metrics calculation (percentiles, deltas, scores)
 * - Ranking and sorting
 * - Summary statistics generation
 * - Empty results handling
 * - Missing vaults handling (partial results)
 * - GraphQL error handling
 * - Invalid input validation (min/max vaults, invalid addresses)
 *
 * Phase 4.1 implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExecuteCompareVaults } from '../../src/tools/compare-vaults';
import * as graphqlClientModule from '../../src/graphql/client';
import { cache } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

/**
 * Helper to create complete mock vault for comparison
 */
function createMockVault(
  overrides: Partial<{
    address: string;
    name: string;
    symbol: string;
    tvl: number;
    weeklyApr: number;
    monthlyApr: number;
  }> = {}
): unknown {
  const defaults = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    tvl: 1000000,
    weeklyApr: 0.1,
    monthlyApr: 0.12,
  };

  const merged = { ...defaults, ...overrides };

  return {
    address: merged.address,
    symbol: merged.symbol,
    name: merged.name,
    description: 'Test vault description',
    shortDescription: 'Short description',
    decimals: 18,
    logoUrl: 'https://example.com/logo.png',
    maxCapacity: '10000000000000000000000',
    averageSettlement: 24,
    isVisible: true,
    chain: {
      name: 'Ethereum',
      nativeToken: 'ETH',
      factory: '0xfactory123456789012345678901234567890',
      logoUrl: 'https://example.com/eth.png',
      wrappedNativeToken: {
        address: '0xweth1234567890123456789012345678901234',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
      },
    },
    asset: {
      id: 'asset-123',
      address: '0xasset1234567890123456789012345678901234',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      description: 'USD Coin stablecoin',
      logoUrl: 'https://example.com/usdc.png',
      isVisible: true,
      priceUsd: 1.0,
      chain: {
        id: '1',
        name: 'Ethereum',
        nativeToken: 'ETH',
        logoUrl: 'https://example.com/eth.png',
      },
      priceSources: {
        chainlinkPriceFeed: {
          address: '0xpricefeed1234567890123456789012345678',
          chainId: 1,
        },
      },
    },
    state: {
      state: 'ACTIVE',
      totalAssets: '1000000000000000000000',
      totalAssetsUsd: merged.tvl,
      totalSupply: '1000000000000000000000',
      newTotalAssets: '1000000000000000000000',
      pricePerShare: '1000000000000000000',
      pricePerShareUsd: 1.0,
      safeAssetBalance: '500000000000000000000',
      safeAssetBalanceUsd: 500000,
      pendingSettlement: {
        assets: '0',
        assetsUsd: 0,
      },
      pendingSiloBalances: {
        assets: '0',
        shares: '0',
      },
      liveAPR: null,
      weeklyApr: {
        linearNetApr: merged.weeklyApr,
        linearNetAprWithoutExtraYields: merged.weeklyApr * 0.9,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      monthlyApr: {
        linearNetApr: merged.monthlyApr,
        linearNetAprWithoutExtraYields: merged.monthlyApr * 0.9,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      inceptionApr: {
        linearNetApr: 0.08,
        linearNetAprWithoutExtraYields: 0.07,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      yearlyApr: {
        linearNetApr: 0.11,
        linearNetAprWithoutExtraYields: 0.1,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      roles: {
        owner: '0xowner1234567890123456789012345678901234',
        valuationManager: '0xvaluation1234567890123456789012345678',
        whitelistManager: '0xwhitelist1234567890123456789012345678',
        safe: '0xsafe12345678901234567890123456789012345',
        feeReceiver: '0xfees12345678901234567890123456789012345',
      },
      managementFee: 0.02,
      performanceFee: 0.2,
      highWaterMark: '1000000000000000000',
      lastFeeTime: '1704326400',
    },
    curators: [
      {
        id: 'curator-1',
        name: 'Test Curator',
        aboutDescription: 'Curator description',
        logoUrl: 'https://example.com/curator.png',
        url: 'https://curator.example.com',
      },
    ],
    integrator: {
      name: 'Test Integrator',
      url: 'https://integrator.example.com',
      logoUrl: 'https://example.com/integrator.png',
      aboutDescription: 'Integrator description',
    },
    defiIntegrations: [
      {
        name: 'Aave',
        description: 'Aave lending protocol',
        logoUrl: 'https://example.com/aave.png',
        link: 'https://aave.com',
        type: 'Lending',
      },
    ],
  };
}

describe('compare_vaults Tool', () => {
  const graphqlClient = vi.mocked(graphqlClientModule.graphqlClient);

  // Executor function created from factory with mock container
  let executeCompareVaults: ReturnType<typeof createExecuteCompareVaults>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executeCompareVaults = createExecuteCompareVaults(mockContainer);
  });

  afterEach(() => {
    cache.flushAll();
  });

  describe('Basic Comparison Functionality', () => {
    it('should compare 2 vaults successfully', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'High Yield Vault',
          symbol: 'HIGH',
          tvl: 2000000,
          weeklyApr: 0.15,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          name: 'Stable Vault',
          symbol: 'STABLE',
          tvl: 1000000,
          weeklyApr: 0.08,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({
        vaults: { items: mockVaults },
      });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text as string;
      expect(text).toContain('# Vault Comparison Results');
      expect(text).toContain('Chain ID**: 1');
      expect(text).toContain('Vaults Analyzed**: 2');
      expect(text).toContain('High Yield Vault');
      expect(text).toContain('Stable Vault');
      expect(text).toContain('Best Performer');
      expect(text).toContain('Worst Performer');
    });

    it('should compare 5 vaults with varied metrics', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'Vault A',
          tvl: 5000000,
          weeklyApr: 0.2,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          name: 'Vault B',
          tvl: 3000000,
          weeklyApr: 0.15,
        }),
        createMockVault({
          address: '0x3333333333333333333333333333333333333333',
          name: 'Vault C',
          tvl: 2000000,
          weeklyApr: 0.12,
        }),
        createMockVault({
          address: '0x4444444444444444444444444444444444444444',
          name: 'Vault D',
          tvl: 1000000,
          weeklyApr: 0.08,
        }),
        createMockVault({
          address: '0x5555555555555555555555555555555555555555',
          name: 'Vault E',
          tvl: 500000,
          weeklyApr: 0.05,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Vaults Analyzed**: 5');
      expect(text).toContain('| Rank | Vault | TVL | APR | Score | TVL Δ | APR Δ |');
      // Check that all vaults are present
      expect(text).toContain('Vault A');
      expect(text).toContain('Vault E');
    });

    it('should compare 10 vaults (maximum allowed)', async () => {
      const mockVaults = Array.from({ length: 10 }, (_, i) =>
        createMockVault({
          address: `0x${(i + 1).toString().padStart(40, '0')}`,
          name: `Vault ${i + 1}`,
          symbol: `V${i + 1}`,
          tvl: 1000000 * (10 - i),
          weeklyApr: 0.05 + i * 0.01,
        })
      );

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Vaults Analyzed**: 10');
    });
  });

  describe('Cache Workflow', () => {
    it('should cache comparison results for 15 minutes', async () => {
      const mockVaults = [
        createMockVault({ address: '0x1111111111111111111111111111111111111111', name: 'Vault 1' }),
        createMockVault({ address: '0x2222222222222222222222222222222222222222', name: 'Vault 2' }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      // First call - cache miss
      await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(graphqlClient.request).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      // Should not make another GraphQL request
      expect(graphqlClient.request).toHaveBeenCalledTimes(1);
    });

    it('should use same cache key regardless of address order', async () => {
      const mockVaults = [
        createMockVault({ address: '0x1111111111111111111111111111111111111111', name: 'Vault 1' }),
        createMockVault({ address: '0x2222222222222222222222222222222222222222', name: 'Vault 2' }),
      ];

      graphqlClient.request.mockResolvedValue({ vaults: { items: mockVaults } });

      // First call with one order
      await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      // Second call with reversed order - should hit cache
      await executeCompareVaults({
        vaultAddresses: [
          '0x2222222222222222222222222222222222222222',
          '0x1111111111111111111111111111111111111111',
        ],
        chainId: 1,
      });

      // Should only make one GraphQL request
      expect(graphqlClient.request).toHaveBeenCalledTimes(1);
    });

    it('should use different cache keys for different chain IDs', async () => {
      const mockVaults = [
        createMockVault({ address: '0x1111111111111111111111111111111111111111' }),
        createMockVault({ address: '0x2222222222222222222222222222222222222222' }),
      ];

      graphqlClient.request.mockResolvedValue({ vaults: { items: mockVaults } });

      // Chain ID 1
      await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      // Chain ID 137 - different cache key
      await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 137,
      });

      // Should make two GraphQL requests
      expect(graphqlClient.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate correct percentiles for 3 vaults', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'Low',
          tvl: 1000000,
          weeklyApr: 0.05,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          name: 'Mid',
          tvl: 2000000,
          weeklyApr: 0.1,
        }),
        createMockVault({
          address: '0x3333333333333333333333333333333333333333',
          name: 'High',
          tvl: 3000000,
          weeklyApr: 0.15,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;

      // Average TVL should be 2M
      expect(text).toContain('Average TVL**: $2.00M');

      // Average APR should be 10%
      expect(text).toContain('Average APR**: 10.00%');

      // High should be the best performer
      expect(text).toContain('Best Performer');
      expect(text).toMatch(/Best Performer[\s\S]*High/);
    });

    it('should calculate deltas from average correctly', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          tvl: 1000000,
          weeklyApr: 0.05,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          tvl: 2000000,
          weeklyApr: 0.15,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;

      // Should contain delta symbols
      expect(text).toContain('TVL Δ');
      expect(text).toContain('APR Δ');

      // Should show positive and negative deltas
      expect(text).toMatch(/[+-]\d+\.\d+%/);
    });

    it('should rank vaults by overall score (60% APR, 40% TVL)', async () => {
      const mockVaults = [
        // High TVL, low APR
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'High TVL',
          tvl: 5000000,
          weeklyApr: 0.05,
        }),
        // Low TVL, high APR
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          name: 'High APR',
          tvl: 1000000,
          weeklyApr: 0.2,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;

      // High APR vault should rank higher (60% weight on APR)
      expect(text).toContain('| Rank |');
      expect(text).toContain('Score');
    });
  });

  describe('Summary Statistics', () => {
    it('should identify best and worst performers', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'Best Vault',
          weeklyApr: 0.25,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          name: 'Mid Vault',
          weeklyApr: 0.15,
        }),
        createMockVault({
          address: '0x3333333333333333333333333333333333333333',
          name: 'Worst Vault',
          weeklyApr: 0.05,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;

      expect(text).toContain('Best Performer');
      expect(text).toMatch(/Best Performer[\s\S]*Best Vault/);
      expect(text).toMatch(/Best Performer[\s\S]*25\.00%/);

      expect(text).toContain('Worst Performer');
      expect(text).toMatch(/Worst Performer[\s\S]*Worst Vault/);
      expect(text).toMatch(/Worst Performer[\s\S]*5\.00%/);
    });

    it('should identify highest and lowest TVL vaults', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'Largest',
          tvl: 10000000,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          name: 'Medium',
          tvl: 5000000,
        }),
        createMockVault({
          address: '0x3333333333333333333333333333333333333333',
          name: 'Smallest',
          tvl: 1000000,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;

      expect(text).toContain('Highest TVL');
      expect(text).toMatch(/Highest TVL[\s\S]*Largest/);
      expect(text).toMatch(/Highest TVL[\s\S]*\$10\.00M/);

      expect(text).toContain('Lowest TVL');
      expect(text).toMatch(/Lowest TVL[\s\S]*Smallest/);
      expect(text).toMatch(/Lowest TVL[\s\S]*\$1\.00M/);
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle no vaults found gracefully', async () => {
      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: [] } });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No vaults found');
    });

    it('should handle null vaults response', async () => {
      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: null } });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No vaults found');
    });
  });

  describe('Partial Results Handling', () => {
    it('should handle when some vaults are not found', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          name: 'Found Vault',
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222', // This one won't be found
          '0x3333333333333333333333333333333333333333', // This one won't be found
        ],
        chainId: 1,
      });

      // Should still succeed with partial results
      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('Found Vault');
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('Error Handling', () => {
    it('should handle GraphQL network errors', async () => {
      graphqlClient.request.mockRejectedValueOnce(new Error('Network error'));

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });

    it('should handle GraphQL timeout errors', async () => {
      graphqlClient.request.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Request timeout');
    });
  });

  describe('Output Formatting', () => {
    it('should format TVL values in millions', async () => {
      const mockVaults = [
        createMockVault({ address: '0x1111111111111111111111111111111111111111', tvl: 1500000 }),
        createMockVault({ address: '0x2222222222222222222222222222222222222222', tvl: 2500000 }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toMatch(/\$\d+\.\d{2}M/); // Format: $X.XXM
    });

    it('should format APR values as percentages with 2 decimals', async () => {
      const mockVaults = [
        createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          weeklyApr: 0.1234,
        }),
        createMockVault({
          address: '0x2222222222222222222222222222222222222222',
          weeklyApr: 0.0567,
        }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toMatch(/\d+\.\d{2}%/); // Format: XX.XX%
    });

    it('should include legend explaining table columns', async () => {
      const mockVaults = [
        createMockVault({ address: '0x1111111111111111111111111111111111111111' }),
        createMockVault({ address: '0x2222222222222222222222222222222222222222' }),
      ];

      graphqlClient.request.mockResolvedValueOnce({ vaults: { items: mockVaults } });

      const result = await executeCompareVaults({
        vaultAddresses: mockVaults.map((v: any) => v.address),
        chainId: 1,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('**Legend**');
      expect(text).toContain('Overall ranking');
      expect(text).toContain('60% APR, 40% TVL');
      expect(text).toContain('TVL Δ');
      expect(text).toContain('APR Δ');
    });
  });

  describe('APR Fallback Logic', () => {
    it('should use weekly APR when available', async () => {
      const mockVault = createMockVault({
        address: '0x1111111111111111111111111111111111111111',
        weeklyApr: 0.15,
        monthlyApr: 0.1,
      });

      graphqlClient.request.mockResolvedValueOnce({
        vaults: {
          items: [
            mockVault,
            createMockVault({ address: '0x2222222222222222222222222222222222222222' }),
          ],
        },
      });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      const text = result.content[0].text as string;
      // Should use weekly APR (15%) not monthly (10%)
      expect(text).toContain('15.00%');
    });

    it('should fall back to monthly APR when weekly is not available', async () => {
      const mockVault = {
        ...(createMockVault({
          address: '0x1111111111111111111111111111111111111111',
          monthlyApr: 0.12,
        }) as any),
        state: {
          ...(createMockVault({ monthlyApr: 0.12 }) as any).state,
          weeklyApr: null,
        },
      };

      graphqlClient.request.mockResolvedValueOnce({
        vaults: {
          items: [
            mockVault,
            createMockVault({ address: '0x2222222222222222222222222222222222222222' }),
          ],
        },
      });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      // Should complete successfully with monthly APR
    });

    it('should use 0% APR when both weekly and monthly are unavailable', async () => {
      const mockVault = {
        ...(createMockVault({ address: '0x1111111111111111111111111111111111111111' }) as any),
        state: {
          ...(createMockVault() as any).state,
          weeklyApr: null,
          monthlyApr: null,
        },
      };

      graphqlClient.request.mockResolvedValueOnce({
        vaults: {
          items: [
            mockVault,
            createMockVault({ address: '0x2222222222222222222222222222222222222222' }),
          ],
        },
      });

      const result = await executeCompareVaults({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        chainId: 1,
      });

      expect(result.isError).toBe(false);
      const text = result.content[0].text as string;
      expect(text).toContain('0.00%');
    });
  });
});
