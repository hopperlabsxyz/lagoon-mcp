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

  // Unix timestamp (seconds, fractional from Float) of vault initialization onchain.
  creationDate: number;

  // Unix timestamp (seconds) of the inception date used for APR computation.
  // Defaults to the first PeriodSummary timestamp; can be overridden by the
  // curator. PeriodSummaries older than this value are excluded from APR.
  // Optional: may be null for vaults without an explicit inception override.
  inception?: number | null;

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
      // v0.6+ roles (optional for backward compat with older snapshots)
      securityCouncil?: string;
      superOperator?: string;
    };

    // Fees — legacy model (basis points; divide by 100 for %)
    managementFee: number;
    performanceFee: number;
    protocolFee: number;

    // Fees — v0.6+ model (basis points; divide by 100 for %)
    // Optional: returned by current backends; older snapshots may omit.
    entryRate?: number;
    exitRate?: number;
    haircutRate?: number;
    upcomingManagementFee?: number | null;
    upcomingPerformanceFee?: number | null;
    feeRatesCooldown?: string;
    newRatesTimestamp?: string;

    // Sync / async lifecycle
    syncMode?: 'Both' | 'SyncDeposit' | 'SyncRedeem' | 'None';
    isAsyncOnly?: boolean;
    isPaused?: boolean;

    // Access control
    accessMode?: 'Whitelist' | 'Blacklist' | null;
    blacklist?: string[] | null;
    externalSanctionsList?: string;

    // Capacity & staleness guards
    maxCap?: string | null;
    totalAssetsExpiration?: string;
    totalAssetsLifespan?: string | null;

    // Immutability / lock flags (v0.6+)
    safeLocked?: boolean;
    superOperatorLocked?: boolean | null;
    allowHighWaterMarkReset?: boolean;

    // Guardrails (price-per-share evolution limits)
    guardrails?: {
      activated: boolean;
      lowerRate?: string;
      upperRate?: string;
    };

    // Whitelist configuration
    isWhitelistActivated: boolean;
    whitelist: string[] | null;

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

  // Bundle URLs for composition (Octav/Debank)
  bundles: {
    octav: string | null;
    debank: string | null;
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
    creationDate
    inception
    asset {
      ...AssetInfoFragment
    }
    chain {
      ...ChainInfoFragment
    }
    state {
      state
      version
      syncMode
      isAsyncOnly
      isPaused
      safeLocked
      superOperatorLocked
      allowHighWaterMarkReset
      accessMode
      blacklist
      externalSanctionsList
      maxCap
      totalAssets
      totalAssetsUsd
      totalAssetsExpiration
      totalAssetsLifespan
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
        securityCouncil
        superOperator
      }
      managementFee
      performanceFee
      protocolFee
      entryRate
      exitRate
      haircutRate
      upcomingManagementFee
      upcomingPerformanceFee
      feeRatesCooldown
      newRatesTimestamp
      guardrails {
        activated
        lowerRate
        upperRate
      }
      isWhitelistActivated
      whitelist
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
    bundles {
      octav
      debank
    }
  }
  ${ASSET_INFO_FRAGMENT}
  ${CHAIN_INFO_FRAGMENT}
  ${APR_BREAKDOWN_FRAGMENT}
`;
