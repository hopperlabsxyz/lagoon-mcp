/**
 * Math Utilities Test Suite
 *
 * Comprehensive tests for BigInt mathematical operations and serialization.
 */

import { describe, it, expect } from 'vitest';
import {
  bigIntReplacer,
  safeBigIntStringify,
  formatBigInt,
  parseBigInt,
  isValidBigIntString,
  percentageChange,
  formatPercentageChange,
} from '../math-utils.js';

describe('bigIntReplacer', () => {
  it('should convert BigInt to string', () => {
    const result = bigIntReplacer('amount', 1000000000000000000n);
    expect(result).toBe('1000000000000000000');
  });

  it('should leave non-BigInt values unchanged', () => {
    expect(bigIntReplacer('str', 'hello')).toBe('hello');
    expect(bigIntReplacer('num', 42)).toBe(42);
    expect(bigIntReplacer('bool', true)).toBe(true);
    expect(bigIntReplacer('null', null)).toBe(null);
    expect(bigIntReplacer('undef', undefined)).toBe(undefined);
  });

  it('should handle objects with mixed types', () => {
    const obj = {
      bigint: 1000n,
      number: 42,
      string: 'test',
    };

    const result = JSON.parse(JSON.stringify(obj, bigIntReplacer)) as {
      bigint: string;
      number: number;
      string: string;
    };
    expect(result.bigint).toBe('1000');
    expect(result.number).toBe(42);
    expect(result.string).toBe('test');
  });
});

describe('safeBigIntStringify', () => {
  it('should stringify object with BigInt values', () => {
    const obj = { amount: 1000000000000000000n };
    const result = safeBigIntStringify(obj);

    expect(result).toContain('"amount"');
    expect(result).toContain('"1000000000000000000"');
    expect(() => {
      JSON.parse(result) as { amount: string };
    }).not.toThrow();
  });

  it('should handle nested objects with BigInt', () => {
    const obj = {
      vault: {
        balance: 5000000n,
        shares: 4500000n,
      },
    };

    const result = safeBigIntStringify(obj);
    const parsed = JSON.parse(result) as {
      vault: { balance: string; shares: string };
    };

    expect(parsed.vault.balance).toBe('5000000');
    expect(parsed.vault.shares).toBe('4500000');
  });

  it('should handle arrays with BigInt', () => {
    const obj = { amounts: [1000n, 2000n, 3000n] };
    const result = safeBigIntStringify(obj);
    const parsed = JSON.parse(result) as { amounts: string[] };

    expect(parsed.amounts).toEqual(['1000', '2000', '3000']);
  });
});

describe('formatBigInt', () => {
  it('should format 18-decimal values (ether)', () => {
    expect(formatBigInt(1500000000000000000n, 18)).toBe('1.500000000000000000');
    expect(formatBigInt(1000000000000000000n, 18)).toBe('1.000000000000000000');
    expect(formatBigInt(123456789012345678n, 18)).toBe('0.123456789012345678');
  });

  it('should format 6-decimal values (USDC)', () => {
    expect(formatBigInt(1500000n, 6)).toBe('1.500000');
    expect(formatBigInt(1000000n, 6)).toBe('1.000000');
    expect(formatBigInt(123456n, 6)).toBe('0.123456');
  });

  it('should handle zero decimals', () => {
    expect(formatBigInt(1500n, 0)).toBe('1500');
    expect(formatBigInt(0n, 0)).toBe('0');
  });

  it('should handle zero values', () => {
    expect(formatBigInt(0n, 18)).toBe('0.000000000000000000');
    expect(formatBigInt(0n, 6)).toBe('0.000000');
  });

  it('should pad fractional part with leading zeros', () => {
    expect(formatBigInt(1n, 18)).toBe('0.000000000000000001');
    expect(formatBigInt(100n, 18)).toBe('0.000000000000000100');
  });

  it('should throw on negative decimals', () => {
    expect(() => formatBigInt(1000n, -1)).toThrow('Decimals must be non-negative');
  });
});

