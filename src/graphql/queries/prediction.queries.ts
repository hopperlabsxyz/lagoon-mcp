/**
 * Prediction Queries
 *
 * GraphQL queries for yield prediction and forecasting.
 * Includes historical performance data for ML-based yield prediction.
 */

import { VAULT_FRAGMENT, VAULT_LIST_FRAGMENT } from '../fragments/index.js';

/**
 * Response format type for yield prediction query
 */
export type PredictionResponseFormat = 'quick' | 'detailed';

/**
 * Get fragment and fragment name based on response format for prediction queries
 */
function getFragmentForPredictionResponseFormat(responseFormat: PredictionResponseFormat): {
  fragment: string;
  fragmentName: string;
} {
  switch (responseFormat) {
    case 'quick':
      return { fragment: VAULT_LIST_FRAGMENT, fragmentName: 'VaultListFragment' };
    case 'detailed':
      return { fragment: VAULT_FRAGMENT, fragmentName: 'VaultFragment' };
    default:
      return { fragment: VAULT_LIST_FRAGMENT, fragmentName: 'VaultListFragment' };
  }
}

/**
 * Create yield prediction GraphQL query with dynamic fragment selection
 */
export function createYieldPredictionQuery(
  responseFormat: PredictionResponseFormat = 'quick'
): string {
  const { fragment, fragmentName } = getFragmentForPredictionResponseFormat(responseFormat);

  return `
    query YieldPrediction($vaultAddress: Address!, $chainId: Int!) {
      vault: vaultByAddress(address: $vaultAddress, chainId: $chainId) {
        ...${fragmentName}
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
    ${fragment}
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
export const YIELD_PREDICTION_QUERY = createYieldPredictionQuery('detailed');
