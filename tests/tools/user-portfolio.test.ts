/**
 * get_user_portfolio Tool Tests
 *
 * Tests for the get_user_portfolio tool handler covering:
 * - User portfolio query (all chains in single request)
 * - Empty portfolio scenarios
 * - Cache hit/miss workflows
 * - Input validation
 * - Sort order validation
 * - Aggregation correctness
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExecuteGetUserPortfolio } from '../../src/tools/user-portfolio';
import * as graphqlClientModule from '../../src/graphql/client';
import { cache, cacheKeys } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';
import { parseJsonWithDisclaimer } from '../helpers/json-parser';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

// Helper function to create mock vault data
function createMockVault(overrides: any = {}): any {
  return {
    address: overrides.address || '0xvault1234567890123456789012345678901234',
    symbol: overrides.symbol || 'VAULT1',
    name: overrides.name || 'Test Vault 1',
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
      address: overrides.assetAddress || '0xasset1234567890123456789012345678901234',
      symbol: overrides.assetSymbol || 'USDC',
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
      pendingSettlement: { assets: '0', assetsUsd: 0 },
      pendingSiloBalances: { assets: '0', shares: '0' },
      liveAPR: {
        grossApr: 0.051,
        name: 'Live APR',
        netApr: 0.041,
        description: 'Current live APR',
      },
      inceptionApr: {
        linearNetApr: 0.05,
        linearNetAprWithoutExtraYields: 0.045,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      weeklyApr: {
        linearNetApr: 0.048,
        linearNetAprWithoutExtraYields: 0.043,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      monthlyApr: {
        linearNetApr: 0.052,
        linearNetAprWithoutExtraYields: 0.047,
        airdrops: [],
        incentives: [],
        nativeYields: [],
      },
      yearlyApr: {
        linearNetApr: 0.055,
        linearNetAprWithoutExtraYields: 0.05,
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
      performanceFee: 0.1,
      protocolFee: 0,
      isWhitelistActivated: false,
      whitelist: null,
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
      aboutDescription: 'Professional integrator',
    },
    defiIntegrations: [
      {
        name: 'Aave',
        description: 'Lending protocol',
        logoUrl: 'https://example.com/aave.png',
        link: 'https://aave.com',
        type: 'lending',
      },
    ],
    ...overrides,
  };
}

describe('get_user_portfolio Tool', () => {
  const mockUserAddress = '0x1234567890123456789012345678901234567890';

  // Executor function created from factory with mock container
  let executeGetUserPortfolio: ReturnType<typeof createExecuteGetUserPortfolio>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executeGetUserPortfolio = createExecuteGetUserPortfolio(mockContainer);
  });

  afterEach(() => {
    cache.flushAll();
  });

  describe('User Portfolio Query', () => {
    it('should fetch user portfolio from all chains', async () => {
      // Arrange
      const mockResponse = {
        users: {
          items: [
            {
              vaultPositions: [
                {
                  vault: createMockVault({ address: '0xv1', symbol: 'V1', name: 'Vault 1' }),
                  state: { shares: '1000', assets: '1000', sharesUsd: '1000' },
                },
              ],
              state: { totalSharesUsd: '1000' },
            },
          ],
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        userAddress: mockUserAddress,
      };

      // Act
      await executeGetUserPortfolio(input);

      // Assert - Verify raw GraphQL response is cached (not transformed)
      const cacheKey = cacheKeys.userPortfolio(mockUserAddress);
      const cachedData = cache.get(cacheKey);
      expect(cachedData).toBeDefined();
      expect(cachedData).toHaveProperty('users');
      expect((cachedData as any).users).toHaveProperty('items');
    });

    it('should return cached data without querying main portfolio GraphQL', async () => {
      // Arrange - Cache raw GraphQL response (not transformed)
      const cachedGraphQLResponse = {
        users: {
          items: [
            {
              vaultPositions: [
                {
                  vault: createMockVault({
                    address: '0xv1',
                    symbol: 'CACHED',
                    name: 'Cached Vault',
                  }),
                  state: { shares: '1000', assets: '1000', sharesUsd: '1000' },
                },
              ],
              state: { totalSharesUsd: '1000' },
            },
          ],
        },
      };

      const cacheKey = cacheKeys.userPortfolio(mockUserAddress);
      cache.set(cacheKey, cachedGraphQLResponse);

      // Mock composition query for the cached vault (composition enrichment happens after cache hit)
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValueOnce({
        vaultComposition: null,
      });

      const input = {
        userAddress: mockUserAddress,
      };

      // Act
      const result = await executeGetUserPortfolio(input);

      // Assert
      expect(result.isError).toBe(false);
      const data = parseJsonWithDisclaimer(result.content[0].text as string);
      expect(data.positions[0].vaultSymbol).toBe('CACHED');
      // Main portfolio query should not be called (cache hit), but composition query is made for enrichment
      // Only 1 call for the composition query, not the main portfolio query
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledTimes(1);
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('Sort Order Validation', () => {
    it('should sort positions by USD value in descending order', async () => {
      // Arrange
      const mockResponse1 = {
        users: {
          items: [
            {
              vaultPositions: [
                {
                  vault: createMockVault({ address: '0xv1', symbol: 'LOW', name: 'Low Value' }),
                  state: { shares: '100', assets: '100', sharesUsd: '100' },
                },
                {
                  vault: createMockVault({ address: '0xv2', symbol: 'HIGH', name: 'High Value' }),
                  state: { shares: '5000', assets: '5000', sharesUsd: '5000' },
                },
                {
                  vault: createMockVault({ address: '0xv3', symbol: 'MID', name: 'Mid Value' }),
                  state: { shares: '1000', assets: '1000', sharesUsd: '1000' },
                },
              ],
              state: { totalSharesUsd: '6100' },
            },
          ],
        },
      };

      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse1);

      const input = {
        userAddress: mockUserAddress,
      };

      // Act
      const result = await executeGetUserPortfolio(input);

      // Assert
      const data = parseJsonWithDisclaimer(result.content[0].text as string);
      expect(data.positions).toHaveLength(3);
      expect(data.positions[0].vaultSymbol).toBe('HIGH'); // 5000 USD
      expect(data.positions[1].vaultSymbol).toBe('MID'); // 1000 USD
      expect(data.positions[2].vaultSymbol).toBe('LOW'); // 100 USD
    });
  });

  describe('Aggregation Correctness', () => {
    it('should correctly aggregate total value from user state', async () => {
      // Arrange
      const mockResponse = {
        users: {
          items: [
            {
              vaultPositions: [
                {
                  vault: createMockVault({ address: '0xv1', symbol: 'V1' }),
                  state: { shares: '1000', assets: '1000', sharesUsd: '1234.56' },
                },
                {
                  vault: createMockVault({ address: '0xv2', symbol: 'V2' }),
                  state: { shares: '2000', assets: '2000', sharesUsd: '7890.12' },
                },
              ],
              state: { totalSharesUsd: '9124.68' },
            },
          ],
        },
      };

      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        userAddress: mockUserAddress,
      };

      // Act
      const result = await executeGetUserPortfolio(input);

      // Assert
      const data = parseJsonWithDisclaimer(result.content[0].text as string);
      expect(data.totalValueUsd).toBe('9124.68');
      expect(data.positionCount).toBe(2);
    });
  });
});
