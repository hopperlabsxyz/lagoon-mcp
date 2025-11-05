/**
 * APR Service Module
 *
 * Production-validated APR calculations using Lagoon SDK.
 * Patterns from frontend-dapp-v2/src/lib/manage/apr-data-service.ts
 *
 * @module sdk/apr-service
 */

import * as LagoonCore from '@lagoon-protocol/v0-core';
import { getLastPeriodSummaryInDuration } from '@lagoon-protocol/v0-computation';
import type { VaultData } from '../graphql/fragments/index.js';
import type { Vault } from '../types/generated.js';

/**
 * Duration constants (seconds)
 */
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * Period summary structure from GraphQL
 */
export interface PeriodSummary {
  timestamp: string;
  totalAssetsAtStart: string;
  totalSupplyAtStart: string;
}

/**
 * SDK-compatible period summary with BigInt timestamp
 */
interface SDKPeriodSummary {
  timestamp: bigint;
  totalAssetsAtStart: string;
  totalSupplyAtStart: string;
}

/**
 * APR historical data point
 */
export interface APRDataPoint {
  timestamp: number;
  pricePerShare: bigint;
}

/**
 * APR historical data structure
 */
export interface APRHistoricalData {
  thirtyDay?: APRDataPoint;
  inception?: APRDataPoint;
}

/**
 * Transform period summaries to APR historical data
 *
 * Production pattern from frontend-dapp-v2/src/lib/manage/apr-data-service.ts
 *
 * Extracts 30-day and inception data points using SDK's getLastPeriodSummaryInDuration.
 * Gracefully handles new vaults with no history (returns empty object).
 *
 * @param periodSummaries - Historical period summaries from GraphQL
 * @param vault - Vault data for decimal calculations
 * @returns APR historical data with optional 30-day and inception points
 *
 * @example
 * ```typescript
 * const aprData = transformPeriodSummariesToAPRData(periodSummaries, vault);
 *
 * if (aprData.thirtyDay) {
 *   console.log('30-day price:', aprData.thirtyDay.pricePerShare);
 *   console.log('Timestamp:', aprData.thirtyDay.timestamp);
 * }
 * ```
 */
