/**
 * Vault Simulation Service
 *
 * Provides vault simulation functionality using Lagoon SDK's simulate() function.
 * Production patterns from frontend-dapp-v2.
 *
 * @module simulation-service
 */

import { simulate } from '@lagoon-protocol/v0-computation';
import type {
  SimulationInput,
  SimulationResult,
  VersionOrLatest,
} from '@lagoon-protocol/v0-computation';
import type { VaultData } from '../graphql/fragments/index.js';
import type { APRHistoricalData } from './apr-service.js';

/**
 * Map vault data to SDK simulation format
 *
 * Transforms VaultData from GraphQL into the format expected by the SDK's simulate() function.
 * Handles decimal offset calculations and fee rate conversions.
 *
 * @param vault - Vault data from GraphQL
 * @param newTotalAssets - Proposed total assets for simulation (in wei)
 * @returns Vault object in SDK format
 *
 * @example
 * ```typescript
 * const vaultForSimulation = mapVaultToSimulationFormat(vault, BigInt('1000000000000'));
 * // Returns: { decimals, underlyingDecimals, newTotalAssets, totalSupply, ... }
 * ```
 */
export function mapVaultToSimulationFormat(
  vault: VaultData,
  newTotalAssets: bigint
): {
  decimals: number;
  underlyingDecimals: number;
  newTotalAssets: bigint;
  totalSupply: bigint;
  totalAssets: bigint;
  highWaterMark: bigint;
  lastFeeTime: bigint;
  feeRates: {
    managementRate: number;
    performanceRate: number;
  };
  version: VersionOrLatest;
} {
  const vaultDecimals = Number(vault.decimals ?? 18);
  const assetDecimals = Number(vault.asset.decimals);

  return {
    decimals: vaultDecimals,
    underlyingDecimals: assetDecimals,
    newTotalAssets,
    totalSupply: BigInt(vault.state.totalSupply),
    totalAssets: BigInt(vault.state.totalAssets),
    highWaterMark: BigInt(vault.state.highWaterMark),
    lastFeeTime: BigInt(vault.state.lastFeeTime),
    feeRates: {
      managementRate: Number(vault.state.managementFee),
      performanceRate: Number(vault.state.performanceFee),
    },
    version: vault.state.version || 'latest',
  };
}

/**
 * Construct simulation input from vault state and parameters
 *
 * Builds the complete input object required by SDK's simulate() function,
 * including pending balances, settlement data, and optional APR historical data.
 *
 * @param vault - Vault data from GraphQL
 * @param newTotalAssets - Proposed total assets for simulation (in wei)
 * @param aprData - Optional APR historical data for yield calculations
 * @param settleDeposit - Whether to settle pending deposits (default: true)
 * @returns Complete simulation input object
 *
 * @example
 * ```typescript
 * const input = constructSimulationInput(
 *   vault,
 *   BigInt('5000000000'),
 *   aprData,
 *   true
 * );
 * ```
 */
export function constructSimulationInput(
  vault: VaultData,
  newTotalAssets: bigint,
  aprData?: APRHistoricalData,
  settleDeposit: boolean = true
): SimulationInput {
  return {
    totalAssetsForSimulation: newTotalAssets,
    assetsInSafe: BigInt(vault.state.safeAssetBalance ?? '0'),
    pendingSiloBalances: {
      assets: BigInt(vault.state.pendingSiloBalances?.assets ?? '0'),
      shares: BigInt(vault.state.pendingSiloBalances?.shares ?? '0'),
    },
    pendingSettlement: {
      assets: BigInt(vault.state.pendingSettlement?.assets ?? '0'),
      shares: BigInt(vault.state.pendingSettlement?.shares ?? '0'),
    },
    settleDeposit,
    inception: aprData?.inception,
    thirtyDay: aprData?.thirtyDay,
  };
}

/**
 * Simulate vault management with new total assets
 *
 * Main simulation function that orchestrates the complete simulation workflow:
 * 1. Validates input parameters
 * 2. Maps vault data to SDK format
 * 3. Constructs simulation input
 * 4. Executes SDK simulation
 * 5. Returns detailed simulation results
 *
 * This function uses the Lagoon SDK's simulate() function which performs
 * protocol-accurate calculations for:
 * - Fee accruals (management and performance)
 * - Share price changes
 * - Settlement requirements
 * - APR calculations (when historical data provided)
 *
 * @param vault - Vault data from GraphQL (required)
 * @param newTotalAssets - Proposed total assets after deposit/withdrawal (required, must be > 0)
 * @param aprData - Optional APR historical data for yield projections
 * @param settleDeposit - Whether to settle pending deposits (default: true)
 * @returns Detailed simulation results from SDK
 * @throws {Error} If vault data is missing
 * @throws {Error} If newTotalAssets is <= 0
 * @throws {Error} If SDK simulation fails
 *
 * @example
 * ```typescript
 * // Simulate a deposit
 * const result = await simulateVaultManagement(
 *   vault,
 *   BigInt('2000000000000'), // +1000 tokens
 *   aprData,
 *   true
 * );
 *
 * console.log(result.totalSupply); // New share supply
 * console.log(result.feesAccrued); // Fees charged
 * ```
 */
export function simulateVaultManagement(
  vault: VaultData,
  newTotalAssets: bigint,
  aprData?: APRHistoricalData,
  settleDeposit: boolean = true
): SimulationResult {
  // Validation
  if (!vault) {
    throw new Error('Vault data is required for simulation');
  }

  if (newTotalAssets <= 0n) {
    throw new Error('New total assets must be positive');
  }

  // Map vault to SDK format
  const vaultForSimulation = mapVaultToSimulationFormat(vault, newTotalAssets);

  // Construct simulation input
  const simulationInput = constructSimulationInput(vault, newTotalAssets, aprData, settleDeposit);

  // Execute simulation
  try {
    return simulate(vaultForSimulation, simulationInput);
  } catch (error) {
    throw new Error(
      `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
