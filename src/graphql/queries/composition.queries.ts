/**
 * Composition Queries
 *
 * Despite the export name (`GET_VAULT_COMPOSITION_QUERY`), this resolves
 * via `vaultByAddress(...).composition`, NOT a top-level `vaultComposition`
 * GraphQL operation — that one is the deprecated `vaultComposition(walletAddress)`
 * JSONObject query which we migrated off in v0.6. See
 * `docs/agent-notes.md` gotcha #8.
 *
 * Args change vs the deprecated query: `walletAddress: Address!` →
 * `address: Address!, chainId: Int!`. The deprecated query merged chains
 * silently — this fixes the cross-chain bug (gotcha #2) at the same time.
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
