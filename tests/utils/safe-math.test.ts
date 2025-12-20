/**
 * Tests for safe-math utility functions
 *
 * These utilities provide defensive programming patterns to prevent crashes
 * from division by zero, NaN/undefined values, and empty arrays.
 */

import { describe, it, expect } from 'vitest';
import {
  safeDivide,
  safeReduce,
  safeAverage,
  safeToFixed,
  safePercentile,
  guardEmptyArray,
  safeMinMax,
} from '../../src/utils/safe-math.js';

describe('safe-math utilities', () => {
  describe('safeDivide', () => {
    it('should perform normal division correctly', () => {
      expect(safeDivide(10, 2)).toBe(5);
      expect(safeDivide(100, 4)).toBe(25);
      expect(safeDivide(7, 2)).toBe(3.5);
    });

    it('should return fallback for division by zero', () => {
      expect(safeDivide(10, 0)).toBe(0);
      expect(safeDivide(10, 0, -1)).toBe(-1);
      expect(safeDivide(100, 0, 999)).toBe(999);
    });

    it('should return fallback for NaN denominator', () => {
      expect(safeDivide(10, NaN)).toBe(0);
      expect(safeDivide(10, NaN, -1)).toBe(-1);
    });

    it('should return fallback for NaN numerator', () => {
      expect(safeDivide(NaN, 10)).toBe(0);
      expect(safeDivide(NaN, 10, -1)).toBe(-1);
    });

    it('should return fallback for Infinity denominator', () => {
      expect(safeDivide(10, Infinity)).toBe(0);
      expect(safeDivide(10, -Infinity)).toBe(0);
    });

    it('should return fallback for Infinity numerator', () => {
      expect(safeDivide(Infinity, 10)).toBe(0);
      expect(safeDivide(-Infinity, 10)).toBe(0);
    });

    it('should handle negative numbers correctly', () => {
      expect(safeDivide(-10, 2)).toBe(-5);
      expect(safeDivide(10, -2)).toBe(-5);
      expect(safeDivide(-10, -2)).toBe(5);
    });

    it('should handle very small denominators without overflow', () => {
      expect(safeDivide(1, 0.0001)).toBe(10000);
    });
  });

  describe('safeReduce', () => {
    it('should reduce array correctly', () => {
      const sum = safeReduce([1, 2, 3, 4], (acc, val) => acc + val, 0);
      expect(sum).toBe(10);
    });

    it('should return initial value for empty array', () => {
      const result = safeReduce([], (acc, val: number) => acc + val, 0);
      expect(result).toBe(0);
    });

    it('should return emptyFallback for empty array when provided', () => {
      const result = safeReduce([], (acc, val: number) => acc + val, 0, -999);
      expect(result).toBe(-999);
    });

    it('should handle null array', () => {
      const result = safeReduce(null, (acc, val: number) => acc + val, 0, -1);
      expect(result).toBe(-1);
    });

    it('should handle undefined array', () => {
      const result = safeReduce(undefined, (acc, val: number) => acc + val, 0, -1);
      expect(result).toBe(-1);
    });

    it('should pass index to reducer', () => {
      const indices: number[] = [];
      safeReduce(
        [10, 20, 30],
        (acc, _val, index) => {
          indices.push(index);
          return acc;
        },
        0
      );
      expect(indices).toEqual([0, 1, 2]);
    });
  });

  describe('safeAverage', () => {
    it('should calculate average correctly', () => {
      expect(safeAverage([2, 4, 6])).toBe(4);
      expect(safeAverage([10])).toBe(10);
      expect(safeAverage([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should return fallback for empty array', () => {
      expect(safeAverage([])).toBe(0);
      expect(safeAverage([], 99)).toBe(99);
    });

    it('should return fallback for null array', () => {
      expect(safeAverage(null)).toBe(0);
      expect(safeAverage(null, -1)).toBe(-1);
    });

    it('should return fallback for undefined array', () => {
      expect(safeAverage(undefined)).toBe(0);
    });

    it('should filter out NaN values', () => {
      expect(safeAverage([2, NaN, 4])).toBe(3);
      expect(safeAverage([NaN, NaN, 6])).toBe(6);
    });

    it('should filter out Infinity values', () => {
      expect(safeAverage([2, Infinity, 4])).toBe(3);
      expect(safeAverage([2, -Infinity, 4])).toBe(3);
    });

    it('should return fallback if all values are invalid', () => {
      expect(safeAverage([NaN, Infinity, -Infinity])).toBe(0);
      expect(safeAverage([NaN, Infinity], 50)).toBe(50);
    });
  });

  describe('safeToFixed', () => {
    it('should format number correctly', () => {
      expect(safeToFixed(3.14159, 2)).toBe('3.14');
      expect(safeToFixed(100, 0)).toBe('100');
      expect(safeToFixed(1.5, 3)).toBe('1.500');
    });

    it('should return fallback for null', () => {
      expect(safeToFixed(null)).toBe('N/A');
      expect(safeToFixed(null, 2, '---')).toBe('---');
    });

    it('should return fallback for undefined', () => {
      expect(safeToFixed(undefined)).toBe('N/A');
      expect(safeToFixed(undefined, 2, '0.00')).toBe('0.00');
    });

    it('should return fallback for NaN', () => {
      expect(safeToFixed(NaN)).toBe('N/A');
      expect(safeToFixed(NaN, 2, 'Invalid')).toBe('Invalid');
    });

    it('should return fallback for Infinity', () => {
      expect(safeToFixed(Infinity)).toBe('N/A');
      expect(safeToFixed(-Infinity)).toBe('N/A');
    });

    it('should use default decimals of 2', () => {
      expect(safeToFixed(3.14159)).toBe('3.14');
    });
  });

  describe('safePercentile', () => {
    it('should calculate percentile correctly', () => {
      // In array [1,2,3,4,5], value 3 is at index 2 out of 4 intervals = 50%
      expect(safePercentile(3, [1, 2, 3, 4, 5])).toBe(50);
      // Value 5 is at index 4 = 100%
      expect(safePercentile(5, [1, 2, 3, 4, 5])).toBe(100);
      // Value 1 is at index 0 = 0%
      expect(safePercentile(1, [1, 2, 3, 4, 5])).toBe(0);
    });

    it('should return fallback for empty array', () => {
      expect(safePercentile(5, [])).toBe(50);
      expect(safePercentile(5, [], 0)).toBe(0);
    });

    it('should return fallback for single-element array when value matches', () => {
      expect(safePercentile(10, [10])).toBe(50);
      expect(safePercentile(10, [10], 75)).toBe(75);
    });

    it('should return 0 for single-element array when value does not match', () => {
      expect(safePercentile(5, [10])).toBe(0);
    });

    it('should return 0 if value not found in array', () => {
      expect(safePercentile(100, [1, 2, 3, 4, 5])).toBe(0);
    });

    it('should handle unsorted input array', () => {
      // Array [5,3,1,4,2] sorted is [1,2,3,4,5], value 3 is at index 2 = 50%
      expect(safePercentile(3, [5, 3, 1, 4, 2])).toBe(50);
    });
  });

  describe('guardEmptyArray', () => {
    it('should return isEmpty: false with data for non-empty array', () => {
      const result = guardEmptyArray([1, 2, 3]);
      expect(result.isEmpty).toBe(false);
      if (!result.isEmpty) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('should return isEmpty: true with message for empty array', () => {
      const result = guardEmptyArray([]);
      expect(result.isEmpty).toBe(true);
      if (result.isEmpty) {
        expect(result.message).toContain('No data available');
      }
    });

    it('should return isEmpty: true for null array', () => {
      const result = guardEmptyArray(null);
      expect(result.isEmpty).toBe(true);
    });

    it('should return isEmpty: true for undefined array', () => {
      const result = guardEmptyArray(undefined);
      expect(result.isEmpty).toBe(true);
    });

    it('should include context in error message', () => {
      const result = guardEmptyArray([], 'vault comparison');
      expect(result.isEmpty).toBe(true);
      if (result.isEmpty) {
        expect(result.message).toContain('vault comparison');
      }
    });
  });

  describe('safeMinMax', () => {
    it('should find min correctly', () => {
      expect(safeMinMax([5, 2, 8, 1, 9], 'min')).toBe(1);
      expect(safeMinMax([100], 'min')).toBe(100);
    });

    it('should find max correctly', () => {
      expect(safeMinMax([5, 2, 8, 1, 9], 'max')).toBe(9);
      expect(safeMinMax([100], 'max')).toBe(100);
    });

    it('should return fallback for empty array', () => {
      expect(safeMinMax([], 'min')).toBe(0);
      expect(safeMinMax([], 'max')).toBe(0);
      expect(safeMinMax([], 'min', -1)).toBe(-1);
    });

    it('should return fallback for null array', () => {
      expect(safeMinMax(null, 'min')).toBe(0);
      expect(safeMinMax(null, 'max', 999)).toBe(999);
    });

    it('should return fallback for undefined array', () => {
      expect(safeMinMax(undefined, 'min')).toBe(0);
    });

    it('should filter out NaN values', () => {
      expect(safeMinMax([5, NaN, 2], 'min')).toBe(2);
      expect(safeMinMax([5, NaN, 8], 'max')).toBe(8);
    });

    it('should filter out Infinity values', () => {
      expect(safeMinMax([5, Infinity, 2], 'min')).toBe(2);
      expect(safeMinMax([5, -Infinity, 8], 'max')).toBe(8);
    });

    it('should return fallback if all values are invalid', () => {
      expect(safeMinMax([NaN, Infinity], 'min')).toBe(0);
      expect(safeMinMax([NaN, -Infinity], 'max', -1)).toBe(-1);
    });

    it('should handle negative numbers', () => {
      expect(safeMinMax([-5, -2, -8], 'min')).toBe(-8);
      expect(safeMinMax([-5, -2, -8], 'max')).toBe(-2);
    });
  });
});
