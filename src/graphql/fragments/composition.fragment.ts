/**
 * Composition Fragment
 *
 * Type definitions for vault composition data from Octav API.
 * The backend returns a JSONObject with chains as keys containing composition data.
 *
 * Note: The vaultComposition endpoint returns JSONObject type, so no GraphQL fragment
 * is needed. The response is a flat object keyed by chain name.
 */

/**
 * Chain composition data from Octav API
 * Each chain entry contains aggregated position values and metadata
 */
export interface ChainComposition {
  /** Display name of the chain (e.g., "Ethereum", "Arbitrum") */
  name: string;
  /** Unique key for the chain (e.g., "ethereum", "arbitrum") */
  key: string;
  /** Chain ID as string (e.g., "1", "42161") */
  chainId: string;
  /** Total USD value of positions on this chain */
  value: string;
  /** Percentile ranking of this chain's value */
  valuePercentile: string;
  /** Total cost basis (may be "N/A") */
  totalCostBasis: string;
  /** Total closed PnL (may be "N/A") */
  totalClosedPnl: string;
  /** Total open PnL (may be "N/A") */
  totalOpenPnl: string;
}

/**
 * Raw vaultComposition response - JSONObject keyed by chain name
 *
 * Example:
 * ```typescript
 * {
 *   "ethereum": { name: "Ethereum", key: "ethereum", chainId: "1", value: "6224.80", ... },
 *   "arbitrum": { name: "Arbitrum", key: "arbitrum", chainId: "42161", value: "3.99", ... },
 *   "linea": { name: "Linea", key: "linea", chainId: "59144", value: "0", ... },
 *   // ... 60+ chains
 * }
 * ```
 */
export type RawVaultComposition = Record<string, ChainComposition>;

// ============================================================================
// Legacy types - kept for backward compatibility during migration
// These will be removed once all dependent tools are updated
// ============================================================================

/**
 * @deprecated Use ChainComposition instead - backend API changed
 * Protocol composition within a vault (legacy structure)
 */
export interface ProtocolComposition {
  protocol: string;
  valueInUsd: number;
  repartition: number;
  details?: ProtocolComposition[];
}

/**
 * @deprecated Use ChainComposition instead - backend API changed
 * Token/position composition within a vault (legacy structure)
 */
export interface TokenComposition {
  symbol: string;
  name: string;
  contract: string;
  chainKey: string;
  valueInUsd: number;
  repartition: number;
  details?: TokenComposition[];
}

/**
 * @deprecated Use RawVaultComposition instead - backend API changed
 * Complete composition data for a vault (legacy structure)
 */
export interface CompositionData {
  compositions: ProtocolComposition[];
  tokenCompositions: TokenComposition[];
}

/**
 * @deprecated No longer used - backend returns JSONObject, not a typed GraphQL response
 * GraphQL fragment for composition data (legacy)
 */
export const COMPOSITION_FRAGMENT = `
  fragment CompositionFragment on CompositionData {
    compositions {
      protocol
      valueInUsd
      repartition
      details {
        protocol
        valueInUsd
        repartition
      }
    }
    tokenCompositions {
      symbol
      name
      contract
      chainKey
      valueInUsd
      repartition
      details {
        symbol
        name
        contract
        chainKey
        valueInUsd
        repartition
      }
    }
  }
`;
