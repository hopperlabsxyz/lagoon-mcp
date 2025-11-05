/**
 * Vault Utilities
 *
 * Internal wrapper utilities for Lagoon SDK VaultUtils.
 * Production-validated patterns from frontend-dapp-v2 for share/asset conversions.
 *
 * @module sdk/vault-utils
 */

import * as LagoonCore from '@lagoon-protocol/v0-core';

/**
 * Vault state for conversions
 */
export interface VaultState {
  totalAssets: bigint;
  totalSupply: bigint;
  decimalsOffset: bigint;
}

/**
 * Calculate price per share
 *
 * Internal utility for computing current vault share price.
 * Used by simulation and performance tools internally.
 *
 * Production pattern from pricePerShareCalculations.ts - handles edge cases:
 * - Zero total supply (returns 1:1 ratio)
 * - Decimal offset mismatches
 * - Rounding modes for safety
 *
 * @param totalAssets - Total assets under management (in asset decimals)
 * @param totalSupply - Total shares outstanding (in vault decimals)
 * @param vaultDecimals - Vault token decimals (typically 18)
 * @param assetDecimals - Underlying asset decimals (e.g., 6 for USDC)
 * @returns Price per share in asset decimals (1 share = X assets)
 *
 * @example
 * ```typescript
 * // Vault with 1000 USDC (6 decimals) and 950 shares (18 decimals)
 * const pricePerShare = calculatePricePerShare(
 *   1000000000n,  // 1000 USDC in 6 decimals
 *   950000000000000000000n,  // 950 shares in 18 decimals
 *   18,
 *   6
 * );
 * // => ~1052631n (1.052631 USDC per share)
 * ```
 */
export function calculatePricePerShare(
  totalAssets: bigint,
  totalSupply: bigint,
  vaultDecimals: number,
  assetDecimals: number
): bigint {
  // Validate inputs
  if (vaultDecimals < 0 || assetDecimals < 0) {
    throw new Error('Decimals must be non-negative');
  }

  const decimalsOffset = vaultDecimals - assetDecimals;

  try {
    // Calculate price for 1 share (1e18 in wei)
    return LagoonCore.VaultUtils.convertToAssets(
      BigInt(1e18), // 1 share in wei (18 decimals)
      {
        totalAssets,
        totalSupply,
        decimalsOffset: BigInt(decimalsOffset),
      },
      'Down' // Round down for safety (conservative pricing)
    );
  } catch (error) {
    // Graceful fallback: 1:1 ratio if calculation fails
    // This happens for new vaults with zero supply
    console.warn('Price per share calculation failed, using 1:1 ratio:', error);
    return BigInt(10 ** assetDecimals);
  }
}

/**
 * Convert shares to assets
 *
 * Internal utility for calculating asset amount from shares.
 * Uses SDK's VaultUtils.convertToAssets with proper rounding.
 *
 * @param shares - Share amount to convert (in vault decimals)
 * @param totalAssets - Current total assets (in asset decimals)
 * @param totalSupply - Current total supply (in vault decimals)
 * @param decimalsOffset - Vault decimals - asset decimals
 * @param roundingMode - Rounding direction ('Up' for user favorable, 'Down' for protocol favorable)
 * @returns Asset amount (in asset decimals)
 *
 * @example
 * ```typescript
 * // Convert 10 shares to USDC
 * const assets = convertSharesToAssets(
 *   10000000000000000000n,  // 10 shares (18 decimals)
 *   1000000000n,            // 1000 USDC total (6 decimals)
 *   950000000000000000000n, // 950 shares total (18 decimals)
 *   12,                     // 18 - 6 = 12
 *   'Down'                  // Conservative for withdrawals
 * );
 * // => ~10526315n (~10.526315 USDC)
 * ```
 */
export function convertSharesToAssets(
  shares: bigint,
  totalAssets: bigint,
  totalSupply: bigint,
  decimalsOffset: number,
  roundingMode: 'Up' | 'Down' = 'Down'
): bigint {
  if (shares < 0n || totalAssets < 0n || totalSupply < 0n) {
    throw new Error('Values must be non-negative');
  }

  return LagoonCore.VaultUtils.convertToAssets(
    shares,
    { totalAssets, totalSupply, decimalsOffset: BigInt(decimalsOffset) },
    roundingMode
  );
}

/**
 * Convert assets to shares
 *
 * Internal utility for calculating share amount from assets.
 * Uses SDK's VaultUtils.convertToShares with proper rounding.
 *
 * @param assets - Asset amount to convert (in asset decimals)
 * @param totalAssets - Current total assets (in asset decimals)
 * @param totalSupply - Current total supply (in vault decimals)
 * @param decimalsOffset - Vault decimals - asset decimals
 * @param roundingMode - Rounding direction ('Up' for protocol favorable, 'Down' for user favorable)
 * @returns Share amount (in vault decimals)
 *
 * @example
 * ```typescript
 * // Convert 100 USDC to shares
 * const shares = convertAssetsToShares(
 *   100000000n,             // 100 USDC (6 decimals)
 *   1000000000n,            // 1000 USDC total (6 decimals)
 *   950000000000000000000n, // 950 shares total (18 decimals)
 *   12,                     // 18 - 6 = 12
 *   'Up'                    // Conservative for deposits
 * );
 * // => ~95000000000000000000n (~95 shares)
 * ```
 */
export function convertAssetsToShares(
  assets: bigint,
  totalAssets: bigint,
  totalSupply: bigint,
  decimalsOffset: number,
  roundingMode: 'Up' | 'Down' = 'Up'
): bigint {
  if (assets < 0n || totalAssets < 0n || totalSupply < 0n) {
    throw new Error('Values must be non-negative');
  }

  return LagoonCore.VaultUtils.convertToShares(
    assets,
    { totalAssets, totalSupply, decimalsOffset: BigInt(decimalsOffset) },
    roundingMode
  );
}

/**
 * Build vault state object
 *
 * Convenience helper to construct VaultState from raw values.
 * Validates inputs and handles type conversions.
 *
 * @param totalAssets - Total assets (can be bigint or string)
 * @param totalSupply - Total supply (can be bigint or string)
 * @param vaultDecimals - Vault decimals
 * @param assetDecimals - Asset decimals
 * @returns Validated vault state object
 *
 * @example
 * ```typescript
 * const state = buildVaultState(
 *   "1000000000",
 *   "950000000000000000000",
 *   18,
 *   6
 * );
 * // => { totalAssets: 1000000000n, totalSupply: 950...n, decimalsOffset: 12n }
 * ```
 */
export function buildVaultState(
  totalAssets: bigint | string,
  totalSupply: bigint | string,
  vaultDecimals: number,
  assetDecimals: number
): VaultState {
  const assets = typeof totalAssets === 'string' ? BigInt(totalAssets) : totalAssets;
  const supply = typeof totalSupply === 'string' ? BigInt(totalSupply) : totalSupply;

  if (assets < 0n || supply < 0n) {
    throw new Error('Vault state values must be non-negative');
  }

  if (vaultDecimals < 0 || assetDecimals < 0) {
    throw new Error('Decimals must be non-negative');
  }

  const decimalsOffset = BigInt(vaultDecimals - assetDecimals);

  return {
    totalAssets: assets,
    totalSupply: supply,
    decimalsOffset,
  };
}
