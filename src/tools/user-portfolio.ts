/**
 * get_user_portfolio Tool
 *
 * Fetch user's complete portfolio across all chains with 5-minute caching.
 * Optimized for cross-chain portfolio aggregation using single query.
 *
 * Use cases:
 * - Multi-chain portfolio analysis
 * - User position tracking across all supported chains
 * - Portfolio value aggregation
 * - Performance: ~500-1000 tokens per user (depending on position count)
 *
 * Cache strategy:
 * - 5-minute TTL for frequently changing user positions
 * - Cache key: portfolio:{address}
 * - Single query returns all chains at once
 * - Cache hit rate target: 70-80%
 * - Cache tags: [CacheTag.PORTFOLIO] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetUserPortfolioInput } from '../utils/validators.js';
import { VaultData } from '../graphql/fragments/index.js';
import { GET_USER_PORTFOLIO_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';

/**
 * User portfolio response type using shared types
 */
interface UserPortfolioResponse {
  users: {
    items: Array<{
      state: {
        totalSharesUsd: string;
      };
      vaultPositions: Array<{
        vault: VaultData;
        state: {
          assets: string;
          shares: string;
          sharesUsd: string;
        };
      }>;
    }>;
  };
}

/**
 * Aggregated portfolio position with complete vault metadata
 */
interface PortfolioPosition {
  // Vault identification
  vaultAddress: string;
  vaultSymbol: string | null;
  vaultName: string | null;

  // Asset information
  assetSymbol: string;
  assetAddress: string;

  // Position state
  shares: string;
  assets: string;
  sharesUsd: string;

  // Additional vault metadata (for advanced use cases)
  vault: VaultData;
}

/**
 * Aggregated portfolio data
 */
interface AggregatedPortfolio {
  userAddress: string;
  positions: PortfolioPosition[];
  totalValueUsd: string;
  positionCount: number;
}

/**
 * GraphQL variables type for GET_USER_PORTFOLIO_QUERY
 */
interface GetUserPortfolioVariables {
  where: {
    user_eq: string;
  };
}

/**
 * Transform raw GraphQL response into aggregated portfolio
 */
function createTransformPortfolioData(userAddress: string) {
  return (data: UserPortfolioResponse): AggregatedPortfolio => {
    const positions: PortfolioPosition[] = [];
    let totalValueUsd = 0;

    // Process all user items (typically one user)
    for (const user of data.users.items) {
      // Add user's total value
      const userTotalUsd = parseFloat(user.state.totalSharesUsd || '0');
      totalValueUsd += userTotalUsd;

      // Process each vault position
      for (const position of user.vaultPositions) {
        positions.push({
          // Vault identification
          vaultAddress: position.vault.address,
          vaultSymbol: position.vault.symbol,
          vaultName: position.vault.name,

          // Asset information
          assetSymbol: position.vault.asset.symbol,
          assetAddress: position.vault.asset.address,

          // Position state
          shares: position.state.shares,
          assets: position.state.assets,
          sharesUsd: position.state.sharesUsd,

          // Complete vault metadata
          vault: position.vault,
        });
      }
    }

    // Sort positions by USD value (descending)
    positions.sort((a, b) => {
      const aUsd = parseFloat(a.sharesUsd || '0');
      const bUsd = parseFloat(b.sharesUsd || '0');
      return bUsd - aUsd;
    });

    return {
      userAddress,
      positions,
      totalValueUsd: totalValueUsd.toFixed(2),
      positionCount: positions.length,
    };
  };
}

/**
 * Create the executeGetUserPortfolio function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteGetUserPortfolio(
  container: ServiceContainer
): (input: GetUserPortfolioInput) => Promise<CallToolResult> {
  return (input: GetUserPortfolioInput) => {
    const executor = executeToolWithCache<
      GetUserPortfolioInput,
      UserPortfolioResponse,
      GetUserPortfolioVariables,
      AggregatedPortfolio
    >({
      container,
      cacheKey: (input) => cacheKeys.userPortfolio(input.userAddress),
      cacheTTL: cacheTTL.userPortfolio,
      query: GET_USER_PORTFOLIO_QUERY,
      variables: (input) => ({
        where: {
          user_eq: input.userAddress,
        },
      }),
      validateResult: (data) => ({
        valid: !!(data.users.items && data.users.items.length > 0),
        message:
          data.users.items && data.users.items.length > 0
            ? undefined
            : `No portfolio data found for user: ${String(data)}`,
      }),
      transformResult: createTransformPortfolioData(input.userAddress),
      toolName: 'get_user_portfolio',
    });

    // Register cache tags for invalidation
    const cacheKey = cacheKeys.userPortfolio(input.userAddress);
    container.cacheInvalidator.register(cacheKey, [CacheTag.PORTFOLIO]);

    return executor(input);
  };
}
