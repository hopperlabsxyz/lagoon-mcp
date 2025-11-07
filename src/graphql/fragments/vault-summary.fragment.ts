/**
 * Vault Summary Fragment
 *
 * Balanced vault information with key metrics and relationships.
 * Use when more detail is needed than list format but not full vault data.
 *
 * Token efficiency: ~170 tokens per vault (72% reduction from full fragment)
 *
 * APR Strategy: Includes both liveAPR (with detail) and monthlyApr for flexibility.
 * Vaults use different tracking methods, so both fields ensure robust APR display.
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
    liveAPR: {
      grossApr: number;
      netApr: number;
      name: string;
    } | null;
    monthlyApr: {
      linearNetApr: number;
    };
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
 * - Key financial metrics (TVL, price per share, APR)
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
      liveAPR {
        grossApr
        netApr
        name
      }
      monthlyApr {
        linearNetApr
      }
    }
    curators {
      name
      logoUrl
    }
  }
`;