export function transformPeriodSummariesToAPRData(
  periodSummaries: PeriodSummary[],
  vault: Vault | VaultData
): APRHistoricalData {
  // Graceful degradation for new vaults with no history
  if (!periodSummaries?.length) {
    return {};
  }

  try {
    // Transform to SDK format (BigInt timestamps for getLastPeriodSummaryInDuration)
    const sdkPeriodSummaries: SDKPeriodSummary[] = periodSummaries.map((ps) => ({
      ...ps,
      timestamp: BigInt(parseInt(ps.timestamp)),
    }));

    const result: APRHistoricalData = {};

    // Find 30-day data point using SDK function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- SDK function lacks proper type exports
    const thirtyDayPeriod = getLastPeriodSummaryInDuration(
      sdkPeriodSummaries,
      THIRTY_DAYS_SECONDS
    ) as SDKPeriodSummary | undefined;

    if (thirtyDayPeriod && typeof thirtyDayPeriod.timestamp === 'bigint') {
      // Find original period summary for conversion
      const original = periodSummaries.find(
        (ps) => ps.timestamp === thirtyDayPeriod.timestamp.toString()
      );

      if (original) {
        result.thirtyDay = {
          timestamp: Number(thirtyDayPeriod.timestamp),
          pricePerShare: calculatePricePerShareFromPeriod(original, vault as VaultData),
        };
      }
    }

    // Find inception (oldest) data point
    const sorted = [...periodSummaries].sort(
      (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
    );

    if (sorted[0]) {
      result.inception = {
        timestamp: parseInt(sorted[0].timestamp),
        pricePerShare: calculatePricePerShareFromPeriod(sorted[0], vault as VaultData),
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to transform period summaries:', error);
    return {}; // Graceful degradation on error
  }
}

/**
 * Calculate price per share from period summary
 *
 * Internal helper using VaultUtils.convertToAssets for protocol-accurate calculation.
 * Matches smart contract pricing logic.
 *
 * @param period - Period summary with historical vault state
 * @param vault - Vault data for decimal configuration
 * @returns Price per share in asset decimals
 *
 * @internal
 */
function calculatePricePerShareFromPeriod(period: PeriodSummary, vault: VaultData): bigint {
  const vaultDecimals = vault.decimals ?? 18;
  const assetDecimals = vault.asset.decimals;
  const decimalsOffset = vaultDecimals - assetDecimals;

  try {
    return LagoonCore.VaultUtils.convertToAssets(
      BigInt(1e18), // 1 share in wei (18 decimals)
      {
        totalAssets: BigInt(period.totalAssetsAtStart),
        totalSupply: BigInt(period.totalSupplyAtStart),
        decimalsOffset: BigInt(decimalsOffset),
      },
      'Down' // Round down for conservative pricing
    );
  } catch (error) {
    // Fallback to 1:1 ratio if calculation fails (e.g., zero supply)
    console.warn('Price per share calculation failed, using 1:1 ratio:', error);
    return BigInt(10 ** assetDecimals);
  }
}

/**
 * Calculate APR from price per share change
 *
 * Computes annualized percentage return based on price per share change over time.
 * Uses precise BigInt math to avoid floating-point errors.
 *
 * @param oldPrice - Historical price per share
 * @param newPrice - Current price per share
 * @param daysElapsed - Number of days between prices
 * @returns APR as percentage (e.g., 15.5 for 15.5%)
 *
 * @example
 * ```typescript
 * const apr = calculateAPRFromPriceChange(
 *   1000000n,  // 1.0 USDC (6 decimals)
 *   1025000n,  // 1.025 USDC
 *   30         // 30 days
 * );
 * // => ~30.42% APR (2.5% in 30 days, annualized)
 * ```
 */
export function calculateAPRFromPriceChange(
  oldPrice: bigint,
  newPrice: bigint,
  daysElapsed: number
): number {
  if (oldPrice === 0n || daysElapsed <= 0) {
    return 0;
  }

  // Calculate percentage change with 10000x scaling for precision
  const priceChange = ((newPrice - oldPrice) * 10000n) / oldPrice;

  // Annualize: multiply by (365 / daysElapsed)
  const annualizedChange = (Number(priceChange) * 365) / daysElapsed;

  // Convert from basis points to percentage (divide by 100)
  return annualizedChange / 100;
}

/**
 * Calculate current APR from historical data
 *
 * Convenience function that combines APR historical data with current price
 * to compute 30-day and inception APR values.
 *
 * @param aprData - APR historical data with 30-day and/or inception points
 * @param currentPricePerShare - Current price per share
 * @returns Object with 30-day and inception APR values (undefined if no data)
 *
 * @example
 * ```typescript
 * const aprs = calculateCurrentAPR(aprData, currentPrice);
 *
 * if (aprs.thirtyDay !== undefined) {
 *   console.log(`30-day APR: ${aprs.thirtyDay.toFixed(2)}%`);
 * }
 * ```
 */
export function calculateCurrentAPR(
  aprData: APRHistoricalData,
  currentPricePerShare: bigint
): { thirtyDay?: number; inception?: number } {
  const result: { thirtyDay?: number; inception?: number } = {};

  if (aprData.thirtyDay) {
    const daysElapsed = (Date.now() / 1000 - aprData.thirtyDay.timestamp) / (24 * 60 * 60);

    if (daysElapsed > 0) {
      result.thirtyDay = calculateAPRFromPriceChange(
        aprData.thirtyDay.pricePerShare,
        currentPricePerShare,
        daysElapsed
      );
    }
  }

  if (aprData.inception) {
    const daysElapsed = (Date.now() / 1000 - aprData.inception.timestamp) / (24 * 60 * 60);

    if (daysElapsed > 0) {
      result.inception = calculateAPRFromPriceChange(
        aprData.inception.pricePerShare,
        currentPricePerShare,
        daysElapsed
      );
    }
  }

  return result;
}
