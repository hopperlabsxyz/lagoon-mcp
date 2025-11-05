/**
 * Search Queries
 *
 * GraphQL queries for vault search and discovery operations.
 * Supports advanced filtering, pagination, and sorting.
 */

/**
 * Search vaults GraphQL query
 *
 * Supports advanced filtering, pagination, and sorting for vault discovery.
 * Includes complete vault data via VaultFragment.
 *
 * Used by: search_vaults tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<SearchVaultsResponse>(
 *   SEARCH_VAULTS_QUERY,
 *   {
 *     first: 100,
 *     skip: 0,
 *     orderBy: 'totalAssetsUsd',
 *     orderDirection: 'desc',
 *     where: { chainId_eq: 1, isVisible_eq: true }
 *   }
 * );
 * ```
 *
 * Supported filters:
 * - Asset filters: assetSymbol_eq, assetSymbol_in, assetId_eq, assetId_in
 * - Chain filters: chainId_eq, chainId_in
 * - Curator filters: curatorIds_contains, curatorIds_contains_any
 * - Visibility: isVisible_eq
 * - Address filters: address_eq, address_in
 * - Symbol filters: symbol_eq, symbol_in
 * - Integrator filters: integratorId_eq, integratorId_in
 * - TVL filters: state_totalAssetsUsd_gte, state_totalAssetsUsd_lte
 *
 * Sorting options:
 * - orderBy: 'totalAssetsUsd' | 'address' | 'chainId' | 'id'
 * - orderDirection: 'asc' | 'desc'
 */
export const SEARCH_VAULTS_QUERY = `
  query SearchVaults(
    $first: Int!,
    $skip: Int!,
    $orderBy: VaultOrderBy!,
    $orderDirection: OrderDirection!,
    $where: VaultFilterInput
  ) {
    vaults(
      first: $first,
      skip: $skip,
      orderBy: $orderBy,
      orderDirection: $orderDirection,
      where: $where
    ) {
      items {
        ...VaultFragment
      }
      pageInfo {
        ...PageInfoMinimalFragment
      }
    }
  }
  \${VAULT_FRAGMENT}
  \${PAGEINFO_MINIMAL_FRAGMENT}
`;
