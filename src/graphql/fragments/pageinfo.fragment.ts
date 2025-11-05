/**
 * PageInfo Fragments
 *
 * Reusable fragments for pagination information.
 * Provides minimal and full variants depending on query needs.
 */

/**
 * Minimal pagination information
 *
 * Use when you only need to know if there are more pages.
 *
 * Usage:
 * ```graphql
 * pageInfo {
 *   ...PageInfoMinimalFragment
 * }
 * ```
 */
export const PAGEINFO_MINIMAL_FRAGMENT = `
  fragment PageInfoMinimalFragment on PageInfo {
    hasNextPage
    hasPreviousPage
  }
`;

/**
 * Complete pagination information
 *
 * Use when you need comprehensive pagination metadata.
 *
 * Usage:
 * ```graphql
 * pageInfo {
 *   ...PageInfoFullFragment
 * }
 * ```
 */
export const PAGEINFO_FULL_FRAGMENT = `
  fragment PageInfoFullFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    count
    limit
    skip
    totalCount
  }
`;
