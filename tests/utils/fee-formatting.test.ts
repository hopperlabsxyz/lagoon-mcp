import { describe, it, expect } from 'vitest';
import {
  basisPointsToPercent,
  formatBasisPointsAsPercent,
  normalizeFeesToPercent,
} from '../../src/utils/fee-formatting';

describe('fee-formatting', () => {
  describe('basisPointsToPercent', () => {
    it('converts whole-percent values', () => {
      expect(basisPointsToPercent(2000)).toBe(20);
      expect(basisPointsToPercent(100)).toBe(1);
      expect(basisPointsToPercent(0)).toBe(0);
    });

    it('preserves fractional precision', () => {
      expect(basisPointsToPercent(250)).toBe(2.5);
      expect(basisPointsToPercent(1)).toBe(0.01);
    });

    it('returns 0 for null and undefined', () => {
      expect(basisPointsToPercent(null)).toBe(0);
      expect(basisPointsToPercent(undefined)).toBe(0);
    });
  });

  describe('formatBasisPointsAsPercent', () => {
    it('formats with default 2 decimals', () => {
      expect(formatBasisPointsAsPercent(2000)).toBe('20.00%');
      expect(formatBasisPointsAsPercent(50)).toBe('0.50%');
    });

    it('honors a custom decimals arg', () => {
      expect(formatBasisPointsAsPercent(2000, 0)).toBe('20%');
      expect(formatBasisPointsAsPercent(250, 1)).toBe('2.5%');
    });

    it('returns "N/A" for null/undefined', () => {
      expect(formatBasisPointsAsPercent(null)).toBe('N/A');
      expect(formatBasisPointsAsPercent(undefined)).toBe('N/A');
    });
  });

  describe('normalizeFeesToPercent', () => {
    it('converts every fee field to percent', () => {
      const state = {
        managementFee: 200,
        performanceFee: 2000,
        protocolFee: 1000,
        entryRate: 50,
        exitRate: 50,
        haircutRate: 200,
        upcomingManagementFee: 300,
        upcomingPerformanceFee: 2500,
      };
      const out = normalizeFeesToPercent(state);
      expect(out.managementFee).toBe(2);
      expect(out.performanceFee).toBe(20);
      expect(out.protocolFee).toBe(10);
      expect(out.entryRate).toBe(0.5);
      expect(out.exitRate).toBe(0.5);
      expect(out.haircutRate).toBe(2);
      expect(out.upcomingManagementFee).toBe(3);
      expect(out.upcomingPerformanceFee).toBe(25);
    });

    it('preserves null upcoming fees as null (not 0)', () => {
      const state = {
        managementFee: 200,
        performanceFee: 2000,
        protocolFee: 0,
        upcomingManagementFee: null,
        upcomingPerformanceFee: null,
      };
      const out = normalizeFeesToPercent(state);
      expect(out.upcomingManagementFee).toBeNull();
      expect(out.upcomingPerformanceFee).toBeNull();
    });

    it('treats missing optional fields as 0 (defensive)', () => {
      const state = { managementFee: 200, performanceFee: 2000, protocolFee: 0 };
      const out = normalizeFeesToPercent(state);
      expect(out.entryRate).toBe(0);
      expect(out.exitRate).toBe(0);
      expect(out.haircutRate).toBe(0);
    });
  });
});
