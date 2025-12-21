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
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for batch vault risk analysis data
 *
 * Fetches data for multiple vaults in a single request, reducing API calls.
 * Uses address_in filter to fetch all vaults at once.
 *
 * Key differences from single vault query:
 * - Fetches multiple vaults using address_in filter
 * - Shares allVaults context across all vaults (single fetch)
 * - Per-vault curator and price data fetched separately in service layer
 *
 * Used by: analyze_risks tool (batch)
 *
 * Usage:
 * ```typescript
 * const data = await graphqlClient.request<BatchRiskAnalysisResponse>(
 *   BATCH_RISK_ANALYSIS_QUERY,
 *   {
 *     vaultAddresses: ['0x...', '0x...'],
 *     chainId: 1
 *   }
 * );
 * ```
 */
export const BATCH_RISK_ANALYSIS_QUERY = `
  query BatchRiskAnalysis(
    $vaultAddresses: [String!]!,
    $chainId: Int!
  ) {
    # Get all requested vaults in single query
    vaults(where: { address_in: $vaultAddresses, chainId_eq: $chainId }) {
      items {
        ...VaultFragment
      }
    }

    # Get all vaults on chain for concentration risk calculation (shared context)
    allVaults: vaults(where: { chainId_eq: $chainId, isVisible_eq: true }) {
      items {
        state {
          totalAssetsUsd
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for cross-chain batch risk analysis
 *
 * For analyzing vaults across multiple chains, we need separate queries per chain
 * since chainId_eq filter only supports single chain.
 * This query fetches vaults for a single chain - call multiple times for cross-chain.
 *
 * Used by: analyze_risks tool when chainIds array is provided
 */
export const CROSS_CHAIN_VAULTS_QUERY = `
  query CrossChainVaults(
    $vaultAddresses: [String!]!,
    $chainId: Int!
  ) {
    vaults(where: { address_in: $vaultAddresses, chainId_eq: $chainId }) {
      items {
        ...VaultFragment
      }
    }

    allVaults: vaults(where: { chainId_eq: $chainId, isVisible_eq: true }) {
      items {
        state {
          totalAssetsUsd
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;
