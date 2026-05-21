/**
 * Fee Formatting Utilities
 *
 * Single source of truth for converting Lagoon's basis-point fee values
 * (uint16 from GraphQL; `2000` = 20%) into percentages for display and risk
 * calculations.
 *
 * The SDK simulator (`@lagoon-protocol/v0-computation`) expects raw basis
 * points — do NOT use these helpers in the simulation path.
 *
 * Covers all fee fields on `VaultState`:
 *   - managementFee, performanceFee, protocolFee (legacy fee model)
 *   - entryRate, exitRate, haircutRate (v0.6+ fee model)
 *   - upcomingManagementFee, upcomingPerformanceFee (staged rates)
 */

const BASIS_POINTS_PER_PERCENT = 100;

/**
 * Convert a basis-point value to a decimal percentage.
 * `2000` → `20.0`. Returns `0` for `null`/`undefined`.
 */
export function basisPointsToPercent(bps: number | null | undefined): number {
  if (bps == null) return 0;
  return bps / BASIS_POINTS_PER_PERCENT;
}

/**
 * Format a basis-point value as a human-readable percentage string.
 * `2000` → `"20.00%"`. Returns `"N/A"` for `null`/`undefined`.
 */
export function formatBasisPointsAsPercent(bps: number | null | undefined, decimals = 2): string {
  if (bps == null) return 'N/A';
  return `${(bps / BASIS_POINTS_PER_PERCENT).toFixed(decimals)}%`;
}

/**
 * Apply `basisPointsToPercent` to every fee field on a VaultState-like
 * object. Returns a shallow copy with numeric percentages (not basis points).
 * Useful when emitting fees to a downstream consumer that expects %.
 */
export function normalizeFeesToPercent<
  T extends {
    managementFee?: number | null;
    performanceFee?: number | null;
    protocolFee?: number | null;
    entryRate?: number | null;
    exitRate?: number | null;
    haircutRate?: number | null;
    upcomingManagementFee?: number | null;
    upcomingPerformanceFee?: number | null;
  },
>(state: T): T {
  return {
    ...state,
    managementFee: basisPointsToPercent(state.managementFee),
    performanceFee: basisPointsToPercent(state.performanceFee),
    protocolFee: basisPointsToPercent(state.protocolFee),
    entryRate: basisPointsToPercent(state.entryRate),
    exitRate: basisPointsToPercent(state.exitRate),
    haircutRate: basisPointsToPercent(state.haircutRate),
    upcomingManagementFee:
      state.upcomingManagementFee == null
        ? null
        : basisPointsToPercent(state.upcomingManagementFee),
    upcomingPerformanceFee:
      state.upcomingPerformanceFee == null
        ? null
        : basisPointsToPercent(state.upcomingPerformanceFee),
  };
}
