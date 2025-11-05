/**
 * Vault Utilities Test Suite
 *
 * Comprehensive tests for SDK VaultUtils wrappers and conversion functions.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePricePerShare,
  convertSharesToAssets,
  convertAssetsToShares,
  buildVaultState,
} from '../vault-utils.js';

describe('calculatePricePerShare', () => {
  it('should calculate price per share for USDC vault (6 decimals)', () => {
    // Vault with 1000 USDC and 950 shares
    const pricePerShare = calculatePricePerShare(
      1000000000n, // 1000 USDC (6 decimals)
      950000000000000000000n, // 950 shares (18 decimals)
      18,
      6
    );

    // Expect ~1.052631 USDC per share
    expect(pricePerShare).toBeGreaterThan(1050000n);
    expect(pricePerShare).toBeLessThan(1060000n);
  });

  it('should calculate price per share for ETH vault (18 decimals)', () => {
    // Vault with 10 ETH and 9.5 shares
    const pricePerShare = calculatePricePerShare(
      10000000000000000000n, // 10 ETH (18 decimals)
      9500000000000000000n, // 9.5 shares (18 decimals)
      18,
      18
    );

    // Expect ~1.052631 ETH per share
    expect(pricePerShare).toBeGreaterThan(1050000000000000000n);
    expect(pricePerShare).toBeLessThan(1060000000000000000n);
  });

  it('should handle 1:1 ratio for new vaults', () => {
    // New vault: first deposit
    const pricePerShare = calculatePricePerShare(
      1000000n, // 1 USDC
      1000000000000000000n, // 1 share
      18,
      6
    );

    expect(pricePerShare).toBe(1000000n); // 1:1 ratio
  });

  it('should handle zero total supply gracefully', () => {
    // Empty vault - should fallback to 1:1
    const pricePerShare = calculatePricePerShare(0n, 0n, 18, 6);

    expect(pricePerShare).toBe(1000000n); // Fallback 1:1 ratio
  });

  it('should throw on negative decimals', () => {
    expect(() => calculatePricePerShare(1000000n, 1000000000000000000n, -1, 6)).toThrow(
      'Decimals must be non-negative'
    );

    expect(() => calculatePricePerShare(1000000n, 1000000000000000000n, 18, -1)).toThrow(
      'Decimals must be non-negative'
    );
  });
});

describe('convertSharesToAssets', () => {
  it('should convert shares to USDC assets', () => {
    // Convert 10 shares to USDC
    const assets = convertSharesToAssets(
      10000000000000000000n, // 10 shares (18 decimals)
      1000000000n, // 1000 USDC total (6 decimals)
      950000000000000000000n, // 950 shares total (18 decimals)
      12 // 18 - 6
    );

    // Expect ~10.526315 USDC
    expect(assets).toBeGreaterThan(10500000n);
    expect(assets).toBeLessThan(10600000n);
  });

  it('should convert shares to ETH assets', () => {
    // Convert 1 share to ETH
    const assets = convertSharesToAssets(
      1000000000000000000n, // 1 share (18 decimals)
      10000000000000000000n, // 10 ETH total (18 decimals)
      9500000000000000000n, // 9.5 shares total (18 decimals)
      0 // 18 - 18
    );

    // Expect ~1.052631 ETH
    expect(assets).toBeGreaterThan(1050000000000000000n);
    expect(assets).toBeLessThan(1060000000000000000n);
  });

  it('should handle zero shares', () => {
    const assets = convertSharesToAssets(0n, 1000000000n, 950000000000000000000n, 12);

    expect(assets).toBe(0n);
  });

  it('should respect rounding mode', () => {
    const shares = 10000000000000000000n;
    const totalAssets = 1000000001n; // Odd number to force rounding
    const totalSupply = 950000000000000000000n;

    const roundDown = convertSharesToAssets(shares, totalAssets, totalSupply, 12, 'Down');
    const roundUp = convertSharesToAssets(shares, totalAssets, totalSupply, 12, 'Up');

    expect(roundUp).toBeGreaterThanOrEqual(roundDown);
  });

  it('should throw on negative values', () => {
    expect(() => convertSharesToAssets(-1n, 1000000000n, 950000000000000000000n, 12)).toThrow(
      'Values must be non-negative'
    );
  });
});

describe('convertAssetsToShares', () => {
  it('should convert USDC assets to shares', () => {
    // Convert 100 USDC to shares
    const shares = convertAssetsToShares(
      100000000n, // 100 USDC (6 decimals)
      1000000000n, // 1000 USDC total (6 decimals)
      950000000000000000000n, // 950 shares total (18 decimals)
      12 // 18 - 6
    );

    // Expect ~95 shares (rounded up for safety)
    expect(shares).toBeGreaterThan(94000000000000000000n);
    expect(shares).toBeLessThan(96000000000000000000n);
  });

  it('should convert ETH assets to shares', () => {
    // Convert 1 ETH to shares
    const shares = convertAssetsToShares(
      1000000000000000000n, // 1 ETH (18 decimals)
      10000000000000000000n, // 10 ETH total (18 decimals)
      9500000000000000000n, // 9.5 shares total (18 decimals)
      0 // 18 - 18
    );

    // Expect ~0.95 shares
    expect(shares).toBeGreaterThan(940000000000000000n);
    expect(shares).toBeLessThan(960000000000000000n);
  });

  it('should handle zero assets', () => {
    const shares = convertAssetsToShares(0n, 1000000000n, 950000000000000000000n, 12);

    expect(shares).toBe(0n);
  });

  it('should respect rounding mode', () => {
    const assets = 100000001n; // Odd number to force rounding
    const totalAssets = 1000000000n;
    const totalSupply = 950000000000000000000n;

    const roundDown = convertAssetsToShares(assets, totalAssets, totalSupply, 12, 'Down');
    const roundUp = convertAssetsToShares(assets, totalAssets, totalSupply, 12, 'Up');

    expect(roundUp).toBeGreaterThanOrEqual(roundDown);
  });

  it('should throw on negative values', () => {
    expect(() => convertAssetsToShares(-1n, 1000000000n, 950000000000000000000n, 12)).toThrow(
      'Values must be non-negative'
    );
  });
});

describe('buildVaultState', () => {
  it('should build vault state from bigint values', () => {
    const state = buildVaultState(1000000000n, 950000000000000000000n, 18, 6);

    expect(state.totalAssets).toBe(1000000000n);
    expect(state.totalSupply).toBe(950000000000000000000n);
    expect(state.decimalsOffset).toBe(12n);
  });

  it('should build vault state from string values', () => {
    const state = buildVaultState('1000000000', '950000000000000000000', 18, 6);

    expect(state.totalAssets).toBe(1000000000n);
    expect(state.totalSupply).toBe(950000000000000000000n);
    expect(state.decimalsOffset).toBe(12n);
  });

  it('should handle mixed types', () => {
    const state = buildVaultState(1000000000n, '950000000000000000000', 18, 6);

    expect(state.totalAssets).toBe(1000000000n);
    expect(state.totalSupply).toBe(950000000000000000000n);
  });

  it('should handle zero decimals offset', () => {
    const state = buildVaultState(1000000000000000000n, 950000000000000000n, 18, 18);

    expect(state.decimalsOffset).toBe(0n);
  });

  it('should handle negative decimals offset', () => {
    // Rare case: asset has more decimals than vault
    const state = buildVaultState(1000000000000000000n, 950000000n, 6, 18);

    expect(state.decimalsOffset).toBe(-12n);
  });

  it('should throw on negative values', () => {
    expect(() => buildVaultState(-1n, 950000000000000000000n, 18, 6)).toThrow(
      'Vault state values must be non-negative'
    );

    expect(() => buildVaultState(1000000000n, -1n, 18, 6)).toThrow(
      'Vault state values must be non-negative'
    );
  });

  it('should throw on negative decimals', () => {
    expect(() => buildVaultState(1000000000n, 950000000000000000000n, -1, 6)).toThrow(
      'Decimals must be non-negative'
    );

    expect(() => buildVaultState(1000000000n, 950000000000000000000n, 18, -1)).toThrow(
      'Decimals must be non-negative'
    );
  });
});

describe('Integration: Full conversion flow', () => {
  it('should perform round-trip conversion (assets → shares → assets)', () => {
    const originalAssets = 100000000n; // 100 USDC
    const totalAssets = 1000000000n;
    const totalSupply = 950000000000000000000n;
    const decimalsOffset = 12;

    // Convert assets to shares
    const shares = convertAssetsToShares(
      originalAssets,
      totalAssets,
      totalSupply,
      decimalsOffset,
      'Up'
    );

    // Convert shares back to assets
    const finalAssets = convertSharesToAssets(
      shares,
      totalAssets,
      totalSupply,
      decimalsOffset,
      'Down'
    );

    // Should be approximately equal (within rounding tolerance)
    const diff =
      originalAssets > finalAssets ? originalAssets - finalAssets : finalAssets - originalAssets;

    expect(diff).toBeLessThan(100n); // Less than 0.0001 USDC difference
  });

  it('should maintain consistency across decimal scales', () => {
    // Test with USDC (6 decimals)
    const usdcState = buildVaultState(1000000000n, 950000000000000000000n, 18, 6);

    const usdcPrice = calculatePricePerShare(usdcState.totalAssets, usdcState.totalSupply, 18, 6);

    // Test with ETH (18 decimals, same ratio)
    const ethState = buildVaultState(
      1000000000000000000000n, // 1000 ETH
      950000000000000000000n, // 950 shares
      18,
      18
    );

    const ethPrice = calculatePricePerShare(ethState.totalAssets, ethState.totalSupply, 18, 18);

    // Prices should have same ratio despite different decimals
    // USDC: ~1.052631 (6 decimals) = 1052631
    // ETH: ~1.052631 (18 decimals) = 1052631578947368421
    const usdcRatio = (usdcPrice * 1000000n) / 1000000n; // Normalize to integer
    const ethRatio = (ethPrice * 1000000n) / 1000000000000000000n; // Normalize to integer

    expect(usdcRatio).toBe(ethRatio);
  });
});
