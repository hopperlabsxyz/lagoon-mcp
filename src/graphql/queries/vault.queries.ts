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
 * Supports cross-chain comparisons by accepting an array of chain IDs.
 * Used by: compare_vaults tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaults: { items: VaultData[] } }>(
 *   COMPARE_VAULTS_QUERY,
 *   { addresses: ['0x...', '0x...'], chainIds: [1, 8453, 43114] }
 * );
 * ```
 */
export const COMPARE_VAULTS_QUERY = `
  query CompareVaults($addresses: [String!]!, $chainIds: [Int!]!) {
    vaults(where: { address_in: $addresses, chainId_in: $chainIds }) {
      items {
        ...VaultFragment
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for vault creation timestamp
 *
 * Fetches the first transaction for a vault to determine its creation date.
 * Uses TotalAssetsUpdated or any transaction type, ordered by timestamp ascending.
 * Used by: compare_vaults tool for actual vault age calculation
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ transactions: { items: [...] } }>(
 *   VAULT_FIRST_TRANSACTION_QUERY,
 *   { vaultAddress: '0x...' }
 * );
 * const createdAt = data.transactions.items[0]?.timestamp;
 * ```
 */
export const VAULT_FIRST_TRANSACTION_QUERY = `
  query VaultFirstTransaction($vaultAddress: Address!) {
    transactions(
      where: { vault_in: [$vaultAddress] },
      orderBy: timestamp,
      orderDirection: asc,
      first: 1
    ) {
      items {
        timestamp
      }
    }
  }
`;

/**
 * GraphQL query for batch vault first transactions (creation dates)
 *
 * Fetches the first transaction for multiple vaults in a single request.
 * This reduces N parallel requests to 1 batch request for vault age calculation.
 * Used by: compare_vaults tool for efficient vault age lookup
 *
 * Note: Returns ALL transactions for the given vaults ordered by timestamp.
 * The caller must group by vault address and take the first (oldest) for each.
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<BatchVaultFirstTransactionsResponse>(
 *   BATCH_VAULT_FIRST_TRANSACTIONS_QUERY,
 *   { vaultAddresses: ['0x...', '0x...', '0x...'] }
 * );
 * // Group results by vault address and take oldest timestamp for each
 * const ageMap = buildVaultAgeMap(data.transactions.items);
 * ```
 */
export const BATCH_VAULT_FIRST_TRANSACTIONS_QUERY = `
  query BatchVaultFirstTransactions($vaultAddresses: [Address!]!) {
    transactions(
      where: { vault_in: $vaultAddresses },
      orderBy: timestamp,
      orderDirection: asc,
      first: 100
    ) {
      items {
        vault {
          address
        }
        timestamp
      }
    }
  }
`;

/**
 * Response type for BATCH_VAULT_FIRST_TRANSACTIONS_QUERY
 */
export interface BatchVaultFirstTransactionsResponse {
  transactions: {
    items: Array<{
      vault: {
        address: string;
      };
      timestamp: number;
    }>;
  };
}
