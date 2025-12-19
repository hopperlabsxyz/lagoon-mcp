/**
 * Composition Fragment
 *
 * GraphQL fragment for vault composition data including protocol and token breakdowns.
 * Uses the composition field added by the CompositionModule in the backend.
 */

/**
 * Protocol composition within a vault
 */
export interface ProtocolComposition {
  protocol: string;
  valueInUsd: number;
  repartition: number;
  details?: ProtocolComposition[];
}

/**
 * Token/position composition within a vault
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
 * Complete composition data for a vault
 */
export interface CompositionData {
  compositions: ProtocolComposition[];
  tokenCompositions: TokenComposition[];
}

/**
 * GraphQL fragment for composition data
 *
 * Usage:
 * ```graphql
 * query MyQuery {
 *   composition(address: "0x...") {
 *     ...CompositionFragment
 *   }
 * }
 * ${COMPOSITION_FRAGMENT}
 * ```
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
