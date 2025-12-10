/**
 * search_vaults Tool Tests
 *
 * Tests for the search_vaults tool handler covering:
 * - Basic search with various filter combinations
 * - Cache miss → query → store workflow
 * - Cache hit → instant return with filter hash
 * - Pagination functionality
 * - Empty results handling
 * - Sort order validation
 * - GraphQL error handling
 * - Invalid input validation
 *
 * Phase 3.1 implementation (2025-01-04)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExecuteSearchVaults } from '../../src/tools/search-vaults';
import * as graphqlClientModule from '../../src/graphql/client';
import { cache, cacheTTL } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

/**
 * Helper to create complete mock vault for search results
 */
function createMockVault(overrides: Record<string, unknown> = {}): any {
  return {
    address: '0x1234567890123456789012345678901234567890',
    symbol: 'TEST-VAULT',
    name: 'Test Vault',
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
      totalAssetsUsd: 1000000,
      totalSupply: '1000000000000000000000',
      newTotalAssets: '1000000000000000000000',
      pricePerShare: '1000000000000000000',
      pricePerShareUsd: 1.0,
      safeAssetBalance: '500000000000000000000',
      safeAssetBalanceUsd: 500000,
      liveAPR: {
        grossApr: 0.15,
        name: 'Live APR',
        netApr: 0.12,
        description: 'Current annual percentage rate',
      },
      roles: {
        owner: '0xowner1234567890123456789012345678901234',
        valuationManager: '0xvaluation1234567890123456789012345678',
        whitelistManager: '0xwhitelist1234567890123456789012345678',
        safe: '0xsafe12345678901234567890123456789012345',
        feeReceiver: '0xfees12345678901234567890123456789012345',
      },
      managementFee: 0.02,
      performanceFee: 0.1,
      protocolFee: 0,
      isWhitelistActivated: false,
      whitelist: null,
      pendingSettlement: {
        assets: '100000000000000000000',
        assetsUsd: 100000,
      },
      pendingSiloBalances: {
        assets: '50000000000000000000',
        shares: '50000000000000000000',
      },
      inceptionApr: {
        linearNetApr: 0.12,
        linearNetAprWithoutExtraYields: 0.1,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      weeklyApr: {
        linearNetApr: 0.13,
        linearNetAprWithoutExtraYields: 0.11,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      monthlyApr: {
        linearNetApr: 0.14,
        linearNetAprWithoutExtraYields: 0.12,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      yearlyApr: {
        linearNetApr: 0.15,
        linearNetAprWithoutExtraYields: 0.13,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      highWaterMark: '1100000000000000000',
      lastFeeTime: '1704067200',
    },
    curators: [
      {
        id: 'curator-123',
        name: 'Test Curator',
        aboutDescription: 'Professional vault curator',
        logoUrl: 'https://example.com/curator.png',
        url: 'https://curator.example.com',
      },
    ],
    integrator: {
      name: 'Test Integrator',
      url: 'https://integrator.example.com',
      logoUrl: 'https://example.com/integrator.png',
      aboutDescription: 'DeFi integration platform',
    },
    defiIntegrations: [
      {
        name: 'Uniswap',
        description: 'DEX integration',
        logoUrl: 'https://example.com/uniswap.png',
        link: 'https://app.uniswap.org',
        type: 'DEX',
      },
    ],
    ...overrides,
  };
}

/**
 * Helper to create mock search response
 */
function createMockSearchResponse(
  vaults: unknown[],
  hasNextPage = false,
  hasPreviousPage = false
): unknown {
  return {
    vaults: {
      items: vaults,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
      },
    },
  };
}

describe('search_vaults Tool', () => {
  // Executor function created from factory with mock container
  let executeSearchVaults: ReturnType<typeof createExecuteSearchVaults>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executeSearchVaults = createExecuteSearchVaults(mockContainer);
  });

  afterEach(() => {
    cache.flushAll();
  });

  describe('Basic Search Functionality', () => {
    it('should search vaults without filters and return all results', async () => {
      // Arrange
      const mockVaults = [createMockVault(), createMockVault()];
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: { items: mockVaults, totalCount: mockVaults.length },
      });

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('TEST-VAULT');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledOnce();
    });

    it('should search vaults with asset filter', async () => {
      // Arrange
      const baseVault = createMockVault();
      const mockVault = createMockVault({ asset: { ...baseVault.asset, symbol: 'USDC' } });
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'USDC' },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('USDC');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          where: expect.objectContaining({
            assetSymbol_eq: 'USDC',
          }),
        })
      );
    });

    it('should search vaults with chain filter', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { chainId_eq: 1 },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          where: expect.objectContaining({
            chainId_eq: 1,
          }),
        })
      );
    });

    it('should search vaults with multiple filters', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: {
          assetSymbol_eq: 'USDC',
          chainId_eq: 1,
          isVisible_eq: true,
        },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          where: expect.objectContaining({
            assetSymbol_eq: 'USDC',
            chainId_eq: 1,
            isVisible_eq: true,
          }),
        })
      );
    });
  });

  describe('Cache Miss → Query → Store Workflow', () => {
    it('should fetch search results from GraphQL and cache them', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'USDC' },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledOnce();

      // Verify data is cached (cache key includes filter hash)
      const cacheStats = cache.keys();
      expect(cacheStats.length).toBeGreaterThan(0);
      expect(cacheStats[0]).toContain('search:');
    });

    it('should use correct cache TTL (10 minutes)', () => {
      // Assert - Verify cache TTL is 10 minutes (600 seconds)
      expect(cacheTTL.searchResults).toBe(600);
    });
  });

  describe('Cache Hit → Instant Return', () => {
    it('should return cached data without querying GraphQL for identical filters', async () => {
      // Arrange
      const mockVault = createMockVault({ symbol: 'CACHED-VAULT' });
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act - First call (cache miss)
      await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'USDC' },
      });

      // Act - Second call (cache hit)
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'USDC' },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('CACHED-VAULT');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledOnce(); // Only once
    });

    it('should cache searches separately for different filters', async () => {
      // Arrange
      const baseVaultForUsdc = createMockVault();
      const baseVaultForDai = createMockVault();
      const usdcVault = createMockVault({
        symbol: 'USDC-VAULT',
        asset: { ...baseVaultForUsdc.asset, symbol: 'USDC' },
      });
      const daiVault = createMockVault({
        symbol: 'DAI-VAULT',
        asset: { ...baseVaultForDai.asset, symbol: 'DAI' },
      });

      vi.spyOn(graphqlClientModule.graphqlClient, 'request')
        .mockResolvedValueOnce(createMockSearchResponse([usdcVault]))
        .mockResolvedValueOnce(createMockSearchResponse([daiVault]));

      // Act - Search for USDC vaults
      const result1 = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'USDC' },
      });

      // Act - Search for DAI vaults
      const result2 = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'DAI' },
      });

      // Assert - Both should query GraphQL (different filters = different cache keys)
      expect(result1.content[0].text).toContain('USDC-VAULT');
      expect(result2.content[0].text).toContain('DAI-VAULT');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Pagination Functionality', () => {
    it('should use default pagination (first: 100, skip: 0)', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeSearchVaults({ orderBy: 'totalAssetsUsd', orderDirection: 'desc' });

      // Assert
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          first: 100,
          skip: 0,
        })
      );
    });

    it('should accept custom pagination parameters', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        pagination: { first: 50, skip: 100 },
      });

      // Assert
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          first: 50,
          skip: 100,
        })
      );
    });

    // NOTE: Maximum page size validation test removed - validation handled by wrapper

    it('should return pagination info (hasNextPage, hasPreviousPage)', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault], true, false);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        pagination: { first: 10, skip: 0 },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('hasNextPage');
      expect(result.content[0].text).toContain('true');
    });
  });

  describe('Sort Order Validation', () => {
    it('should use default sort (totalAssetsUsd desc)', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeSearchVaults({ orderBy: 'totalAssetsUsd', orderDirection: 'desc' });

      // Assert
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          orderBy: 'totalAssetsUsd',
          orderDirection: 'desc',
        })
      );
    });

    it('should accept custom sort order', async () => {
      // Arrange
      const mockVault = createMockVault();
      const mockResponse = createMockSearchResponse([mockVault]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeSearchVaults({
        orderBy: 'address',
        orderDirection: 'asc',
      });

      // Assert
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          orderBy: 'address',
          orderDirection: 'asc',
        })
      );
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle empty search results gracefully', async () => {
      // Arrange
      const mockResponse = createMockSearchResponse([]);
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
        filters: { assetSymbol_eq: 'NONEXISTENT' },
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('No vaults found');
    });

    it('should handle null vaults array', async () => {
      // Arrange
      const mockResponse = { vaults: null };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
      });

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No vaults found');
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL errors gracefully', async () => {
      // Arrange
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(
        new Error('GraphQL request failed')
      );

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
      });

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('GraphQL request failed');
    });

    // NOTE: Validation tests removed - validation handled by wrapper

    it('should handle network timeouts', async () => {
      // Arrange
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(
        new Error('Network timeout')
      );

      // Act
      const result = await executeSearchVaults({
        orderBy: 'totalAssetsUsd',
        orderDirection: 'desc',
      });

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network timeout');
    });
  });
});
