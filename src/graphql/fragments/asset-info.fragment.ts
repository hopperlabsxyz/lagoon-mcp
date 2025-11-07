/**
 * Asset Info Fragment
 *
 * Reusable fragment for asset/token information.
 * Includes identification, pricing, and chain relationship.
 */

/**
 * GraphQL fragment for asset information
 *
 * Usage:
 * ```graphql
 * asset {
 *   ...AssetInfoFragment
 * }
 * ```
 */
export const ASSET_INFO_FRAGMENT = `
  fragment AssetInfoFragment on Asset {
    id
    name
    symbol
    decimals
    address
    logoUrl
    description
    isVisible
    priceUsd
    chain {
      id
      name
      nativeToken
      logoUrl
    }
  }
`;
