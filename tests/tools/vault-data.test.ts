/**
 * get_vault_data Tool Tests
 *
 * Tests for the get_vault_data tool handler covering:
 * - Cache miss → query → store workflow
 * - Cache hit → instant return
 * - Vault not found scenarios
 * - GraphQL error handling
 * - Invalid address format
 * - Cache expiration behavior
 *
 * Updated to match schema introspection results (2025-01-04)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExecuteGetVaultData } from '../../src/tools/vault-data';
import * as graphqlClientModule from '../../src/graphql/client';
import { cache, cacheKeys, cacheTTL } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';
import { parseJsonWithDisclaimer } from '../helpers/json-parser';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

/**
 * Helper to create complete mock vault response matching working query schema
 */
function createMockVaultResponse(overrides: any = {}): any {
  return {
    vaultByAddress: {
      // Core identification (no id, no inception)
      address: '0x1234567890123456789012345678901234567890',
      symbol: 'TEST-VAULT',
      name: 'Test Vault',
      description: 'Test vault description',
      shortDescription: 'Short description',
      decimals: 18,
      logoUrl: 'https://example.com/logo.png',

      // Configuration
      maxCapacity: '10000000000000000000000',
      averageSettlement: 24,
      isVisible: true,

      // Chain information (no id, no isVisible)
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

      // Asset information (with priceSources)
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

      // Vault state and financial metrics
      state: {
        // State
        state: 'ACTIVE',

        // Assets and shares
        totalAssets: '1000000000000000000000',
        totalAssetsUsd: 1000000,
        totalSupply: '1000000000000000000000',
        newTotalAssets: '1000000000000000000000',

        // Pricing
        pricePerShare: '1000000000000000000',
        pricePerShareUsd: 1.0,

        // Balances
        safeAssetBalance: '500000000000000000000',
        safeAssetBalanceUsd: 500000,

        // Pending operations
        pendingSettlement: {
          assets: '0',
          assetsUsd: 0,
        },
        pendingSiloBalances: {
          assets: '0',
          shares: '0',
        },

        // Live APR (with netApr/grossApr)
        liveAPR: {
          grossApr: 0.061,
          name: 'Live APR',
          netApr: 0.051,
          description: 'Current live APR',
        },

        // APR breakdown by time period (with full breakdown)
        inceptionApr: {
          linearNetApr: 0.05,
          linearNetAprWithoutExtraYields: 0.045,
          airdrops: [
            {
              name: 'Test Airdrop',
              apr: 0.01,
              description: 'Airdrop campaign',
              distributionTimestamp: '1735689600',
              endTimestamp: 1735689600,
              isEstimation: false,
              logoUrl: 'https://example.com/airdrop.png',
              multiplier: '2x',
              ppsIncrease: 0.005,
              startTimestamp: 1704067200,
            },
          ],
          incentives: [
            {
              name: 'Reward Program',
              apr: 0.02,
              aprDescription: '2% APR bonus',
              description: 'Incentive program',
              endTimestamp: 1735689600,
              incentiveRate: {
                incentiveAmount: '1000000000000000000',
                referenceToken: {
                  id: 'token-123',
                },
                referenceTokenAmount: '1000000000',
              },
            },
          ],
          nativeYields: [
            {
              name: 'Staking Yield',
              apr: 0.03,
              aprDescription: '3% staking APR',
              description: 'Native staking rewards',
              endTimestamp: null,
              isEstimation: false,
              logoUrl: 'https://example.com/yield.png',
              multiplier: null,
              startTimestamp: 1704067200,
            },
          ],
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

        // Roles (with feeReceiver)
        roles: {
          owner: '0xowner1234567890123456789012345678901234',
          valuationManager: '0xvaluation1234567890123456789012345678',
          whitelistManager: '0xwhitelist1234567890123456789012345678',
          safe: '0xsafe12345678901234567890123456789012345',
          feeReceiver: '0xfees12345678901234567890123456789012345',
        },

        // Fees
        managementFee: 0.02,
        performanceFee: 0.1,
        protocolFee: 0,

        // Whitelist configuration
        isWhitelistActivated: false,
        whitelist: null,

        // State metadata (no version)
        highWaterMark: '1100000000000000000',
        lastFeeTime: '1704067200',
      },

      // Curators (no isVisible)
      curators: [
        {
          id: 'curator-123',
          name: 'Test Curator',
          aboutDescription: 'Professional vault curator',
          logoUrl: 'https://example.com/curator.png',
          url: 'https://curator.example.com',
        },
      ],

      // Integrator (no isVisible, with aboutDescription)
      integrator: {
        name: 'Test Integrator',
        url: 'https://integrator.example.com',
        logoUrl: 'https://example.com/integrator.png',
        aboutDescription: 'DeFi integration platform',
      },

      // DeFi integrations only (no top-level airdrops, incentives, nativeYields, referral, bundles)
      defiIntegrations: [
        {
          name: 'Uniswap',
          description: 'DEX integration',
          logoUrl: 'https://example.com/uniswap.png',
          link: 'https://app.uniswap.org',
          type: 'DEX',
        },
      ],

      // Apply overrides
      ...overrides,
    },
  };
}

describe('get_vault_data Tool', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890';
  const mockChainId = 1;

  // Executor function created from factory with mock container
  let executeGetVaultData: ReturnType<typeof createExecuteGetVaultData>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executeGetVaultData = createExecuteGetVaultData(mockContainer);
  });

  afterEach(() => {
    cache.flushAll();
  });

  describe('Cache Miss → Query → Store Workflow', () => {
    it('should fetch vault data from GraphQL and cache it', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      };

      // Act
      const result = await executeGetVaultData(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('TEST-VAULT');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledOnce();

      // Verify data is cached
      const cacheKey = cacheKeys.vaultData(mockVaultAddress, mockChainId);
      const cachedData = cache.get(cacheKey);
      expect(cachedData).toBeDefined();
      expect(cachedData).toEqual(mockResponse);
    });

    it('should use correct cache TTL (15 minutes)', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultData({ vaultAddress: mockVaultAddress, chainId: mockChainId });

      // Assert - Verify cache TTL is 15 minutes (900 seconds)
      expect(cacheTTL.vaultData).toBe(900);
    });
  });

  describe('Cache Hit → Instant Return', () => {
    it('should return cached data without querying GraphQL', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse({
        symbol: 'CACHED-VAULT',
        name: 'Cached Vault',
      });

      // Pre-populate cache
      const cacheKey = cacheKeys.vaultData(mockVaultAddress, mockChainId);
      cache.set(cacheKey, mockResponse);

      const input = {
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      };

      // Act
      const result = await executeGetVaultData(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('CACHED-VAULT');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should cache data separately per vault address and chain', async () => {
      // Arrange
      const vault1 = createMockVaultResponse({
        symbol: 'VAULT-1',
        name: 'Vault 1',
        chain: { ...createMockVaultResponse().vaultByAddress.chain, id: '1' },
      });

      const vault2 = createMockVaultResponse({
        symbol: 'VAULT-2',
        name: 'Vault 2',
        chain: { ...createMockVaultResponse().vaultByAddress.chain, id: '42161', name: 'Arbitrum' },
      });

      vi.spyOn(graphqlClientModule.graphqlClient, 'request')
        .mockResolvedValueOnce(vault1)
        .mockResolvedValueOnce(vault2);

      // Act - Fetch vault on Ethereum
      const result1 = await executeGetVaultData({ vaultAddress: mockVaultAddress, chainId: 1 });

      // Act - Fetch same vault on Arbitrum
      const result2 = await executeGetVaultData({ vaultAddress: mockVaultAddress, chainId: 42161 });

      // Assert - Both should have different cached data
      expect(result1.content[0].text).toContain('VAULT-1');
      expect(result2.content[0].text).toContain('VAULT-2');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Vault Not Found', () => {
    it('should handle vault not found gracefully', async () => {
      // Arrange
      const mockResponse = {
        vaultByAddress: null,
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      };

      // Act
      const result = await executeGetVaultData(input);

      // Assert
      expect(result.isError).toBeFalsy(); // Not an error, just no data
      expect(result.content[0].text).toContain('Vault not found');
      expect(result.content[0].text).toContain('on requested chain');
    });

    it('should not cache vault not found responses', async () => {
      // Arrange
      const mockResponse = { vaultByAddress: null };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      await executeGetVaultData({ vaultAddress: mockVaultAddress, chainId: mockChainId });

      // Assert - Cache should be empty
      const cacheKey = cacheKeys.vaultData(mockVaultAddress, mockChainId);
      const cachedData = cache.get(cacheKey);
      expect(cachedData).toBeUndefined();
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('GraphQL Error Handling', () => {
    it('should handle GraphQL errors gracefully', async () => {
      // Arrange
      const graphqlError = {
        response: {
          errors: [
            {
              message: 'Field error: vaultByAddress',
            },
          ],
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(graphqlError);

      const input = {
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      };

      // Act
      const result = await executeGetVaultData(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('GraphQL Error');
    });

    it('should handle network errors', async () => {
      // Arrange
      const networkError = new Error('Network timeout');
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(networkError);

      const input = {
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      };

      // Act
      const result = await executeGetVaultData(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', () => {
      // Arrange & Act
      const key1 = cacheKeys.vaultData(mockVaultAddress, 1);
      const key2 = cacheKeys.vaultData(mockVaultAddress, 1);
      const key3 = cacheKeys.vaultData(mockVaultAddress, 42161);

      // Assert
      expect(key1).toBe(key2); // Same input = same key
      expect(key1).not.toBe(key3); // Different chain = different key
      expect(key1).toBe(`vault:${mockVaultAddress}:1`);
      expect(key3).toBe(`vault:${mockVaultAddress}:42161`);
    });
  });

  describe('Response Formatting', () => {
    it('should format response as pretty-printed JSON', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultData({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      });

      // Assert
      const responseText = result.content[0].text as string;
      expect(responseText).toContain('\n'); // Pretty-printed JSON has newlines
      expect(responseText).toContain('  '); // Should have indentation
      const parsed = parseJsonWithDisclaimer(responseText);
      // Response now includes structured fees object for easier consumption
      expect(parsed).toEqual({
        ...mockResponse,
        fees: {
          managementFee: mockResponse.vaultByAddress.state.managementFee,
          performanceFee: mockResponse.vaultByAddress.state.performanceFee,
        },
      });
    });
  });

  describe('New Schema Fields', () => {
    it('should include all new configuration fields', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultData({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      });

      // Assert
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      const vault = parsed.vaultByAddress;

      // Verify configuration fields exist (no inception field)
      expect(vault.description).toBeDefined();
      expect(vault.shortDescription).toBeDefined();
      expect(vault.logoUrl).toBeDefined();
      expect(vault.maxCapacity).toBeDefined();
      expect(vault.averageSettlement).toBeDefined();
      expect(vault.isVisible).toBeDefined();
    });

    it('should include chain relationship with all fields', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultData({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      });

      // Assert
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      const chain = parsed.vaultByAddress.chain;

      // Chain has no id field in working schema
      expect(chain.name).toBeDefined();
      expect(chain.nativeToken).toBeDefined();
      expect(chain.factory).toBeDefined();
      expect(chain.logoUrl).toBeDefined();
      expect(chain.wrappedNativeToken).toBeDefined();
    });

    it('should include complete state object with financial metrics', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultData({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      });

      // Assert
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      const state = parsed.vaultByAddress.state;

      // Verify state fields
      expect(state.totalAssets).toBeDefined();
      expect(state.totalAssetsUsd).toBeDefined();
      expect(state.pricePerShare).toBeDefined();
      expect(state.pricePerShareUsd).toBeDefined();
      expect(state.inceptionApr).toBeDefined();
      expect(state.weeklyApr).toBeDefined();
      expect(state.monthlyApr).toBeDefined();
      expect(state.yearlyApr).toBeDefined();
    });

    it('should include curators as array', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultData({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      });

      // Assert
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      const curators = parsed.vaultByAddress.curators;

      expect(Array.isArray(curators)).toBe(true);
      expect(curators.length).toBeGreaterThan(0);
      expect(curators[0].id).toBeDefined();
      expect(curators[0].name).toBeDefined();
    });

    it('should include financial relationships', async () => {
      // Arrange
      const mockResponse = createMockVaultResponse();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      // Act
      const result = await executeGetVaultData({
        vaultAddress: mockVaultAddress,
        chainId: mockChainId,
      });

      // Assert
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      const vault = parsed.vaultByAddress;

      // No top-level airdrops/incentives/nativeYields/referral in working schema
      // They exist within state.inceptionApr breakdown
      expect(vault.state.inceptionApr.airdrops).toBeDefined();
      expect(Array.isArray(vault.state.inceptionApr.airdrops)).toBe(true);
      expect(vault.state.inceptionApr.incentives).toBeDefined();
      expect(Array.isArray(vault.state.inceptionApr.incentives)).toBe(true);
      expect(vault.state.inceptionApr.nativeYields).toBeDefined();
      expect(Array.isArray(vault.state.inceptionApr.nativeYields)).toBe(true);
      expect(Array.isArray(vault.defiIntegrations)).toBe(true);
    });
  });
});
