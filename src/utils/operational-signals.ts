/**
 * Operational signals derived from `VaultState` v0.6+ flags.
 *
 * These are NOT inputs to the calibrated 14-factor weighted risk score in
 * `src/utils/risk-scoring.ts` — adding a 15th factor would force a weight
 * reallocation and invalidate test calibration. Instead, signals:
 *
 *   1. Are surfaced as a separate output block (`operationalSignals[]`).
 *   2. Apply a *risk-level floor* on the bucket (Critical/High/Medium/Low),
 *      following the same pattern as `CRITICAL_FACTOR_THRESHOLD` in
 *      `calculateOverallRisk` — the numeric score is unchanged, only the
 *      bucket can move up.
 *
 * Recomputed on every `analyze_risk` call (no separate cache horizon) — they
 * derive from already-cached vault state, so the cost is negligible, and a
 * `stale_total_assets` signal would silently expire if we cached it.
 */

export type OperationalSignalCode =
  | 'paused'
  | 'safe_unlocked'
  | 'super_operator_unlocked'
  | 'blacklist_mode_active'
  | 'stale_total_assets';

export type OperationalSeverity = 'Critical' | 'High' | 'Medium';

export interface OperationalSignal {
  code: OperationalSignalCode;
  severity: OperationalSeverity;
  message: string;
}

/**
 * VaultState shape consumed by this evaluator. Intentionally a structural
 * subset of `VaultData['state']` (from `src/graphql/fragments/vault.fragment.ts`)
 * so we don't depend on the full fragment for unit-testable signal evaluation.
 */
export interface OperationalSignalsState {
  isPaused?: boolean;
  safeLocked?: boolean;
  // null when the role doesn't exist on the vault (pre-v0.6.0 contracts).
  superOperatorLocked?: boolean | null;
  accessMode?: 'Whitelist' | 'Blacklist' | null;
  blacklist?: string[] | null;
  // BigInt-serialized as string in the fragment; parsed below.
  totalAssetsExpiration?: string;
}

/**
 * Evaluate `state` against each signal rule. `nowSeconds` is injected for
 * deterministic testability (don't read `Date.now()` here).
 */
export function evaluateOperationalSignals(
  state: OperationalSignalsState | null | undefined,
  nowSeconds: number
): OperationalSignal[] {
  if (!state) return [];
  const signals: OperationalSignal[] = [];

  if (state.isPaused === true) {
    signals.push({
      code: 'paused',
      severity: 'Critical',
      message: 'Vault is currently paused — deposits, redeems, and settlements are halted.',
    });
  }

  if (state.safeLocked === false) {
    signals.push({
      code: 'safe_unlocked',
      severity: 'High',
      message:
        'Safe (fund custody) address can still be changed by the vault owner — a malicious owner could rotate custody.',
    });
  }

  // superOperatorLocked is null on pre-v0.6.0 vaults that lack the role.
  // Only flag when it's explicitly false (role exists and is mutable).
  if (state.superOperatorLocked === false) {
    signals.push({
      code: 'super_operator_unlocked',
      severity: 'High',
      message:
        'Super-operator role can still be changed — the holder can act on behalf of any controller and bypass access checks.',
    });
  }

  if (
    state.accessMode === 'Blacklist' &&
    Array.isArray(state.blacklist) &&
    state.blacklist.length > 0
  ) {
    // Don't embed the exact blacklist size — for vault-operator (non-OFAC)
    // blacklists the count can be sensitive operator metadata, and it adds
    // no risk-analytic value beyond "non-empty". Callers needing the exact
    // size can read state.blacklist directly via get_vault_data.
    signals.push({
      code: 'blacklist_mode_active',
      severity: 'Medium',
      message: 'Vault enforces a non-empty blacklist — operator can deny specific users access.',
    });
  }

  if (state.totalAssetsExpiration) {
    const expiration = Number(state.totalAssetsExpiration);
    // 0 means "not configured" — skip the check rather than treat as stale.
    if (Number.isFinite(expiration) && expiration > 0 && nowSeconds > expiration) {
      signals.push({
        code: 'stale_total_assets',
        severity: 'High',
        message:
          'totalAssets valuation has expired — synchronous operations may be disabled and downstream analytics may be working from a stale TVL.',
      });
    }
  }

  return signals;
}

/**
 * The risk-level floor implied by a set of signals. Critical > High > Medium.
 * Returns null when no signals are present.
 *
 * Pair with `riskLevelMax(weightedLevel, floor)` to compute the effective
 * level: the floor can only move the bucket up, never down.
 */
export function operationalSignalFloor(
  signals: OperationalSignal[]
): 'Critical' | 'High' | 'Medium' | null {
  if (signals.length === 0) return null;
  if (signals.some((s) => s.severity === 'Critical')) return 'Critical';
  if (signals.some((s) => s.severity === 'High')) return 'High';
  return 'Medium';
}

const RISK_LEVEL_RANK: Record<'Low' | 'Medium' | 'High' | 'Critical', number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

/**
 * Take the worse (higher) of two risk levels.
 */
export function riskLevelMax(
  a: 'Low' | 'Medium' | 'High' | 'Critical',
  b: 'Low' | 'Medium' | 'High' | 'Critical' | null
): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (b === null) return a;
  return RISK_LEVEL_RANK[a] >= RISK_LEVEL_RANK[b] ? a : b;
}
