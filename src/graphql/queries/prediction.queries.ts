/**
 * Prediction Queries
 *
 * GraphQL queries for yield prediction and forecasting.
 * Includes historical performance data for ML-based yield prediction.
 */

import { VAULT_FRAGMENT } from '../fragments/index.js';

/**
 * Response format type for yield prediction output verbosity.
 *
 * Note: this only affects the formatted output produced by the tool.
 * The GraphQL query itself always uses VAULT_FRAGMENT because the
 * yield calculation requires vault.decimals, asset.decimals,
 * state.pricePerShare, state.highWaterMark, state.managementFee,
 * and state.performanceFee — none of which are present on
 * VaultListFragment.
 */
export type PredictionResponseFormat = 'quick' | 'detailed';

/**
 * Create yield prediction GraphQL query.
 *
 * The `responseFormat` parameter is accepted for API compatibility but does
 * not change the query — see PredictionResponseFormat doc for why.
 */
export function createYieldPredictionQuery(
  _responseFormat: PredictionResponseFormat = 'quick'
): string {
  return `
    query YieldPrediction($vaultAddress: Address!, $chainId: Int!) {
      vault: vaultByAddress(address: $vaultAddress, chainId: $chainId) {
        ...VaultFragment
      }

      # Get historical performance data
      performanceHistory: transactions(
        where: {
          vault_in: [$vaultAddress],
          type_in: [PeriodSummary]
        },
        orderBy: timestamp,
        orderDirection: asc,
        first: 1000
      ) {
        items {
          timestamp
          data {
            ... on PeriodSummary {
              totalAssetsAtStart
              totalSupplyAtStart
              totalAssetsAtEnd
            }
          }
        }
      }

      # Get recent total assets updates for TVL tracking
      tvlHistory: transactions(
        where: {
          vault_in: [$vaultAddress],
          type_in: [TotalAssetsUpdated]
        },
        orderBy: timestamp,
        orderDirection: asc,
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
}

/**
 * GraphQL query for vault yield prediction data
 *
 * Fetches historical performance and TVL data for ML-based yield forecasting:
 * - Vault data with current state
 * - Performance history (PeriodSummary) for APR trends
 * - TVL history (TotalAssetsUpdated) for growth tracking
 *
 * Used by: predict_yield tool
 */
export const YIELD_PREDICTION_QUERY = createYieldPredictionQuery('detailed');
