/**
 * BigInt Mathematical Utilities
 *
 * Production-validated utilities for safe BigInt operations and serialization.
 * Patterns from frontend-dapp-v2 ensuring no precision loss.
 *
 * @module sdk/math-utils
 */

/**
 * Safely serialize BigInt values to JSON
 *
 * Production pattern from frontend-dapp-v2 for JSON serialization of BigInt values.
 * Prevents TypeError: Do not know how to serialize a BigInt.
 *
 * @param _key - JSON key (unused but required by replacer signature)
 * @param value - Value to serialize
 * @returns Serializable value (BigInt → string, others unchanged)
 *
 * @example
 * ```typescript
 * const data = { amount: 1000000000000000000n };
 * JSON.stringify(data, bigIntReplacer);
 * // => '{"amount":"1000000000000000000"}'
 * ```
 */
export function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Stringify object with BigInt support
 *
 * Convenience wrapper for JSON.stringify with automatic BigInt handling.
 * Uses 2-space indentation for readability.
 *
 * @param obj - Object to stringify (may contain BigInt values)
 * @returns JSON string with BigInt values as strings
 *
 * @example
 * ```typescript
 * safeBigIntStringify({ balance: 1000000000000000000n });
 * // => '{\n  "balance": "1000000000000000000"\n}'
 * ```
 */
export function safeBigIntStringify(obj: unknown): string {
  return JSON.stringify(obj, bigIntReplacer, 2);
}

/**
 * Format BigInt to human-readable decimal string
 *
 * Converts BigInt wei amounts to decimal representation with proper decimal placement.
 * No floating-point operations - pure integer math for precision.
 *
 * @param value - BigInt value in smallest unit (e.g., wei)
 * @param decimals - Number of decimal places (e.g., 18 for ether)
 * @returns Formatted decimal string (e.g., "1.500000000000000000")
 *
 * @example
 * ```typescript
 * formatBigInt(1500000000000000000n, 18);
 * // => "1.500000000000000000"
 *
 * formatBigInt(1000000n, 6);
 * // => "1.000000"
 * ```
 */
export function formatBigInt(value: bigint, decimals: number): string {
  if (decimals < 0) {
    throw new Error('Decimals must be non-negative');
  }

  if (decimals === 0) {
    return value.toString();
  }

  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const remainder = value % divisor;

  // Pad fractional part with leading zeros
  const fractionalPart = remainder.toString().padStart(decimals, '0');

  return `${integerPart}.${fractionalPart}`;
}

/**
 * Parse decimal string to BigInt
 *
 * Converts human-readable decimal to BigInt in smallest unit.
 * Validates input format and handles edge cases safely.
 *
 * @param value - Decimal string (e.g., "1.5" or "1500")
 * @param decimals - Target decimal places
 * @returns BigInt value in smallest unit
 * @throws {Error} If value format is invalid
 *
 * @example
 * ```typescript
 * parseBigInt("1.5", 18);
 * // => 1500000000000000000n
 *
 * parseBigInt("1000000", 6);
 * // => 1000000000000n
 * ```
 */
export function parseBigInt(value: string, decimals: number): bigint {
  if (!value || value.trim() === '') {
    throw new Error('Value cannot be empty');
  }

  if (decimals < 0) {
    throw new Error('Decimals must be non-negative');
  }

  const trimmed = value.trim();

  // Handle integer-only values
  if (!trimmed.includes('.')) {
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`Invalid integer format: ${value}`);
    }
    return BigInt(trimmed) * BigInt(10 ** decimals);
  }

  // Handle decimal values
  const parts = trimmed.split('.');

  if (parts.length > 2) {
    throw new Error(`Invalid decimal format: ${value}`);
  }

  const [integerPart, fractionalPart] = parts;

  if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(fractionalPart)) {
    throw new Error(`Invalid decimal format: ${value}`);
  }

  if (fractionalPart.length > decimals) {
    throw new Error(`Too many decimal places: ${value} (max: ${decimals})`);
  }

  // Pad fractional part to match decimals
  const paddedFractional = fractionalPart.padEnd(decimals, '0');

  return BigInt(integerPart) * BigInt(10 ** decimals) + BigInt(paddedFractional);
}

/**
 * Validate BigInt string format
 *
 * Checks if a string represents a valid BigInt (unsigned integer).
 * Returns false for negative numbers, decimals, or invalid formats.
 *
 * @param value - String to validate
 * @returns true if valid BigInt string, false otherwise
 *
 * @example
 * ```typescript
 * isValidBigIntString("1000000000000000000"); // => true
 * isValidBigIntString("1.5");                  // => false
 * isValidBigIntString("-100");                 // => false
 * isValidBigIntString("abc");                  // => false
 * ```
 */
export function isValidBigIntString(value: string): boolean {
  if (!value || value.trim() === '') {
    return false;
  }

  const trimmed = value.trim();

  // Must be digits only (no negative, no decimal)
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }

  try {
    BigInt(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate percentage change between two BigInt values
 *
 * Computes percentage change with high precision using integer math.
 * Returns result scaled to basis points (10000 = 100.00%).
 *
 * @param oldValue - Original value
 * @param newValue - New value
 * @returns Percentage change in basis points (e.g., 250 = 2.50%)
 *
 * @example
 * ```typescript
 * percentageChange(1000000n, 1025000n);
 * // => 250 (2.50% increase)
 *
 * percentageChange(1000000n, 975000n);
 * // => -250 (2.50% decrease)
 * ```
 */
export function percentageChange(oldValue: bigint, newValue: bigint): number {
  if (oldValue === 0n) {
    return newValue === 0n ? 0 : Infinity;
  }

  // Calculate change with 10000x scaling for basis points
  const change = ((newValue - oldValue) * 10000n) / oldValue;

  return Number(change);
}

/**
 * Format percentage change for display
 *
 * Converts basis points to human-readable percentage string.
 *
 * @param basisPoints - Percentage change in basis points
 * @returns Formatted percentage string with sign and symbol
 *
 * @example
 * ```typescript
 * formatPercentageChange(250);   // => "+2.50%"
 * formatPercentageChange(-250);  // => "-2.50%"
 * formatPercentageChange(0);     // => "0.00%"
 * ```
 */
export function formatPercentageChange(basisPoints: number): string {
  if (basisPoints === Infinity) {
    return '+∞%';
  }

  if (basisPoints === -Infinity) {
    return '-∞%';
  }

  const percentage = basisPoints / 100;
  const sign = percentage > 0 ? '+' : '';

  return `${sign}${percentage.toFixed(2)}%`;
}