describe('parseBigInt', () => {
  it('should parse decimal strings to BigInt', () => {
    expect(parseBigInt('1.5', 18)).toBe(1500000000000000000n);
    expect(parseBigInt('1.5', 6)).toBe(1500000n);
    expect(parseBigInt('0.123456', 6)).toBe(123456n);
  });

  it('should parse integer strings', () => {
    expect(parseBigInt('1000', 6)).toBe(1000000000n);
    expect(parseBigInt('1', 18)).toBe(1000000000000000000n);
  });

  it('should handle zero values', () => {
    expect(parseBigInt('0', 18)).toBe(0n);
    expect(parseBigInt('0.0', 18)).toBe(0n);
  });

  it('should pad short fractional parts', () => {
    expect(parseBigInt('1.5', 18)).toBe(1500000000000000000n);
    expect(parseBigInt('1.5', 6)).toBe(1500000n);
  });

  it('should throw on empty or invalid input', () => {
    expect(() => parseBigInt('', 18)).toThrow('Value cannot be empty');
    expect(() => parseBigInt('  ', 18)).toThrow('Value cannot be empty');
    expect(() => parseBigInt('abc', 18)).toThrow('Invalid integer format');
    expect(() => parseBigInt('1.2.3', 18)).toThrow('Invalid decimal format');
  });

  it('should throw on negative decimals', () => {
    expect(() => parseBigInt('1.5', -1)).toThrow('Decimals must be non-negative');
  });

  it('should throw on too many decimal places', () => {
    expect(() => parseBigInt('1.1234567', 6)).toThrow('Too many decimal places');
  });
});

describe('isValidBigIntString', () => {
  it('should validate correct BigInt strings', () => {
    expect(isValidBigIntString('1000000000000000000')).toBe(true);
    expect(isValidBigIntString('0')).toBe(true);
    expect(isValidBigIntString('123')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidBigIntString('')).toBe(false);
    expect(isValidBigIntString('  ')).toBe(false);
    expect(isValidBigIntString('abc')).toBe(false);
    expect(isValidBigIntString('1.5')).toBe(false);
    expect(isValidBigIntString('-100')).toBe(false);
    expect(isValidBigIntString('1e18')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(isValidBigIntString('  1000  ')).toBe(true);
    expect(isValidBigIntString('  ')).toBe(false);
  });
});

describe('percentageChange', () => {
  it('should calculate positive percentage changes', () => {
    expect(percentageChange(1000000n, 1025000n)).toBe(250); // 2.50%
    expect(percentageChange(1000000n, 1100000n)).toBe(1000); // 10.00%
    expect(percentageChange(1000000n, 2000000n)).toBe(10000); // 100.00%
  });

  it('should calculate negative percentage changes', () => {
    expect(percentageChange(1000000n, 975000n)).toBe(-250); // -2.50%
    expect(percentageChange(1000000n, 900000n)).toBe(-1000); // -10.00%
    expect(percentageChange(1000000n, 500000n)).toBe(-5000); // -50.00%
  });

  it('should handle zero change', () => {
    expect(percentageChange(1000000n, 1000000n)).toBe(0);
  });

  it('should handle zero old value', () => {
    expect(percentageChange(0n, 1000000n)).toBe(Infinity);
    expect(percentageChange(0n, 0n)).toBe(0);
  });

  it('should handle large values with precision', () => {
    const old = 1000000000000000000n; // 1e18
    const newVal = 1050000000000000000n; // 1.05e18
    expect(percentageChange(old, newVal)).toBe(500); // 5.00%
  });
});

describe('formatPercentageChange', () => {
  it('should format positive changes', () => {
    expect(formatPercentageChange(250)).toBe('+2.50%');
    expect(formatPercentageChange(1000)).toBe('+10.00%');
    expect(formatPercentageChange(10000)).toBe('+100.00%');
  });

  it('should format negative changes', () => {
    expect(formatPercentageChange(-250)).toBe('-2.50%');
    expect(formatPercentageChange(-1000)).toBe('-10.00%');
    expect(formatPercentageChange(-5000)).toBe('-50.00%');
  });

  it('should format zero change', () => {
    expect(formatPercentageChange(0)).toBe('0.00%');
  });

  it('should handle infinity', () => {
    expect(formatPercentageChange(Infinity)).toBe('+∞%');
    expect(formatPercentageChange(-Infinity)).toBe('-∞%');
  });

  it('should format small changes with precision', () => {
    expect(formatPercentageChange(1)).toBe('+0.01%');
    expect(formatPercentageChange(-1)).toBe('-0.01%');
  });
});
