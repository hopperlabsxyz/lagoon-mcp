/**
 * Composition Fragment
 *
 * Typed shape of `Vault.composition: CompositionData` (the v0.6+ replacement
 * for the retired `vaultComposition(walletAddress)` JSONObject query).
 */

// ============================================================================
// Typed composition (v0.6+ — the official replacement for the deprecated
// vaultComposition(walletAddress) JSONObject query).
//
// Backend already provides `repartition` (percentage, 0–100) and groups the
// long tail into a single "Other" entry, so consumers don't need to filter
// or recalculate. The new API does NOT include a "Wallet" / idle-assets
// entry — that concept is gone. See docs/agent-notes.md gotcha #8.
// ============================================================================

/**
 * Protocol-level allocation within `Vault.composition`. Sorted by
 * `repartition` descending in the backend response.
 */
export interface ProtocolComposition {
  /** Protocol display name (e.g., "morphoblue", "spark", "Other") */
  protocol: string;
  /** USD value deployed to this protocol */
  valueInUsd: number;
  /** Percentage of total vault value (0–100) */
  repartition: number;
  /** Drill-down for grouped items (currently only used by the "Other" bucket) */
  details?: ProtocolComposition[];
  /** Protocol logo URL (from Octav) */
  logoUrl?: string | null;
}

/**
 * Token/position-level allocation within `Vault.composition`.
 *
 * Caveat (per live probe May 2026): `contract` and `chainKey` are empty
 * strings in production, and `symbol`/`name` are human-readable display
 * strings (e.g., "Spark - reth"), not real ERC20 contracts. Useful for
 * display but NOT for programmatic cross-referencing.
 */
export interface TokenComposition {
  symbol: string;
  name: string;
  contract: string;
  chainKey: string;
  valueInUsd: number;
  repartition: number;
  details?: TokenComposition[];
  logoUrl?: string | null;
}

/**
 * Top-level shape of `Vault.composition`. `totalValueInUsd` is nullable —
 * the backend returns null when no Octav data has been fetched yet.
 */
export interface CompositionData {
  compositions: ProtocolComposition[];
  tokenCompositions: TokenComposition[];
  totalValueInUsd: number | null;
}

/**
 * GraphQL fragment for the typed CompositionData. Inlined inside a
 * `vaultByAddress { composition { ... } }` query — NOT a standalone query.
 */
export const COMPOSITION_FRAGMENT = `
  fragment CompositionFragment on CompositionData {
    totalValueInUsd
    compositions {
      protocol
      valueInUsd
      repartition
      logoUrl
      details {
        protocol
        valueInUsd
        repartition
        logoUrl
      }
    }
    tokenCompositions {
      symbol
      name
      contract
      chainKey
      valueInUsd
      repartition
      logoUrl
      details {
        symbol
        name
        contract
        chainKey
        valueInUsd
        repartition
        logoUrl
      }
    }
  }
`;
