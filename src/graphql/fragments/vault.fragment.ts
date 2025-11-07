/**
 * Vault Fragment
 *
 * Complete vault data GraphQL fragment with ALL available fields.
 * Use this fragment in any query that needs comprehensive vault information.
 */

import { type APRBreakdown } from './apr-breakdown.fragment.js';
import { ASSET_INFO_FRAGMENT } from './asset-info.fragment.js';
import { CHAIN_INFO_FRAGMENT } from './chain-info.fragment.js';
import { APR_BREAKDOWN_FRAGMENT } from './apr-breakdown.fragment.js';

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
      shares: string;
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
    version?: string;
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
 * GraphQL fragment for complete vault data
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
 * \${VAULT_FRAGMENT}
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
      ...AssetInfoFragment
    }
    chain {
      ...ChainInfoFragment
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
        shares
      }
      inceptionApr {
        ...APRBreakdownFragment
      }
      pendingSiloBalances {
        assets
        shares
      }
      monthlyApr {
        ...APRBreakdownFragment
      }
      newTotalAssets
      highWaterMark
      lastFeeTime
      safeAssetBalanceUsd
      weeklyApr {
        ...APRBreakdownFragment
      }
      yearlyApr {
        ...APRBreakdownFragment
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
  ${ASSET_INFO_FRAGMENT}
  ${CHAIN_INFO_FRAGMENT}
  ${APR_BREAKDOWN_FRAGMENT}
`;
