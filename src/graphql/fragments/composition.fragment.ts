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
// Protocol-based composition types (NEW - preferred for analysis)
// The assetByProtocols field provides DeFi protocol-level breakdown
// ============================================================================

/**
 * Position category within a chain (e.g., LENDING, YIELD, DEPOSIT, SPOT)
 */
export interface ProtocolPositionCategory {
  /** Category name (e.g., "Lending", "Yield", "Deposit", "Spot") */
  name: string;
  /** Total USD value in this category */
  totalValue: string;
}

/**
 * Chain-level breakdown within a protocol
 */
export interface ProtocolChainData {
  /** Chain display name (e.g., "Ethereum") */
  name: string;
  /** Chain key (e.g., "ethereum") */
  key: string;
  /** USD value on this chain */
  value: string;
  /** Total cost basis (may be "N/A") */
  totalCostBasis: string;
  /** Total closed PnL (may be "N/A") */
  totalClosedPnl: string;
  /** Total open PnL (may be "N/A") */
  totalOpenPnl: string;
  /** Position categories on this chain (keyed by category type) */
  protocolPositions: Record<string, ProtocolPositionCategory>;
}

/**
 * Protocol-level composition data from Octav API
 * Represents a DeFi protocol like Spark, Morpho, Yield Basis, or "wallet" for idle assets
 *
 * Example protocols: spark, morphoblue, yieldbasis, lagoon, hyperliquid, wallet
 */
export interface ProtocolCompositionData {
  /** Protocol display name (e.g., "Spark", "Morpho", "Yield Basis", "Wallet") */
  name: string;
  /** Protocol key/identifier (e.g., "spark", "morphoblue", "wallet") */
  key: string;
  /** Total USD value in this protocol */
  value: string;
  /** Total cost basis (may be "N/A") */
  totalCostBasis: string;
  /** Total closed PnL (may be "N/A") */
  totalClosedPnl: string;
  /** Total open PnL (may be "N/A") */
  totalOpenPnl: string;
  /** Chain-level breakdown within this protocol */
  chains: Record<string, ProtocolChainData>;
}

/**
 * Full vaultComposition response structure from Octav API
 *
 * Contains two main sections:
 * - assetByProtocols: Protocol-level breakdown (preferred for analysis)
 * - chains: Chain-level summary (legacy, kept for backward compatibility)
 *
 * Example:
 * ```typescript
 * {
 *   address: "0x...",
 *   networth: "4970636.89",
 *   assetByProtocols: {
 *     "spark": { name: "Spark", value: "1324461.98", chains: { ethereum: {...} } },
 *     "wallet": { name: "Wallet", value: "6356.97", chains: { ethereum: {...} } },
 *     // ... other protocols
 *   },
 *   chains: {
 *     "ethereum": { name: "Ethereum", chainId: "1", value: "4970455.03", ... },
 *     // ... other chains
 *   }
 * }
 * ```
 */
export interface VaultCompositionFullResponse {
  /** Vault/wallet address */
  address: string;
  /** Total portfolio net worth in USD */
  networth: string;
  /** Protocol-level breakdown (PRIMARY - use for diversification analysis) */
  assetByProtocols: Record<string, ProtocolCompositionData>;
  /** Chain-level summary (LEGACY - kept for backward compatibility) */
  chains: Record<string, ChainComposition>;
}

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
