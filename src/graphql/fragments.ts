/**
 * Shared GraphQL Fragments
 *
 * Reusable query fragments for consistent data fetching across tools.
 * Maintains single source of truth for complex nested structures.
 */

/**
 * APR breakdown structure used across all APR time periods
 */
export interface APRBreakdown {
  linearNetApr: number;
  linearNetAprWithoutExtraYields: number;
  airdrops: Array<{
    name: string;
    apr: number;
    description: string | null;
    distributionTimestamp: string;
    endTimestamp: number;
    isEstimation: boolean;
    logoUrl: string;
    multiplier: string | null;
    ppsIncrease: number;
    startTimestamp: number;
  }>;
  incentives: Array<{
    name: string;
    apr: number;
    aprDescription: string;
    description: string | null;
    endTimestamp: number;
    incentiveRate: {
      incentiveAmount: string;
      referenceToken: {
        id: string;
      };
      referenceTokenAmount: string;
    };
  }>;
  nativeYields: Array<{
    name: string;
    apr: number;
    aprDescription: string;
    description: string | null;
    endTimestamp: number | null;
    isEstimation: boolean;
    logoUrl: string;
    multiplier: string | null;
    startTimestamp: number;
  }>;
}

/**
 * Complete vault data type matching the vault fragment
 */
export interface VaultData {
  // Core identification
  address: string;
  symbol: string | null;
  name: string | null;
  description: string | null;
  shortDescription: string | null;
  decimals: number | null;
  logoUrl: string | null;

  // Configuration
  maxCapacity: string | null;
  averageSettlement: number | null;
  isVisible: boolean;

  // Chain information
  chain: {
    id: number;
    name: string;
    nativeToken: string;
    factory: string;
    logoUrl: string;
    wrappedNativeToken: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    };
  };

  // Asset information
  asset: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    description: string | null;
    logoUrl: string | null;
    isVisible: boolean;
    priceUsd: number;
    chain: {
      id: string;
      name: string;
      nativeToken: string;
      logoUrl: string;
    };
    priceSources: {
      chainlinkPriceFeed: {
        address: string;
        chainId: number;
      } | null;
    };
  };

  // Vault state and financial metrics
  state: {
    // State
    state: string;

    // Assets and shares
    totalAssets: string;
    totalAssetsUsd: number;
    totalSupply: string;
    newTotalAssets: string;

    // Pricing
    pricePerShare: string;
    pricePerShareUsd: number;

    // Balances
    safeAssetBalance: string;
    safeAssetBalanceUsd: number;

    // Pending operations
    pendingSettlement: {
      assets: string;
      assetsUsd: number;
    };
    pendingSiloBalances: {
      assets: string;
      shares: string;
    };

    // Live APR
    liveAPR: {
      grossApr: number;
      name: string;
      netApr: number;
      description: string;
    } | null;

    // APR breakdown by time period
    inceptionApr: APRBreakdown;
    weeklyApr: APRBreakdown;
    monthlyApr: APRBreakdown;
    yearlyApr: APRBreakdown;

    // Roles
    roles: {
      owner: string;
      valuationManager: string;
      whitelistManager: string;
      safe: string;
      feeReceiver: string;
    };

    // Fees
    managementFee: number;
    performanceFee: number;

    // State metadata
    highWaterMark: string;
    lastFeeTime: string;
  };

  // Curators (plural array)
  curators: Array<{
    id: string;
    name: string;
    aboutDescription: string | null;
    logoUrl: string | null;
    url: string | null;
  }> | null;

  // Integrator
  integrator: {
    name: string;
    url: string | null;
    logoUrl: string | null;
    aboutDescription: string | null;
  } | null;

  // DeFi integrations
  defiIntegrations: Array<{
    name: string;
    description: string;
    logoUrl: string;
    link: string;
    type: string;
  }> | null;
}

