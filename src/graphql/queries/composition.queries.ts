/**
 * Composition Queries
 *
 * GraphQL queries for vault composition data from Octav API.
 * The backend returns a JSONObject with chains as keys containing composition data.
 *
 * Note: The vaultComposition endpoint returns JSONObject type, so no GraphQL fragment
 * is needed. The response is a flat object keyed by chain name.
 */

/**
 * Get vault composition GraphQL query
 *
 * Fetches cross-chain composition data for a vault from Octav API.
 * Returns a JSONObject with chain keys (ethereum, arbitrum, etc.) containing:
 * - name: Chain display name
 * - key: Chain identifier
 * - chainId: Chain ID as string
 * - value: USD value of positions
 * - valuePercentile: Relative ranking
 * - totalCostBasis, totalClosedPnl, totalOpenPnl: PnL metrics
 *
 * Used by: get_vault_composition tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ vaultComposition: RawVaultComposition | null }>(
 *   GET_VAULT_COMPOSITION_QUERY,
 *   { walletAddress: '0x...' }
 * );
 * ```
 */
export const GET_VAULT_COMPOSITION_QUERY = `
  query GetVaultComposition($walletAddress: Address!) {
    vaultComposition(walletAddress: $walletAddress)
  }
`;
