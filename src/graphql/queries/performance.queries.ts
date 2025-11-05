/**
 * Performance Queries
 *
 * GraphQL queries for vault performance tracking and historical metrics.
 * Includes vault performance analysis and period summaries for APR calculations.
 */

/**
 * Vault performance GraphQL query
 *
 * Fetches transactions with TotalAssetsUpdated and PeriodSummary data for
 * historical metrics and trend analysis. Provides time-series performance data.
 *
 * Used by: get_vault_performance tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<VaultPerformanceResponse>(
 *   GET_VAULT_PERFORMANCE_QUERY,
 *   {
 *     vault_in: ['0x...'],
 *     timestamp_gte: '1234567890',
 *     first: 1000
 *   }
 * );
 * ```
 */
export const GET_VAULT_PERFORMANCE_QUERY = `
  query GetVaultPerformance(
    $vault_in: [Address!]!,
    $timestamp_gte: BigInt!,
    $first: Int!
  ) {
    transactions(
      where: {
        vault_in: $vault_in,
        timestamp_gte: $timestamp_gte,
        type_in: ["TotalAssetsUpdated", "PeriodSummary"]
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        ...TransactionBaseFragment
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
            totalAssets
          }
          ... on PeriodSummary {
            tvl
            deposits
            withdrawals
          }
        }
      }
      pageInfo {
        ...PageInfoMinimalFragment
      }
    }
  }
  \${TRANSACTION_BASE_FRAGMENT}
  \${PAGEINFO_MINIMAL_FRAGMENT}
`;

/**
 * Query to fetch period summaries for a vault
 *
 * Period summaries contain historical snapshots of vault state at regular intervals.
 * Used by Lagoon SDK to calculate accurate APR from price per share changes over time.
 *
 * Used by: get_vault_performance tool (via calculateSDKAPR function)
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<{ periodSummaries: PeriodSummary[] }>(
 *   GET_PERIOD_SUMMARIES_QUERY,
 *   { vaultAddress: '0x...', chainId: 1 }
 * );
 * ```
 *
 * @returns Array of period summaries with timestamp and vault state
 */
export const GET_PERIOD_SUMMARIES_QUERY = `
  query GetPeriodSummaries($vaultAddress: String!, $chainId: Int!) {
    periodSummaries(vaultAddress: $vaultAddress, chainId: $chainId) {
      timestamp
      totalAssetsAtStart
      totalSupplyAtStart
    }
  }
`;
