/**
 * APR Breakdown Fragment
 *
 * Reusable fragment for APR breakdown structure across all time periods.
 * Used in: inceptionApr, weeklyApr, monthlyApr, yearlyApr
 *
 * Reduces duplication of 43-line APR structure from 4 instances to 1 definition.
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
 * GraphQL fragment for APR breakdown
 *
 * Usage:
 * ```graphql
 * inceptionApr {
 *   ...APRBreakdownFragment
 * }
 * ```
 */
export const APR_BREAKDOWN_FRAGMENT = `
  fragment APRBreakdownFragment on APRs {
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
`;