/**
 * Complete vault data GraphQL fragment
 *
 * Includes ALL available fields for comprehensive vault analysis.
 * Use this fragment in any query that needs complete vault information.
 *
 * Schema verified against working API query on 2025-01-04
 *
 * Usage:
 * ```graphql
 * query MyQuery {
 *   someField {
 *     vault {
 *       ...VaultFragment
 *     }
 *   }
 * }
 * ${VAULT_FRAGMENT}
 * ```
 */
export const VAULT_FRAGMENT = `
  fragment VaultFragment on Vault {
    address
    symbol
    decimals
    name
    description
    shortDescription
    maxCapacity
    logoUrl
    averageSettlement
    isVisible
    asset {
      id
      name
      symbol
      decimals
      address
      logoUrl
      description
      chain {
        id
        name
        nativeToken
        logoUrl
      }
      priceSources {
        chainlinkPriceFeed {
          address
          chainId
        }
      }
      priceUsd
      isVisible
    }
    chain {
      id
      name
      nativeToken
      logoUrl
      wrappedNativeToken {
        address
        decimals
        name
        symbol
      }
      factory
    }
    state {
      state
      totalAssets
      totalAssetsUsd
      totalSupply
      pricePerShare
      pricePerShareUsd
      safeAssetBalance
      liveAPR {
        grossApr
        name
        netApr
        description
      }
      roles {
        owner
        valuationManager
        whitelistManager
        safe
        feeReceiver
      }
      managementFee
      performanceFee
      pendingSettlement {
        assets
        assetsUsd
      }
      inceptionApr {
        linearNetApr
        linearNetAprWithoutExtraYields
        airdrops {
          name
          apr
          description
          distributionTimestamp
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          ppsIncrease
          startTimestamp
        }
        incentives {
          name
          apr
          aprDescription
          description
          endTimestamp
          incentiveRate {
            incentiveAmount
            referenceToken {
              id
            }
            referenceTokenAmount
          }
        }
        nativeYields {
          name
          apr
          aprDescription
          description
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          startTimestamp
        }
      }
      pendingSiloBalances {
        assets
        shares
      }
      monthlyApr {
        linearNetApr
        linearNetAprWithoutExtraYields
        airdrops {
          name
          apr
          description
          distributionTimestamp
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          ppsIncrease
          startTimestamp
        }
        incentives {
          name
          apr
          aprDescription
          description
          endTimestamp
          incentiveRate {
            incentiveAmount
            referenceToken {
              id
            }
            referenceTokenAmount
          }
        }
        nativeYields {
          name
          apr
          aprDescription
          description
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          startTimestamp
        }
      }
      newTotalAssets
      highWaterMark
      lastFeeTime
      safeAssetBalanceUsd
      weeklyApr {
        linearNetApr
        linearNetAprWithoutExtraYields
        airdrops {
          name
          apr
          description
          distributionTimestamp
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          ppsIncrease
          startTimestamp
        }
        incentives {
          name
          apr
          aprDescription
          description
          endTimestamp
          incentiveRate {
            incentiveAmount
            referenceToken {
              id
            }
            referenceTokenAmount
          }
        }
        nativeYields {
          name
          apr
          aprDescription
          description
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          startTimestamp
        }
      }
      yearlyApr {
        linearNetApr
        linearNetAprWithoutExtraYields
        airdrops {
          name
          apr
          description
          distributionTimestamp
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          ppsIncrease
          startTimestamp
        }
        incentives {
          name
          apr
          aprDescription
          description
          endTimestamp
          incentiveRate {
            incentiveAmount
            referenceToken {
              id
            }
            referenceTokenAmount
          }
        }
        nativeYields {
          name
          apr
          aprDescription
          description
          endTimestamp
          isEstimation
          logoUrl
          multiplier
          startTimestamp
        }
      }
    }
    curators {
      name
      id
      aboutDescription
      logoUrl
      url
    }
    integrator {
      name
      url
      logoUrl
      aboutDescription
    }
    defiIntegrations {
      name
      description
      link
      logoUrl
      type
    }
  }
`;
