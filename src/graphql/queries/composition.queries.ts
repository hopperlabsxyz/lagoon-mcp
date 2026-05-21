/**
 * Composition Queries
 *
 * Uses the typed `Vault.composition: CompositionData` field (v0.6+).
 * Replaces the deprecated `vaultComposition(walletAddress)` JSONObject
 * query. See `docs/agent-notes.md` gotcha #8 for the migration notes.
 *
 * Args change: `walletAddress: Address!` → `address: Address!, chainId: Int!`.
 * The deprecated query merged chains silently — this fixes the cross-chain
 * bug (see gotcha #2) at the same time.
 */

import { COMPOSITION_FRAGMENT } from '../fragments/composition.fragment.js';

export const GET_VAULT_COMPOSITION_QUERY = `
  query GetVaultComposition($address: Address!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      composition {
        ...CompositionFragment
      }
    }
  }
  ${COMPOSITION_FRAGMENT}
`;
