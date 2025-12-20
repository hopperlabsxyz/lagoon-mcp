/**
 * Safe Math Utilities
 *
 * Defensive arithmetic operations to prevent division by zero,
 * NaN propagation, and empty array exceptions.
 */

/**
 * Safe division with fallback value
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @param fallback - Value to return if division would fail (default: 0)
 * @returns Result of division or fallback if denominator is 0, NaN, or undefined
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator) || !Number.isFinite(numerator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Safe reduce with empty array guard
 * @param arr - Array to reduce
 * @param reducer - Reducer function
 * @param initial - Initial value
 * @param emptyFallback - Value to return if array is empty (defaults to initial)
 */
export function safeReduce<T, R>(
  arr: T[] | null | undefined,
  reducer: (acc: R, item: T, index: number) => R,
  initial: R,
  emptyFallback?: R
): R {
  if (!arr || arr.length === 0) {
    return emptyFallback !== undefined ? emptyFallback : initial;
  }
  return arr.reduce(reducer, initial);
}

/**
 * Safe average calculation
 * @param values - Array of numbers
 * @param fallback - Value to return if array is empty or all values are invalid
 */
export function safeAverage(values: number[] | null | undefined, fallback: number = 0): number {
  if (!values || values.length === 0) {
    return fallback;
  }
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) {
    return fallback;
  }
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

/**
 * Safe toFixed that handles NaN/undefined
 * @param value - Number to format
 * @param decimals - Decimal places
 * @param fallback - Fallback string if value is invalid
 */
export function safeToFixed(
  value: number | null | undefined,
  decimals: number = 2,
  fallback: string = 'N/A'
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Safe percentile calculation
 * Returns fallback for empty or single-element arrays (where percentile is meaningless)
 * @param value - The value to find percentile for
 * @param arr - Array of values to calculate percentile against
 * @param fallback - Fallback percentile for edge cases (default: 50)
 */
export function safePercentile(value: number, arr: number[], fallback: number = 50): number {
  // Guard: empty array
  if (!arr || arr.length === 0) {
    return fallback;
  }

  // Guard: single element - percentile is meaningless
  if (arr.length === 1) {
    return arr[0] === value ? fallback : 0;
  }

  const sorted = [...arr].sort((a, b) => a - b);
  const index = sorted.indexOf(value);
  if (index === -1) return 0;

  // sorted.length - 1 is now guaranteed > 0
  const percentile = (index / (sorted.length - 1)) * 100;
  return Math.round(percentile * 100) / 100;
}

/**
 * Guard for operations that require non-empty arrays
 * @param arr - Array to check
 * @param context - Context description for error message
 * @returns Object with isEmpty flag and optional data
 */
export function guardEmptyArray<T>(
  arr: T[] | null | undefined,
  context: string = 'operation'
): { isEmpty: true; message: string } | { isEmpty: false; data: T[] } {
  if (!arr || arr.length === 0) {
    return {
      isEmpty: true,
      message: `No data available for ${context}`,
    };
  }
  return { isEmpty: false, data: arr };
}

/**
 * Safe min/max finder that handles empty arrays
 * @param arr - Array of numbers
 * @param type - 'min' or 'max'
 * @param fallback - Fallback value if array is empty
 */
export function safeMinMax(
  arr: number[] | null | undefined,
  type: 'min' | 'max',
  fallback: number = 0
): number {
  if (!arr || arr.length === 0) {
    return fallback;
  }
  const validValues = arr.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) {
    return fallback;
  }
  return type === 'min' ? Math.min(...validValues) : Math.max(...validValues);
}
