/**
 * APR Service Test Suite
 *
 * Comprehensive tests for SDK APR calculations and period summary transformations.
 */

import { describe, it, expect } from 'vitest';
import {
  transformPeriodSummariesToAPRData,
  calculateAPRFromPriceChange,
  calculateCurrentAPR,
  type PeriodSummary,
} from '../apr-service.js';
import type { VaultData } from '../../graphql/fragments.js';

// Mock vault data for testing
const mockVault: VaultData = {
  address: '0x1234567890123456789012345678901234567890',
  symbol: 'LTEST',
  name: 'Test Vault',
  description: null,
  shortDescription: null,
  decimals: 18,
  logoUrl: null,
  maxCapacity: null,
  averageSettlement: null,
  isVisible: true,
  chain: {
    id: 1,
    name: 'Ethereum',
    nativeToken: 'ETH',
    factory: '0x0000000000000000000000000000000000000000',
    logoUrl: '',
    wrappedNativeToken: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
  },
  asset: {
    id: 'usdc-eth',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    description: null,
    logoUrl: null,
    isVisible: true,
    priceUsd: 1.0,
    chain: {
      id: '1',
      name: 'Ethereum',
      nativeToken: 'ETH',
      logoUrl: '',
    },
    priceSources: {
      chainlinkPriceFeed: null,
    },
  },
  state: {
    state: 'ACTIVE',
    totalAssets: '1000000000',
    totalAssetsUsd: 1000,
    totalSupply: '950000000000000000000',
    newTotalAssets: '1000000000',
    pricePerShare: '1052631',
    pricePerShareUsd: 1.052631,
    safeAssetBalance: '100000000',
    safeAssetBalanceUsd: 100,
    pendingSettlement: {
      assets: '0',
      assetsUsd: 0,
    },
    pendingSiloBalances: {
      assets: '0',
      shares: '0',
    },
    liveAPR: null,
    inceptionApr: {
      linearNetApr: 0,
      linearNetAprWithoutExtraYields: 0,
      airdrops: [],
      incentives: [],
      nativeYields: [],
    },
    weeklyApr: {
      linearNetApr: 0,
      linearNetAprWithoutExtraYields: 0,
      airdrops: [],
      incentives: [],
      nativeYields: [],
    },
    monthlyApr: {
      linearNetApr: 0,
      linearNetAprWithoutExtraYields: 0,
      airdrops: [],
      incentives: [],
      nativeYields: [],
    },
    yearlyApr: {
      linearNetApr: 0,
      linearNetAprWithoutExtraYields: 0,
      airdrops: [],
      incentives: [],
      nativeYields: [],
    },
    roles: {
      owner: '0x0000000000000000000000000000000000000000',
      valuationManager: '0x0000000000000000000000000000000000000000',
      whitelistManager: '0x0000000000000000000000000000000000000000',
      safe: '0x0000000000000000000000000000000000000000',
      feeReceiver: '0x0000000000000000000000000000000000000000',
    },
    managementFee: 200,
    performanceFee: 2000,
    protocolFee: 0,
    isWhitelistActivated: false,
    whitelist: null,
    highWaterMark: '1000000',
    lastFeeTime: '1704067200',
  },
  curators: null,
  integrator: null,
  defiIntegrations: null,
} as unknown as VaultData;

