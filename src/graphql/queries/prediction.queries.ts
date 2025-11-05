/**
 * Prediction Queries
 *
 * GraphQL queries for yield prediction and forecasting.
 * Includes historical performance data for ML-based yield prediction.
 */

import { VAULT_FRAGMENT } from '../fragments/index.js';

/**
 * GraphQL query for vault yield prediction data
 *
 * Fetches historical performance and TVL data for ML-based yield forecasting:
 * - Vault data with current state
 * - Performance history (PeriodSummary) for APY trends
 * - TVL history (TotalAssetsUpdated) for growth tracking
 *
 * Used by: predict_yield tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<YieldPredictionResponse>(
 *   YIELD_PREDICTION_QUERY,
 *   {
 *     vaultAddress: '0x...',
 *     chainId: 1,
 *     timestamp_gte: '1234567890'
 *   }
 * );
 * ```
 */
export const YIELD_PREDICTION_QUERY = `
  query YieldPrediction($vaultAddress: Address!, $chainId: Int!, $timestamp_gte: BigInt!) {
    vault(address: $vaultAddress, chainId: $chainId) {
      ...VaultFragment
    }

    # Get historical performance data
    performanceHistory: transactions(
      where: {
        vault_eq: $vaultAddress,
        timestamp_gte: $timestamp_gte,
        type: "PeriodSummary"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        timestamp
        data {
          ... on PeriodSummary {
            apy
            totalAssetsUsd
          }
        }
      }
    }

    # Get recent total assets updates for TVL tracking
    tvlHistory: transactions(
      where: {
        vault_eq: $vaultAddress,
        timestamp_gte: $timestamp_gte,
        type: "TotalAssetsUpdated"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 100
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
          }
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;
