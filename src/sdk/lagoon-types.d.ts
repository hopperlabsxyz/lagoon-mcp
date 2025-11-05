/**
 * Type declarations for Lagoon Protocol SDK
 *
 * Augments @lagoon-protocol/v0-core to properly export VaultUtils namespace.
 * This is needed because the package exports VaultUtils at runtime but TypeScript
 * doesn't see it in the type definitions with our module resolution settings.
 */

declare module '@lagoon-protocol/v0-core' {
  export namespace VaultUtils {
    function convertToAssets(
      shares: bigint | string | number,
      state: {
        totalAssets: bigint | string | number;
        totalSupply: bigint | string | number;
        decimalsOffset: bigint | string | number;
      },
      rounding?: 'Up' | 'Down'
    ): bigint;

    function convertToShares(
      assets: bigint | string | number,
      state: {
        totalAssets: bigint | string | number;
        totalSupply: bigint | string | number;
        decimalsOffset: bigint | string | number;
      },
      rounding?: 'Up' | 'Down'
    ): bigint;
  }
}
