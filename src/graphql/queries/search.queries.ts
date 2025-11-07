/**
 * Search Queries
 *
 * GraphQL queries for vault search and discovery operations.
 * Supports advanced filtering, pagination, and sorting.
 */

import { VAULT_FRAGMENT, PAGEINFO_MINIMAL_FRAGMENT } from '../fragments/index.js';
import { VAULT_LIST_FRAGMENT } from '../fragments/vault-list.fragment.js';
import { VAULT_SUMMARY_FRAGMENT } from '../fragments/vault-summary.fragment.js';

/**
 * Response format type for search vaults query
 */
export type SearchVaultsResponseFormat = 'list' | 'summary' | 'full';

/**
 * Create search vaults GraphQL query with dynamic fragment selection
 *
 * Supports advanced filtering, pagination, and sorting for vault discovery.
 * Fragment selection optimizes token usage based on required detail level.
 *
 * Used by: search_vaults tool
 *
 * @param responseFormat - Detail level: 'list' (~60 tokens/vault), 'summary' (~170 tokens/vault), 'full' (~600 tokens/vault)
 * @returns GraphQL query string with appropriate fragment
 *
 * Usage:
 * ```typescript
 * const query = createSearchVaultsQuery('list'); // Minimal data
 * const data = await graphqlClient.request<SearchVaultsResponse>(
 *   query,
 *   {
 *     first: 20,
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
export function createSearchVaultsQuery(
  responseFormat: SearchVaultsResponseFormat = 'list'
): string {
  const { fragment, fragmentName } = getFragmentForResponseFormat(responseFormat);

  return `
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
          ...${fragmentName}
        }
        pageInfo {
          ...PageInfoMinimalFragment
        }
      }
    }
    ${fragment}
    ${PAGEINFO_MINIMAL_FRAGMENT}
  `;
}

/**
 * Get fragment and fragment name based on response format
 */
function getFragmentForResponseFormat(responseFormat: SearchVaultsResponseFormat): {
  fragment: string;
  fragmentName: string;
} {
  switch (responseFormat) {
    case 'list':
      return { fragment: VAULT_LIST_FRAGMENT, fragmentName: 'VaultListFragment' };
    case 'summary':
      return { fragment: VAULT_SUMMARY_FRAGMENT, fragmentName: 'VaultSummaryFragment' };
    case 'full':
      return { fragment: VAULT_FRAGMENT, fragmentName: 'VaultFragment' };
    default:
      return { fragment: VAULT_LIST_FRAGMENT, fragmentName: 'VaultListFragment' };
  }
}

/**
 * Search vaults GraphQL query (legacy - uses full fragment)
 *
 * @deprecated Use createSearchVaultsQuery('full') instead for explicit fragment selection
 *
 * This maintains backward compatibility for existing code.
 * Consider migrating to createSearchVaultsQuery() for better token efficiency.
 */
export const SEARCH_VAULTS_QUERY = createSearchVaultsQuery('full');
