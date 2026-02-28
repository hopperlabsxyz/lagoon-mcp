/**
 * Vault Summary Fragment
 *
 * Balanced vault information with key metrics and relationships.
 * Use when more detail is needed than list format but not full vault data.
 * Default format for portfolio queries and vault recommendations.
 *
 * Token efficiency: ~200 tokens per vault (67% reduction from full fragment)
 *
 * APR Strategy: Includes liveAPR, monthlyApr, and inceptionApr (linearNetApr only).
 * Inception APR uses inline field (not full APRBreakdownFragment) to keep token cost low.
 *
 * Decision-making fields: fees and settlement time are included so the AI can
 * make informed recommendations without upgrading to the full fragment (~600 tokens).
 */

/**
 * Summary vault data type matching the vault summary fragment
 */
export interface VaultSummaryData {
  // Core identification
  address: string;
  symbol: string | null;
  name: string | null;
  description: string | null;
  logoUrl: string | null;

  // Configuration
  averageSettlement: number | null;

  // Chain information (minimal)
  chain: {
    id: number;
    name: string;
    logoUrl: string;
  };

  // Asset information (minimal)
  asset: {
    symbol: string;
    name: string;
    logoUrl: string | null;
  };

  // Key financial metrics
  state: {
    totalAssetsUsd: number;
    pricePerShareUsd: number;
    managementFee: number;
    performanceFee: number;
    liveAPR: {
      grossApr: number;
      netApr: number;
      name: string;
    } | null;
    monthlyApr: {
      linearNetApr: number;
    };
    inceptionApr: {
      linearNetApr: number;
    } | null;
  };

  // Relationships
  curators: Array<{
    name: string;
    logoUrl: string | null;
  }> | null;
}

/**
 * GraphQL fragment for summary vault data
 *
 * Includes balanced detail for analysis:
 * - Full identification with logos
 * - Chain and asset basics
 * - Key financial metrics (TVL, price per share, fees, APR)
 * - Settlement time for liquidity assessment
 * - Inception APR (linearNetApr only) for track record
 * - Curator information for relationship analysis
 *
 * Usage:
 * ```graphql
 * query GetVaultSummaries {
 *   vaults {
 *     ...VaultSummaryFragment
 *   }
 * }
 * ${VAULT_SUMMARY_FRAGMENT}
 * ```
 */
export const VAULT_SUMMARY_FRAGMENT = `
  fragment VaultSummaryFragment on Vault {
    address
    symbol
    name
    description
    logoUrl
    averageSettlement
    chain {
      id
      name
      logoUrl
    }
    asset {
      symbol
      name
      logoUrl
    }
    state {
      totalAssetsUsd
      pricePerShareUsd
      managementFee
      performanceFee
      liveAPR {
        grossApr
        netApr
        name
      }
      monthlyApr {
        linearNetApr
      }
      inceptionApr {
        linearNetApr
      }
    }
    curators {
      name
      logoUrl
    }
  }
`;
