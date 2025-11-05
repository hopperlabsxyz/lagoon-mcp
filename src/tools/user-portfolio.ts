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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { GetUserPortfolioInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import { VaultData } from '../graphql/fragments/index.js';
import { GET_USER_PORTFOLIO_QUERY } from '../graphql/queries/index.js';

// Query now imported from ../graphql/queries/index.js

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
 * Fetch user portfolio across all chains with single query
 *
 * @param input - User address (pre-validated by createToolHandler)
 * @returns Aggregated portfolio data or error
 */
export async function executeGetUserPortfolio(
  input: GetUserPortfolioInput
): Promise<CallToolResult> {
  try {
    // Generate cache key (input already validated by createToolHandler)
    const cacheKey = cacheKeys.userPortfolio(input.userAddress);

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return createSuccessResponse(cachedData);
    }

    // Execute single query for all chains
    const data = await graphqlClient.request<UserPortfolioResponse>(GET_USER_PORTFOLIO_QUERY, {
      where: {
        user_eq: input.userAddress,
      },
    });

    // Handle case where no user data found
    if (!data.users.items || data.users.items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No portfolio data found for user: ${input.userAddress}`,
          },
        ],
        isError: false,
      };
    }

    // Process response and aggregate positions
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

    // Build aggregated result
    const aggregatedPortfolio = {
      userAddress: input.userAddress,
      positions,
      totalValueUsd: totalValueUsd.toFixed(2),
      positionCount: positions.length,
    };

    // Store in cache with 5-minute TTL
    cache.set(cacheKey, aggregatedPortfolio, cacheTTL.userPortfolio);

    // Return successful response
    return createSuccessResponse(aggregatedPortfolio);
  } catch (error) {
    return handleToolError(error, 'get_user_portfolio');
  }
}
