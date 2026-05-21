import { describe, it, expect } from 'vitest';
import {
  evaluateOperationalSignals,
  operationalSignalFloor,
  riskLevelMax,
} from '../../src/utils/operational-signals';

const NOW = 1_700_000_000;

describe('evaluateOperationalSignals', () => {
  it('returns empty on healthy v0.6 state', () => {
    const signals = evaluateOperationalSignals(
      {
        isPaused: false,
        safeLocked: true,
        superOperatorLocked: true,
        accessMode: 'Whitelist',
        blacklist: null,
        totalAssetsExpiration: String(NOW + 86400),
      },
      NOW
    );
    expect(signals).toEqual([]);
  });

  it('returns empty when state is null/undefined', () => {
    expect(evaluateOperationalSignals(null, NOW)).toEqual([]);
    expect(evaluateOperationalSignals(undefined, NOW)).toEqual([]);
  });

  it('flags Critical when vault is paused', () => {
    const signals = evaluateOperationalSignals({ isPaused: true }, NOW);
    expect(signals).toHaveLength(1);
    expect(signals[0].code).toBe('paused');
    expect(signals[0].severity).toBe('Critical');
  });

  it('flags High when safe is unlocked', () => {
    const signals = evaluateOperationalSignals({ safeLocked: false }, NOW);
    expect(signals.find((s) => s.code === 'safe_unlocked')?.severity).toBe('High');
  });

  it('flags High when super-operator is unlocked AND role exists', () => {
    const signals = evaluateOperationalSignals({ superOperatorLocked: false }, NOW);
    expect(signals.find((s) => s.code === 'super_operator_unlocked')?.severity).toBe('High');
  });

  it('does NOT flag super-operator when role does not exist (null)', () => {
    const signals = evaluateOperationalSignals({ superOperatorLocked: null }, NOW);
    expect(signals.find((s) => s.code === 'super_operator_unlocked')).toBeUndefined();
  });

  it('flags Medium when blacklist mode is active with a non-empty list', () => {
    const signals = evaluateOperationalSignals(
      { accessMode: 'Blacklist', blacklist: ['0xbad'] },
      NOW
    );
    expect(signals.find((s) => s.code === 'blacklist_mode_active')?.severity).toBe('Medium');
  });

  it('does NOT flag blacklist mode when blacklist is empty', () => {
    const signals = evaluateOperationalSignals({ accessMode: 'Blacklist', blacklist: [] }, NOW);
    expect(signals.find((s) => s.code === 'blacklist_mode_active')).toBeUndefined();
  });

  it('does NOT flag blacklist mode when blacklist is null (RockSolid rETH live case)', () => {
    const signals = evaluateOperationalSignals({ accessMode: 'Blacklist', blacklist: null }, NOW);
    expect(signals.find((s) => s.code === 'blacklist_mode_active')).toBeUndefined();
  });

  it('flags High when totalAssets has expired', () => {
    const signals = evaluateOperationalSignals({ totalAssetsExpiration: String(NOW - 1) }, NOW);
    expect(signals.find((s) => s.code === 'stale_total_assets')?.severity).toBe('High');
  });

  it('treats totalAssetsExpiration === "0" as not configured (skip)', () => {
    const signals = evaluateOperationalSignals({ totalAssetsExpiration: '0' }, NOW);
    expect(signals.find((s) => s.code === 'stale_total_assets')).toBeUndefined();
  });

  it('aggregates multiple signals in encounter order', () => {
    const signals = evaluateOperationalSignals(
      {
        isPaused: true,
        safeLocked: false,
        superOperatorLocked: false,
        accessMode: 'Blacklist',
        blacklist: ['0x1', '0x2'],
        totalAssetsExpiration: String(NOW - 1),
      },
      NOW
    );
    expect(signals.map((s) => s.code)).toEqual([
      'paused',
      'safe_unlocked',
      'super_operator_unlocked',
      'blacklist_mode_active',
      'stale_total_assets',
    ]);
  });
});

describe('operationalSignalFloor', () => {
  it('returns null for empty signals', () => {
    expect(operationalSignalFloor([])).toBeNull();
  });
  it('picks Critical when any signal is Critical', () => {
    expect(
      operationalSignalFloor([
        { code: 'safe_unlocked', severity: 'High', message: '' },
        { code: 'paused', severity: 'Critical', message: '' },
      ])
    ).toBe('Critical');
  });
  it('picks High when no Critical but at least one High', () => {
    expect(
      operationalSignalFloor([
        { code: 'safe_unlocked', severity: 'High', message: '' },
        { code: 'blacklist_mode_active', severity: 'Medium', message: '' },
      ])
    ).toBe('High');
  });
  it('falls back to Medium when only Medium signals present', () => {
    expect(
      operationalSignalFloor([{ code: 'blacklist_mode_active', severity: 'Medium', message: '' }])
    ).toBe('Medium');
  });
});

describe('riskLevelMax', () => {
  it('returns the higher of two levels', () => {
    expect(riskLevelMax('Low', 'High')).toBe('High');
    expect(riskLevelMax('Medium', 'Critical')).toBe('Critical');
    expect(riskLevelMax('High', 'Low')).toBe('High');
  });
  it('returns the first argument when the floor is null', () => {
    expect(riskLevelMax('Low', null)).toBe('Low');
    expect(riskLevelMax('High', null)).toBe('High');
  });
  it('returns either arg when equal', () => {
    expect(riskLevelMax('Medium', 'Medium')).toBe('Medium');
  });
});