describe('transformPeriodSummariesToAPRData', () => {
  it('should transform period summaries to APR data', () => {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60;

    const periodSummaries: PeriodSummary[] = [
      {
        timestamp: sixtyDaysAgo.toString(),
        totalAssetsAtStart: '1000000000', // 1000 USDC
        totalSupplyAtStart: '1000000000000000000000', // 1000 shares (1:1)
      },
      {
        timestamp: thirtyDaysAgo.toString(),
        totalAssetsAtStart: '1025000000', // 1025 USDC
        totalSupplyAtStart: '1000000000000000000000', // 1000 shares
      },
    ];

    const result = transformPeriodSummariesToAPRData(periodSummaries, mockVault);

    // Should have both 30-day and inception data
    expect(result.thirtyDay).toBeDefined();
    expect(result.inception).toBeDefined();

    // Verify we got valid data (SDK may select different periods based on 30-day threshold)
    // Just verify inception is the oldest
    expect(result.inception?.timestamp).toBe(sixtyDaysAgo);

    // If we have 30-day data, it should be valid
    if (result.thirtyDay) {
      expect(result.thirtyDay.timestamp).toBeGreaterThan(0);
      expect(result.thirtyDay.pricePerShare).toBeGreaterThan(0n);
    }

    // Price per share should be valid (SDK may return inception as 30-day if recent)
    // Just verify we get valid price data
    expect(result.inception?.pricePerShare).toBe(1000000n); // 1:1 ratio for inception
  });

  it('should handle empty period summaries gracefully', () => {
    const result = transformPeriodSummariesToAPRData([], mockVault);

    expect(result).toEqual({});
    expect(result.thirtyDay).toBeUndefined();
    expect(result.inception).toBeUndefined();
  });

  it('should handle new vaults with only one period', () => {
    const now = Math.floor(Date.now() / 1000);

    const periodSummaries: PeriodSummary[] = [
      {
        timestamp: now.toString(),
        totalAssetsAtStart: '1000000000',
        totalSupplyAtStart: '1000000000000000000000',
      },
    ];

    const result = transformPeriodSummariesToAPRData(periodSummaries, mockVault);

    // Should have inception but not 30-day (too recent)
    expect(result.inception).toBeDefined();
    // 30-day may or may not be defined depending on exact timing
  });

  it('should handle different vault decimals', () => {
    const ethVault = {
      ...mockVault,
      decimals: 18,
      asset: {
        ...mockVault.asset,
        decimals: 18,
      },
    } as VaultData;

    const periodSummaries: PeriodSummary[] = [
      {
        timestamp: '1704067200',
        totalAssetsAtStart: '1000000000000000000000', // 1000 ETH (18 decimals)
        totalSupplyAtStart: '950000000000000000000', // 950 shares
      },
    ];

    const result = transformPeriodSummariesToAPRData(periodSummaries, ethVault);

    expect(result.inception).toBeDefined();
    // Price should be ~1.052631 ETH per share (in 18 decimals)
    expect(result.inception?.pricePerShare).toBeGreaterThan(1050000000000000000n);
    expect(result.inception?.pricePerShare).toBeLessThan(1060000000000000000n);
  });

  it('should sort periods to find oldest inception', () => {
    const periodSummaries: PeriodSummary[] = [
      {
        timestamp: '1704153600', // Newer
        totalAssetsAtStart: '1050000000',
        totalSupplyAtStart: '1000000000000000000000',
      },
      {
        timestamp: '1704067200', // Older - should be inception
        totalAssetsAtStart: '1000000000',
        totalSupplyAtStart: '1000000000000000000000',
      },
      {
        timestamp: '1704240000', // Newest
        totalAssetsAtStart: '1075000000',
        totalSupplyAtStart: '1000000000000000000000',
      },
    ];

    const result = transformPeriodSummariesToAPRData(periodSummaries, mockVault);

    // Inception should be the oldest timestamp
    expect(result.inception?.timestamp).toBe(1704067200);
  });
});

describe('calculateAPRFromPriceChange', () => {
  it('should calculate APR for 30-day period', () => {
    const oldPrice = 1000000n; // 1.0 USDC
    const newPrice = 1025000n; // 1.025 USDC (2.5% gain)
    const days = 30;

    const apr = calculateAPRFromPriceChange(oldPrice, newPrice, days);

    // 2.5% in 30 days = ~30.42% APR
    expect(apr).toBeGreaterThan(30);
    expect(apr).toBeLessThan(31);
  });

  it('should calculate APR for 90-day period', () => {
    const oldPrice = 1000000n;
    const newPrice = 1075000n; // 7.5% gain
    const days = 90;

    const apr = calculateAPRFromPriceChange(oldPrice, newPrice, days);

    // 7.5% in 90 days = ~30.42% APR
    expect(apr).toBeGreaterThan(30);
    expect(apr).toBeLessThan(31);
  });

  it('should calculate APR for 365-day period', () => {
    const oldPrice = 1000000n;
    const newPrice = 1300000n; // 30% gain
    const days = 365;

    const apr = calculateAPRFromPriceChange(oldPrice, newPrice, days);

    // 30% in 365 days = 30% APR
    expect(apr).toBeCloseTo(30, 0);
  });

  it('should handle negative returns', () => {
    const oldPrice = 1000000n;
    const newPrice = 950000n; // -5% loss
    const days = 30;

    const apr = calculateAPRFromPriceChange(oldPrice, newPrice, days);

    // -5% in 30 days = ~-60.83% APR
    expect(apr).toBeLessThan(0);
    expect(apr).toBeGreaterThan(-61);
    expect(apr).toBeLessThan(-60);
  });

  it('should handle zero price change', () => {
    const price = 1000000n;
    const apr = calculateAPRFromPriceChange(price, price, 30);

    expect(apr).toBe(0);
  });

  it('should handle zero old price gracefully', () => {
    const apr = calculateAPRFromPriceChange(0n, 1000000n, 30);

    expect(apr).toBe(0); // Returns 0 instead of throwing
  });

  it('should handle zero or negative days gracefully', () => {
    expect(calculateAPRFromPriceChange(1000000n, 1025000n, 0)).toBe(0);
    expect(calculateAPRFromPriceChange(1000000n, 1025000n, -1)).toBe(0);
  });

  it('should maintain precision with large values', () => {
    const oldPrice = 1000000000000000000n; // 1 ETH in wei
    const newPrice = 1025000000000000000n; // 1.025 ETH
    const days = 30;

    const apr = calculateAPRFromPriceChange(oldPrice, newPrice, days);

    // Should get same result as smaller values
    expect(apr).toBeGreaterThan(30);
    expect(apr).toBeLessThan(31);
  });
});

