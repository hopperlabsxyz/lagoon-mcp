/**
 * Composition Queries
 *
 * GraphQL queries for vault composition data (protocol and token breakdowns).
 * Uses the composition field from the backend CompositionModule.
 */

import { COMPOSITION_FRAGMENT } from '../fragments/index.js';

/**
 * Get vault composition GraphQL query
 *
 * Fetches protocol and token composition breakdown for a vault.
 * Used by: get_vault_composition tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaultComposition: CompositionData | null }>(
 *   GET_VAULT_COMPOSITION_QUERY,
 *   { vaultAddress: '0x...' }
 * );
 * ```
 */
export const GET_VAULT_COMPOSITION_QUERY = `
  query GetVaultComposition($vaultAddress: Address!) {
    vaultComposition(vaultAddress: $vaultAddress) {
      ...CompositionFragment
    }
  }
  ${COMPOSITION_FRAGMENT}
`;
