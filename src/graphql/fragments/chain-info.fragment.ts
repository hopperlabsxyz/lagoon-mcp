/**
 * Chain Info Fragment
 *
 * Reusable fragment for blockchain network information.
 * Includes chain identification, native token, and wrapped native token details.
 */

/**
 * GraphQL fragment for chain information
 *
 * Usage:
 * ```graphql
 * chain {
 *   ...ChainInfoFragment
 * }
 * ```
 */
export const CHAIN_INFO_FRAGMENT = `
  fragment ChainInfoFragment on Chain {
    id
    name
    nativeToken
    logoUrl
    wrappedNativeToken {
      address
      decimals
      name
      symbol
    }
    factory
  }
`;
