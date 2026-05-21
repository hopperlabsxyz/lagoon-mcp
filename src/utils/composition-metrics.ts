/**
 * Composition Metrics
 *
 * Single source of truth for the Herfindahl-Hirschman Index (HHI) and the
 * diversification thresholds that map an HHI score onto the
 * "High / Medium / Low / Unknown" buckets used across `get_vault_composition`,
 * `compare_vaults`, `get_user_portfolio`, and the risk service.
 *
 * Why centralized: pre-extraction, every consumer re-implemented the same
 * `Math.pow(p.repartition / 100, 2)` reduce and the same `< 0.15 / < 0.25`
 * thresholds — and the rounding had already drifted between
 * `Math.round(hhi * 10000) / 10000` and `parseFloat(hhi.toFixed(4))`. One
 * helper, one rounding rule, one threshold table.
 *
 * Thresholds are DeFi-tuned, not antitrust standards (the U.S. DoJ uses
 * 1500/2500 on a 0-10000 scale; we're far more sensitive because a single
 * protocol failure can wipe a vault).
 */

export const HHI_HIGH_DIVERSIFICATION_MAX = 0.15;
export const HHI_MEDIUM_CONCENTRATION_MAX = 0.25;

/** "Unknown" is used when there's no composition data to score (e.g. Octav
 * hasn't been queried yet). It's NOT a fallback for low-data states where the
 * answer is genuinely "High" — that distinction matters for risk-conscious
 * consumers and was the bug that motivated this enum. */
export type DiversificationLevel = 'High' | 'Medium' | 'Low' | 'Unknown';

/**
 * Calculate the Herfindahl-Hirschman Index from a set of repartition
 * percentages (0-100 each). Returns a value in [0, 1] rounded to 4 decimals.
 *
 * Empty input returns 0 (which is *not* the same as "highly diversified" —
 * callers MUST gate on `protocolCount > 0` before reading the level, or call
 * `getDiversificationLevel(hhi, isEmpty)` instead).
 */
export function calculateHHI(repartitions: number[]): number {
  if (repartitions.length === 0) return 0;
  const sum = repartitions.reduce((acc, r) => acc + Math.pow(r / 100, 2), 0);
  return Math.round(sum * 10000) / 10000;
}

/**
 * Map an HHI score to a diversification level.
 *
 * Pass `isEmpty: true` when the underlying composition list is empty — the
 * function returns 'Unknown' rather than falsely reporting 'High' (HHI=0).
 */
export function getDiversificationLevel(
  hhi: number,
  isEmpty: boolean = false
): DiversificationLevel {
  if (isEmpty) return 'Unknown';
  if (hhi < HHI_HIGH_DIVERSIFICATION_MAX) return 'High';
  if (hhi < HHI_MEDIUM_CONCENTRATION_MAX) return 'Medium';
  return 'Low';
}
