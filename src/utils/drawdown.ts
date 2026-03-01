/**
 * Drawdown Analysis Utility
 *
 * Provides drawdown analysis for DeFi vault price history using a
 * running-maximum algorithm. Calculates maximum drawdown, duration,
 * recovery time, and current drawdown from all-time high.
 */

/** Seconds in one day, used for timestamp-to-days conversion */
const SECONDS_PER_DAY = 86400;

/**
 * A single price observation in a vault's history
 */
export interface PricePoint {
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Price per share or NAV value */
  value: number;
}

/**
 * Complete drawdown analysis result for a vault's price history
 */
export interface DrawdownAnalysis {
  /** Maximum drawdown as a percentage (0-100) */
  maxDrawdown: number;
  /** Duration from peak to trough in days */
  maxDrawdownDuration: number;
  /** Days from trough back to a new high, or null if not yet recovered */
  recoveryTime: number | null;
  /** Current drawdown from the all-time high as a percentage (0-100) */
  currentDrawdown: number;
  /** Highest observed value */
  peakValue: number;
  /** Lowest value during the max drawdown period */
  troughValue: number;
  /** Timestamp of the peak preceding the max drawdown */
  peakTimestamp: number;
  /** Timestamp of the trough during the max drawdown */
  troughTimestamp: number;
}

/**
 * Returns a zero-valued DrawdownAnalysis, used when input data is insufficient.
 */
function createEmptyAnalysis(): DrawdownAnalysis {
  return {
    maxDrawdown: 0,
    maxDrawdownDuration: 0,
    recoveryTime: null,
    currentDrawdown: 0,
    peakValue: 0,
    troughValue: 0,
    peakTimestamp: 0,
    troughTimestamp: 0,
  };
}

/**
 * Tracks state during the running-maximum drawdown scan
 */
interface DrawdownState {
  runningPeak: number;
  runningPeakTimestamp: number;
  maxDrawdownPct: number;
  maxDrawdownPeakValue: number;
  maxDrawdownPeakTimestamp: number;
  maxDrawdownTroughValue: number;
  maxDrawdownTroughTimestamp: number;
}

/**
 * Initialize drawdown tracking state from the first data point.
 *
 * @param first - The first price point in the sorted history
 * @returns Initial drawdown state
 */
function initializeState(first: PricePoint): DrawdownState {
  return {
    runningPeak: first.value,
    runningPeakTimestamp: first.timestamp,
    maxDrawdownPct: 0,
    maxDrawdownPeakValue: first.value,
    maxDrawdownPeakTimestamp: first.timestamp,
    maxDrawdownTroughValue: first.value,
    maxDrawdownTroughTimestamp: first.timestamp,
  };
}

/**
 * Process a single price point against the current drawdown state.
 * Updates running peak and max drawdown if a new worst drawdown is found.
 *
 * @param state - Current drawdown tracking state (mutated in place)
 * @param point - The price point to process
 */
function processPoint(state: DrawdownState, point: PricePoint): void {
  if (point.value >= state.runningPeak) {
    state.runningPeak = point.value;
    state.runningPeakTimestamp = point.timestamp;
    return;
  }

  const drawdownPct = ((state.runningPeak - point.value) / state.runningPeak) * 100;

  if (drawdownPct > state.maxDrawdownPct) {
    state.maxDrawdownPct = drawdownPct;
    state.maxDrawdownPeakValue = state.runningPeak;
    state.maxDrawdownPeakTimestamp = state.runningPeakTimestamp;
    state.maxDrawdownTroughValue = point.value;
    state.maxDrawdownTroughTimestamp = point.timestamp;
  }
}

/**
 * Find the recovery timestamp after the max drawdown trough.
 * Recovery occurs when the price reaches or exceeds the peak that preceded the drawdown.
 *
 * @param sorted - Time-sorted price history
 * @param troughTimestamp - Timestamp of the max drawdown trough
 * @param peakValue - The peak value that must be recovered to
 * @returns Recovery timestamp, or null if recovery has not occurred
 */
function findRecoveryTimestamp(
  sorted: PricePoint[],
  troughTimestamp: number,
  peakValue: number
): number | null {
  for (const point of sorted) {
    if (point.timestamp > troughTimestamp && point.value >= peakValue) {
      return point.timestamp;
    }
  }
  return null;
}

/**
 * Analyze drawdown characteristics from a vault's price history.
 *
 * Uses a running-maximum algorithm to efficiently compute:
 * - Maximum drawdown (peak-to-trough decline as a percentage)
 * - Drawdown duration (time from peak to trough)
 * - Recovery time (time from trough back to a new high)
 * - Current drawdown from the all-time high
 *
 * @param priceHistory - Array of timestamp/value pairs (need not be sorted)
 * @returns Complete drawdown analysis, or zero-valued result if fewer than 2 data points
 *
 * @example
 * ```typescript
 * const analysis = analyzeDrawdown([
 *   { timestamp: 1700000000, value: 1.00 },
 *   { timestamp: 1700086400, value: 1.05 },
 *   { timestamp: 1700172800, value: 0.95 },
 *   { timestamp: 1700259200, value: 1.10 },
 * ]);
 * // analysis.maxDrawdown ~= 9.52 (from 1.05 down to 0.95)
 * ```
 */
export function analyzeDrawdown(priceHistory: PricePoint[]): DrawdownAnalysis {
  if (priceHistory.length < 2) {
    return createEmptyAnalysis();
  }

  const sorted = [...priceHistory].sort((a, b) => a.timestamp - b.timestamp);

  const state = initializeState(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    processPoint(state, sorted[i]);
  }

  const lastPoint = sorted[sorted.length - 1];
  const allTimeHigh = Math.max(...sorted.map((p) => p.value));
  const currentDrawdown =
    allTimeHigh > 0 ? ((allTimeHigh - lastPoint.value) / allTimeHigh) * 100 : 0;

  const maxDrawdownDuration =
    (state.maxDrawdownTroughTimestamp - state.maxDrawdownPeakTimestamp) / SECONDS_PER_DAY;

  const recoveryTimestamp = findRecoveryTimestamp(
    sorted,
    state.maxDrawdownTroughTimestamp,
    state.maxDrawdownPeakValue
  );

  const recoveryTime =
    recoveryTimestamp !== null
      ? (recoveryTimestamp - state.maxDrawdownTroughTimestamp) / SECONDS_PER_DAY
      : null;

  return {
    maxDrawdown: state.maxDrawdownPct,
    maxDrawdownDuration,
    recoveryTime,
    currentDrawdown,
    peakValue: state.maxDrawdownPeakValue,
    troughValue: state.maxDrawdownTroughValue,
    peakTimestamp: state.maxDrawdownPeakTimestamp,
    troughTimestamp: state.maxDrawdownTroughTimestamp,
  };
}
