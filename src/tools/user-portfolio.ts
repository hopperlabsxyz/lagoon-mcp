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
import { VaultData, RawVaultComposition, ChainComposition } from '../graphql/fragments/index.js';
import {
  createGetUserPortfolioQuery,
  SINGLE_VAULT_COMPOSITION_QUERY,
} from '../graphql/queries/portfolio.queries.js';
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
 * Chain exposure in portfolio
 * Note: Backend API changed from protocol-based to chain-based composition
 */
interface ChainExposure {
  chainKey: string;
  chainName: string;
  chainId: string;
  valueUsd: number;
  repartition: number;
  vaultCount: number;
}

/**
 * Accidental concentration warning (cross-chain)
 */
interface AccidentalConcentration {
  chainKey: string;
  chainName: string;
  vaultCount: number;
  totalExposure: number;
  vaultAddresses: string[];
}

/**
 * Portfolio composition summary with diversification metrics
 * Note: Now uses chain-based composition from Octav API
 */
interface PortfolioCompositionSummary {
  chainExposure: ChainExposure[];
  portfolioHHI: number;
  diversificationLevel: 'High' | 'Medium' | 'Low';
  topChain: string | null;
  topChainPercent: number | null;
  accidentalConcentration: AccidentalConcentration[];
}

/**
 * Aggregated portfolio data
 */
