/**
 * GraphQL Query: Period Summaries
 *
 * Fetch historical vault period summaries for APR calculations.
 */

import { gql } from 'graphql-request';

/**
 * Query to fetch period summaries for a vault
 *
 * Period summaries contain historical snapshots of vault state at regular intervals.
 * Used by SDK to calculate accurate APR from price per share changes over time.
 *
 * @returns Array of period summaries with timestamp and vault state
 */
export const GET_PERIOD_SUMMARIES_QUERY = gql`
  query GetPeriodSummaries($vaultAddress: String!, $chainId: Int!) {
    periodSummaries(vaultAddress: $vaultAddress, chainId: $chainId) {
      timestamp
      totalAssetsAtStart
      totalSupplyAtStart
    }
  }
`;
