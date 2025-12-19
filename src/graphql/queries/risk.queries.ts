/**
 * Risk Queries
 *
 * GraphQL queries for vault risk analysis.
 * Includes multi-factor risk scoring with vault, protocol, and market data.
 */

import { VAULT_FRAGMENT } from '../fragments/index.js';

/**
 * GraphQL query for vault risk analysis data
 *
 * Fetches comprehensive data for multi-factor risk analysis including:
 * - Vault data with complete metadata
 * - All vaults for concentration risk calculation
 * - Curator's other vaults for reputation analysis
 * - Price history for volatility analysis
 *
 * Used by: analyze_risk tool
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<RiskAnalysisResponse>(
 *   RISK_ANALYSIS_QUERY,
 *   {
 *     vaultAddress: '0x...',
 *     chainId: 1,
 *     curatorId: 'curator-id',
 *     where: {
 *       vault_in: ['0x...'],
 *       type_in: ['TotalAssetsUpdated']
 *     },
 *     orderBy: 'timestamp',
 *     orderDirection: 'asc'
 *   }
 * );
 * ```
 */
export const RISK_ANALYSIS_QUERY = `
  query RiskAnalysis(
    $vaultAddress: Address!,
    $chainId: Int!,
    $curatorId: String!,
    $where: TransactionFilterInput!,
    $orderBy: TransactionOrderBy!,
    $orderDirection: OrderDirection!
  ) {
    vault: vaultByAddress(address: $vaultAddress, chainId: $chainId) {
      ...VaultFragment
    }

    # Get all vaults for concentration risk calculation
    allVaults: vaults(where: { chainId_eq: $chainId, isVisible_eq: true }) {
      items {
        state {
          totalAssetsUsd
        }
      }
    }

    # Get curator's other vaults for reputation analysis
    curatorVaults: vaults(where: { chainId_eq: $chainId, curatorIds_contains: $curatorId }) {
      items {
        address
        state {
          totalAssetsUsd
        }
      }
    }

    # Get price history for volatility analysis
    priceHistory: transactions(
      where: $where,
      orderBy: $orderBy,
      orderDirection: $orderDirection,
      first: 100
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            totalAssets
            totalAssetsUsd
            totalSupply
          }
        }
      }
    }

    # Get composition data for cross-chain diversification risk
    # Note: Backend API changed - uses walletAddress and returns JSONObject with chains
    composition: vaultComposition(walletAddress: $vaultAddress)
  }
  ${VAULT_FRAGMENT}
`;
