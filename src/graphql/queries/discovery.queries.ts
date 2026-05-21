/**
 * Discovery Queries
 *
 * Thin GraphQL queries for "what does Lagoon look like right now?" tools:
 * global TVL, indexing health, chain directory, curator directory, single asset
 * lookup, and historical vault state.
 *
 * All queries are direct, single-shot, low-cost. They intentionally do NOT
 * pull VaultFragment — these are metadata endpoints, not vault drill-downs.
 */

/**
 * Total protocol TVL across all chains (USD).
 * Used by: get_global_tvl tool. No args.
 */
export const GET_GLOBAL_TVL_QUERY = `
  query GetGlobalTVL {
    getGlobalTVL
  }
`;

/**
 * Indexer health — last indexed block per chain.
 * Used by: get_indexing_status tool. Optional chainIds filter.
 */
export const GET_INDEXING_STATUS_QUERY = `
  query GetIndexingStatus($chainIds: [Int!]) {
    _meta(chainIds: $chainIds) {
      lastIndexedBlocks {
        chainId
        number
        hash
        parentHash
        chain {
          id
          name
          nativeToken
        }
      }
    }
  }
`;

/**
 * Chain directory. Paginated; default ordering by id ascending.
 * Used by: list_chains tool.
 */
export const LIST_CHAINS_QUERY = `
  query ListChains($first: Int, $skip: Int, $where: ChainFilterInput) {
    chains(first: $first, skip: $skip, where: $where, orderBy: id, orderDirection: asc) {
      items {
        id
        name
        nativeToken
        logoUrl
        isVisible
        factory
        wrappedNativeToken {
          address
          symbol
          name
          decimals
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

/**
 * Curator directory.
 * Used by: list_curators tool.
 */
export const LIST_CURATORS_QUERY = `
  query ListCurators($first: Int, $skip: Int, $where: CuratorFilterInput) {
    curators(first: $first, skip: $skip, where: $where, orderBy: name, orderDirection: asc) {
      items {
        id
        name
        aboutDescription
        logoUrl
        url
        isVisible
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

/**
 * Single curator lookup by id.
 * Used by: get_curator tool.
 */
export const GET_CURATOR_QUERY = `
  query GetCurator($id: ID!) {
    curator(id: $id) {
      id
      name
      aboutDescription
      logoUrl
      url
      isVisible
    }
  }
`;

/**
 * Single asset (ERC20) lookup by address + chain.
 * Used by: get_asset tool.
 */
export const GET_ASSET_QUERY = `
  query GetAsset($address: Address!, $chainId: Int!) {
    assetByAddress(address: $address, chainId: $chainId) {
      id
      address
      symbol
      name
      decimals
      description
      logoUrl
      isVisible
      priceUsd
      chain {
        id
        name
        nativeToken
        logoUrl
      }
    }
  }
`;

/**
 * Historical vault state at a specific Unix timestamp.
 * Used by: get_historical_state tool.
 *
 * Note: requests the full HistoricalVaultState shape (which mirrors VaultState
 * shape but with `asOfTimestamp`). Some optional fields may be null on older
 * vaults that pre-date a given configuration field.
 */
export const GET_HISTORICAL_STATE_QUERY = `
  query GetHistoricalState($address: Address!, $chainId: Int!, $timestamp: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      stateAt(timestamp: $timestamp) {
        state
        syncMode
        isAsyncOnly
        safeLocked
        superOperatorLocked
        allowHighWaterMarkReset
        accessMode
        externalSanctionsList
        maxCap
        totalAssets
        totalAssetsExpiration
        pricePerShare
        pricePerShareUsd
        managementFee
        performanceFee
        protocolFee
        entryRate
        exitRate
        haircutRate
        feeRatesCooldown
        newRatesTimestamp
        highWaterMark
        lastFeeTime
        newTotalAssets
        isWhitelistActivated
        roles {
          owner
          valuationManager
          whitelistManager
          safe
          feeReceiver
          securityCouncil
          superOperator
        }
        guardrails {
          activated
          lowerRate
          upperRate
        }
      }
    }
  }
`;
