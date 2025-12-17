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
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { VaultData } from '../graphql/fragments/index.js';
import { createGetUserPortfolioQuery } from '../graphql/queries/portfolio.queries.js';
import type { PortfolioResponseFormat } from '../graphql/queries/portfolio.queries.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL, generateCacheKey } from '../cache/index.js';

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
  return async (input: GetUserPortfolioInput): Promise<CallToolResult> => {
    // Determine response format (default to 'summary' for balanced performance)
    const responseFormat: PortfolioResponseFormat =
      input.responseFormat === 'list'
        ? 'list'
        : input.responseFormat === 'full'
          ? 'full'
          : 'summary';

    // Generate cache key (responseFormat doesn't affect caching since fragments are structural)
    const cacheKey = cacheKeys.userPortfolio(input.userAddress);

    // Create dynamic query based on responseFormat
    const query: string = createGetUserPortfolioQuery(responseFormat);

    const executor = executeToolWithCache<
      GetUserPortfolioInput,
      UserPortfolioResponse,
      GetUserPortfolioVariables,
      AggregatedPortfolio
    >({
      container,
      cacheKey: () => cacheKey,
      cacheTTL: cacheTTL.userPortfolio,
      query,
      variables: (input) => ({
        where: {
          user_eq: input.userAddress,
        },
      }),
      validateResult: (data) => {
        const hasData = !!(data.users.items && data.users.items.length > 0);
        return {
          valid: hasData,
          message: hasData ? undefined : `No portfolio data found for user: ${String(data)}`,
          isError: !hasData,
        };
      },
      transformResult: createTransformPortfolioData(input.userAddress),
      toolName: 'get_user_portfolio',
    });

    // Register cache tags for invalidation
    container.cacheInvalidator.register(cacheKey, [CacheTag.PORTFOLIO]);

    // Execute query
    const result = await executor(input);

    // NEW: Fragment-level caching - cache each vault from positions for reuse
    // This enables vault_data tool to reuse vaults from portfolio results
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const responseData = JSON.parse(result.content[0].text) as {
          positions?: PortfolioPosition[];
        };
        if (responseData.positions && Array.isArray(responseData.positions)) {
          // Cache each vault from positions individually with vault-specific key
          const positions = responseData.positions;
          positions.forEach((position: PortfolioPosition) => {
            if (position.vault && position.vault.address && position.vault.chain?.id) {
              const vaultCacheKey = generateCacheKey(CacheTag.VAULT, {
                address: String(position.vault.address),
                chainId: Number(position.vault.chain.id),
              });
              container.cache.set(vaultCacheKey, position.vault, cacheTTL.vaultData);
            }
          });
        }
      } catch (error) {
        // If parsing fails, just return the result without fragment caching
        // This is a non-critical optimization
      }
    }

    // Add legal disclaimer to output
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('user_portfolio');
    }

    return result;
  };
}