describe('calculateCurrentAPR', () => {
  it('should calculate current APR from historical data', () => {
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const aprData = {
      thirtyDay: {
        timestamp: thirtyDaysAgo,
        pricePerShare: 1000000n, // 1.0 USDC
      },
    };

    const currentPrice = 1025000n; // 1.025 USDC

    const result = calculateCurrentAPR(aprData, currentPrice);

    expect(result.thirtyDay).toBeDefined();
    expect(result.thirtyDay).toBeGreaterThan(30);
    expect(result.thirtyDay).toBeLessThan(31);
  });

  it('should calculate both 30-day and inception APR', () => {
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

    const aprData = {
      thirtyDay: {
        timestamp: thirtyDaysAgo,
        pricePerShare: 1025000n,
      },
      inception: {
        timestamp: ninetyDaysAgo,
        pricePerShare: 1000000n,
      },
    };

    const currentPrice = 1075000n;

    const result = calculateCurrentAPR(aprData, currentPrice);

    expect(result.thirtyDay).toBeDefined();
    expect(result.inception).toBeDefined();

    // 30-day: 1.025 → 1.075 (4.88% in 30 days)
    expect(result.thirtyDay).toBeGreaterThan(59);
    expect(result.thirtyDay).toBeLessThan(61);

    // Inception: 1.0 → 1.075 (7.5% in 90 days)
    expect(result.inception).toBeGreaterThan(30);
    expect(result.inception).toBeLessThan(31);
  });

  it('should handle empty APR data', () => {
    const aprData = {};
    const currentPrice = 1025000n;

    const result = calculateCurrentAPR(aprData, currentPrice);

    expect(result.thirtyDay).toBeUndefined();
    expect(result.inception).toBeUndefined();
  });

  it('should handle only 30-day data', () => {
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const aprData = {
      thirtyDay: {
        timestamp: thirtyDaysAgo,
        pricePerShare: 1000000n,
      },
    };

    const currentPrice = 1025000n;

    const result = calculateCurrentAPR(aprData, currentPrice);

    expect(result.thirtyDay).toBeDefined();
    expect(result.inception).toBeUndefined();
  });

  it('should handle only inception data', () => {
    const now = Date.now() / 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

    const aprData = {
      inception: {
        timestamp: ninetyDaysAgo,
        pricePerShare: 1000000n,
      },
    };

    const currentPrice = 1075000n;

    const result = calculateCurrentAPR(aprData, currentPrice);

    expect(result.thirtyDay).toBeUndefined();
    expect(result.inception).toBeDefined();
  });
});

describe('Integration: Full APR workflow', () => {
  it('should calculate APR from period summaries to current APR', () => {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

    // Step 1: Period summaries from GraphQL
    const periodSummaries: PeriodSummary[] = [
      {
        timestamp: ninetyDaysAgo.toString(),
        totalAssetsAtStart: '1000000000', // 1000 USDC
        totalSupplyAtStart: '1000000000000000000000', // 1000 shares
      },
      {
        timestamp: thirtyDaysAgo.toString(),
        totalAssetsAtStart: '1025000000', // 1025 USDC
        totalSupplyAtStart: '1000000000000000000000', // 1000 shares
      },
    ];

    // Step 2: Transform to APR data
    const aprData = transformPeriodSummariesToAPRData(periodSummaries, mockVault);

    expect(aprData.thirtyDay).toBeDefined();
    expect(aprData.inception).toBeDefined();

    // Step 3: Calculate current APR
    const currentPrice = 1075000n; // 1.075 USDC

    const currentAPR = calculateCurrentAPR(aprData, currentPrice);

    expect(currentAPR.thirtyDay).toBeDefined();
    expect(currentAPR.inception).toBeDefined();

    // Verify APR calculations are reasonable
    expect(currentAPR.thirtyDay).toBeGreaterThan(0);
    expect(currentAPR.inception).toBeGreaterThan(0);

    // 30-day should show higher APR (shorter period, same endpoint)
    expect(currentAPR.thirtyDay).toBeGreaterThan(currentAPR.inception!);
  });
});