interface AggregatedPortfolio {
  userAddress: string;
  positions: PortfolioPosition[];
  totalValueUsd: string;
  positionCount: number;
  compositionSummary?: PortfolioCompositionSummary;
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
 * Processed chain summary from raw composition data
 */
interface ProcessedChainSummary {
  chainKey: string;
  chainName: string;
  chainId: string;
  valueUsd: number;
  percentage: number;
}

/**
 * Vault composition data with vault address for aggregation
 * Note: Now uses chain-based structure from Octav API
 */
interface VaultCompositionEntry {
  vaultAddress: string;
  positionValueUsd: number;
  chains: ProcessedChainSummary[];
}

/**
 * Response type for single vault composition query
 * Note: Backend returns JSONObject with chains as keys
 */
interface SingleVaultCompositionResponse {
  vaultComposition: RawVaultComposition | null;
}

/**
 * Transform raw composition data to processed chain summaries
 */
function transformRawCompositionToChains(raw: RawVaultComposition | null): ProcessedChainSummary[] {
  if (!raw || Object.keys(raw).length === 0) {
    return [];
  }

  // Filter and transform to chain summaries
  const chains: ProcessedChainSummary[] = Object.entries(raw)
    .filter(([, chain]: [string, ChainComposition]) => {
      const value = parseFloat(chain.value);
      return !isNaN(value) && value > 0;
    })
    .map(([key, chain]: [string, ChainComposition]) => ({
      chainKey: key,
      chainName: chain.name,
      chainId: chain.chainId,
      valueUsd: parseFloat(chain.value),
      percentage: 0, // Calculate after total
    }));

  // Calculate percentages
  const totalValue = chains.reduce((sum, c) => sum + c.valueUsd, 0);
  chains.forEach((c) => {
    c.percentage = totalValue > 0 ? (c.valueUsd / totalValue) * 100 : 0;
  });

  // Sort by value descending
  chains.sort((a, b) => b.valueUsd - a.valueUsd);

  return chains;
}

/**
 * Aggregate composition data across all portfolio positions
 *
 * Calculates portfolio-wide chain exposure weighted by position size,
 * portfolio-level HHI, and detects accidental concentration across vaults.
 *
 * Note: Backend API changed from protocol-based to chain-based composition
 *
 * @param vaultCompositions - Array of vault compositions with position values
 * @param totalPortfolioValue - Total portfolio value in USD
 * @returns Portfolio composition summary with diversification metrics
 */
function aggregatePortfolioComposition(
  vaultCompositions: VaultCompositionEntry[],
  totalPortfolioValue: number
): PortfolioCompositionSummary {
  // Track chain exposure across all vaults
  const chainExposureMap = new Map<
    string,
    { chainName: string; chainId: string; valueUsd: number; vaultAddresses: string[] }
  >();

  // Aggregate weighted exposure from each vault
  for (const entry of vaultCompositions) {
    for (const chain of entry.chains) {
      // Weight the chain exposure by position size
      const weightedExposure = (chain.percentage / 100) * entry.positionValueUsd;
      const existing = chainExposureMap.get(chain.chainKey);

      if (existing) {
        existing.valueUsd += weightedExposure;
        if (!existing.vaultAddresses.includes(entry.vaultAddress)) {
          existing.vaultAddresses.push(entry.vaultAddress);
        }
      } else {
        chainExposureMap.set(chain.chainKey, {
          chainName: chain.chainName,
          chainId: chain.chainId,
          valueUsd: weightedExposure,
          vaultAddresses: [entry.vaultAddress],
        });
      }
    }
  }

  // Convert to array and calculate repartition percentages
  const exposures: ChainExposure[] = Array.from(chainExposureMap.entries())
    .map(([chainKey, data]) => ({
      chainKey,
      chainName: data.chainName,
      chainId: data.chainId,
      valueUsd: data.valueUsd,
      repartition: totalPortfolioValue > 0 ? (data.valueUsd / totalPortfolioValue) * 100 : 0,
      vaultCount: data.vaultAddresses.length,
    }))
    .sort((a, b) => b.repartition - a.repartition);

  // Calculate portfolio-level HHI
  const portfolioHHI = exposures.reduce((sum, e) => sum + Math.pow(e.repartition / 100, 2), 0);

  // Determine diversification level
  const diversificationLevel: 'High' | 'Medium' | 'Low' =
    portfolioHHI < 0.15 ? 'High' : portfolioHHI < 0.25 ? 'Medium' : 'Low';

  // Detect accidental concentration (same chain in 3+ vaults with >20% total exposure)
  const accidentalConcentration: AccidentalConcentration[] = [];
  for (const [chainKey, data] of chainExposureMap.entries()) {
    const totalExposure = totalPortfolioValue > 0 ? (data.valueUsd / totalPortfolioValue) * 100 : 0;
    if (data.vaultAddresses.length >= 3 && totalExposure >= 20) {
      accidentalConcentration.push({
        chainKey,
        chainName: data.chainName,
        vaultCount: data.vaultAddresses.length,
        totalExposure,
        vaultAddresses: data.vaultAddresses,
      });
    }
  }

  return {
    chainExposure: exposures.slice(0, 10), // Top 10 chains
    portfolioHHI,
    diversificationLevel,
    topChain: exposures[0]?.chainName || null,
    topChainPercent: exposures[0]?.repartition || null,
    accidentalConcentration,
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

    // Post-process response to add flat chainId field for easier Claude extraction
    // Also cache individual vaults for reuse by vault_data tool
    // And fetch composition data for portfolio-level diversification analysis
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const responseData = JSON.parse(result.content[0].text) as AggregatedPortfolio;
        if (responseData.positions && Array.isArray(responseData.positions)) {
          // Enrich each vault with flat chainId and cache individually
          const positions = responseData.positions;
          positions.forEach((position: PortfolioPosition) => {
            if (position.vault && position.vault.chain?.id) {
              // Add flat chainId as integer for easier extraction by Claude
              // This allows Claude to use vault.chainId directly instead of parseInt(vault.chain.id)
              (position.vault as VaultData & { chainId: number }).chainId = Number(
                position.vault.chain.id
              );

              // Cache each vault from positions individually with vault-specific key
              if (position.vault.address) {
                const vaultCacheKey = generateCacheKey(CacheTag.VAULT, {
                  address: String(position.vault.address),
                  chainId: Number(position.vault.chain.id),
                });
                container.cache.set(vaultCacheKey, position.vault, cacheTTL.vaultData);
              }
            }
          });

          // Fetch composition data for each vault in parallel
          // This enables portfolio-wide diversification analysis
          // Note: Backend API now uses walletAddress parameter and returns chain-based data
          const compositionPromises = positions.map(async (position) => {
            try {
              const compResponse =
                await container.graphqlClient.request<SingleVaultCompositionResponse>(
                  SINGLE_VAULT_COMPOSITION_QUERY,
                  { walletAddress: position.vaultAddress }
                );

              const chains = transformRawCompositionToChains(compResponse.vaultComposition);
              if (chains.length > 0) {
                return {
                  vaultAddress: position.vaultAddress,
                  positionValueUsd: parseFloat(position.sharesUsd || '0'),
                  chains,
                } as VaultCompositionEntry;
              }
              return null;
            } catch {
              // If composition fetch fails for a vault, skip it
              return null;
            }
          });

          // Wait for all composition fetches (with timeout protection)
          const compositionResults = await Promise.all(compositionPromises);
          const validCompositions = compositionResults.filter(
            (c): c is VaultCompositionEntry => c !== null
          );

          // If we have composition data, calculate portfolio-level diversification
          if (validCompositions.length > 0) {
            const totalPortfolioValue = parseFloat(responseData.totalValueUsd || '0');
            responseData.compositionSummary = aggregatePortfolioComposition(
              validCompositions,
              totalPortfolioValue
            );
          }

          // Update the result content with enriched data
          result.content[0].text = JSON.stringify(responseData);
        }
      } catch (error) {
        // If parsing fails, just return the result without enrichment
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
