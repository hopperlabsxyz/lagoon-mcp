/**
 * Type declarations for Lagoon Protocol SDK
 *
 * This file provides TypeScript type declarations for the Lagoon SDK packages
 * that don't export proper types. The actual packages work correctly at runtime
 * (verified by passing tests), but TypeScript needs these declarations for compilation.
 */

/**
 * Type declarations for @lagoon-protocol/v0-core
 * Augments the package to properly export VaultUtils namespace
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

/**
 * Type declarations for @lagoon-protocol/v0-computation
 * Uses flexible types that match runtime behavior
 */
declare module '@lagoon-protocol/v0-computation' {
  export type VersionOrLatest = string;
  export type SimulationInput = Record<string, unknown>;
  export type VaultForSimulation = Record<string, unknown>;

  export interface SimulationResult {
    totalSupply: bigint;
    totalAssets: bigint;
    feesAccrued: bigint;
    pricePerShare: bigint;
  }

  export function simulate(vault: VaultForSimulation, input: SimulationInput): SimulationResult;

  export function getLastPeriodSummaryInDuration(...args: unknown[]): unknown;
}

/**
 * Type augmentation for generated GraphQL types
 * Re-exports all types and adds VaultData alias for backwards compatibility
 */
declare module '../types/generated.js' {
  export * from '../types/generated';
  import type { Vault } from '../types/generated';
  export type VaultData = Vault;
}

// Also export in the non-.js module path
declare module '../types/generated' {
  export type VaultData = import('../types/generated').Vault;
}
