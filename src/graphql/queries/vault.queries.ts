/**
 * Vault Queries
 *
 * GraphQL queries for vault data operations.
 * Includes single vault queries, performance tracking, and vault comparison.
 */

import { VAULT_FRAGMENT } from '../fragments/index.js';

/**
 * Complete vault data GraphQL query
 *
 * Fetches comprehensive vault information including all available fields.
 * Used by: get_vault_data tool
 *
 * Schema verified against working API query on 2025-01-04
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaultByAddress: VaultData | null }>(
 *   GET_VAULT_DATA_QUERY,
 *   { address: '0x...', chainId: 1 }
 * );
 * ```
 */
export const GET_VAULT_DATA_QUERY = `
  query GetVaultData($address: Address!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      ...VaultFragment
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * Query to fetch vault data for APR calculation
 *
 * Fetches vault data optimized for SDK APR calculations.
 * Used by: get_vault_performance tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaultByAddress: VaultData | null }>(
 *   GET_VAULT_FOR_APR_QUERY,
 *   { address: '0x...', chainId: 1 }
 * );
 * ```
 */
export const GET_VAULT_FOR_APR_QUERY = `
  query GetVaultForAPR($address: Address!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      ...VaultFragment
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for batch vault comparison
 *
 * Fetches multiple vaults in a single request for side-by-side comparison.
 * Used by: compare_vaults tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaults: VaultData[] }>(
 *   COMPARE_VAULTS_QUERY,
 *   { addresses: ['0x...', '0x...'], chainId: 1 }
 * );
 * ```
 */
export const COMPARE_VAULTS_QUERY = `
  query CompareVaults($addresses: [Address!]!, $chainId: Int!) {
    vaults(where: { address_in: $addresses, chainId: $chainId }) {
      ...VaultFragment
    }
  }
  ${VAULT_FRAGMENT}
`;
