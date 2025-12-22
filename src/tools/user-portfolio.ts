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
 * - Protocol diversification analysis across vaults
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
import {
  VaultData,
  VaultCompositionFullResponse,
  ProtocolCompositionData,
} from '../graphql/fragments/index.js';
import {
  createGetUserPortfolioQuery,
  SINGLE_VAULT_COMPOSITION_QUERY,
} from '../graphql/queries/portfolio.queries.js';
import type { PortfolioResponseFormat } from '../graphql/queries/portfolio.queries.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL, generateCacheKey } from '../cache/index.js';
import { rateLimitedMap } from '../utils/rate-limiter.js';

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
 * Protocol exposure in portfolio (aggregated across vaults)
 * Uses assetByProtocols from Octav API for DeFi protocol analysis
 */
interface ProtocolExposure {
  protocolKey: string;
  protocolName: string;
  valueUsd: number;
  repartition: number;
  vaultCount: number;
}

/**
 * Accidental concentration warning (same protocol across multiple vaults)
 */
interface AccidentalConcentration {
  protocolKey: string;
  protocolName: string;
  vaultCount: number;
  totalExposure: number;
  vaultAddresses: string[];
}

/**
 * Portfolio composition summary with diversification metrics
 * Uses protocol-based composition from Octav API's assetByProtocols
 */
interface PortfolioCompositionSummary {
  protocolExposure: ProtocolExposure[];
  portfolioHHI: number;
  diversificationLevel: 'High' | 'Medium' | 'Low';
  topProtocol: string | null;
  topProtocolPercent: number | null;
  /** Percentage of assets in "wallet" (idle, not deployed in DeFi) */
  idleAssetsPercent: number;
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
 * Processed protocol summary from raw composition data
 */
interface ProcessedProtocolSummary {
  protocolKey: string;
  protocolName: string;
  valueUsd: number;
  percentage: number;
}

/**
 * Vault composition data with vault address for aggregation
 * Uses protocol-based structure from Octav API's assetByProtocols
 */
interface VaultCompositionEntry {
  vaultAddress: string;
  positionValueUsd: number;
  protocols: ProcessedProtocolSummary[];
}

/**
 * Response type for single vault composition query
 * Note: Backend returns JSONObject with full response structure
 */
interface SingleVaultCompositionResponse {
  vaultComposition: VaultCompositionFullResponse | null;
}

/**
 * Transform raw composition data to processed protocol summaries
 * Uses assetByProtocols field for protocol-level breakdown
 */
function transformRawCompositionToProtocols(
  raw: VaultCompositionFullResponse | null
): ProcessedProtocolSummary[] {
  if (!raw || !raw.assetByProtocols || Object.keys(raw.assetByProtocols).length === 0) {
    return [];
  }

  // Filter and transform to protocol summaries
  const protocols: ProcessedProtocolSummary[] = Object.entries(raw.assetByProtocols)
    .filter(([, protocol]: [string, ProtocolCompositionData]) => {
      const value = parseFloat(protocol.value);
      return !isNaN(value) && value > 0;
    })
    .map(([key, protocol]: [string, ProtocolCompositionData]) => ({
      protocolKey: key,
      protocolName: protocol.name,
      valueUsd: parseFloat(protocol.value),
      percentage: 0, // Calculate after total
    }));

  // Calculate percentages
  const totalValue = protocols.reduce((sum, p) => sum + p.valueUsd, 0);
  protocols.forEach((p) => {
    p.percentage = totalValue > 0 ? (p.valueUsd / totalValue) * 100 : 0;
  });

  // Sort by value descending
  protocols.sort((a, b) => b.valueUsd - a.valueUsd);

  return protocols;
}

/**
 * Aggregate composition data across all portfolio positions
 *
 * Calculates portfolio-wide protocol exposure weighted by position size,
 * portfolio-level HHI, and detects accidental concentration across vaults.
 *
 * Uses assetByProtocols from Octav API for protocol-based diversification analysis.
 * "wallet" protocol (idle assets) is excluded from HHI but tracked as idleAssetsPercent.
 *
 * @param vaultCompositions - Array of vault compositions with position values
 * @param totalPortfolioValue - Total portfolio value in USD
 * @returns Portfolio composition summary with diversification metrics
 */
function aggregatePortfolioComposition(
  vaultCompositions: VaultCompositionEntry[],
  totalPortfolioValue: number
): PortfolioCompositionSummary {
  // Track protocol exposure across all vaults
  const protocolExposureMap = new Map<
    string,
    { protocolName: string; valueUsd: number; vaultAddresses: string[] }
  >();

  // Aggregate weighted exposure from each vault
  for (const entry of vaultCompositions) {
    for (const protocol of entry.protocols) {
      // Weight the protocol exposure by position size
      const weightedExposure = (protocol.percentage / 100) * entry.positionValueUsd;
      const existing = protocolExposureMap.get(protocol.protocolKey);

      if (existing) {
        existing.valueUsd += weightedExposure;
        if (!existing.vaultAddresses.includes(entry.vaultAddress)) {
          existing.vaultAddresses.push(entry.vaultAddress);
        }
      } else {
        protocolExposureMap.set(protocol.protocolKey, {
          protocolName: protocol.protocolName,
          valueUsd: weightedExposure,
          vaultAddresses: [entry.vaultAddress],
        });
      }
    }
  }

  // Convert to array and calculate repartition percentages
  const allExposures: ProtocolExposure[] = Array.from(protocolExposureMap.entries())
    .map(([protocolKey, data]) => ({
      protocolKey,
      protocolName: data.protocolName,
      valueUsd: data.valueUsd,
      repartition: totalPortfolioValue > 0 ? (data.valueUsd / totalPortfolioValue) * 100 : 0,
      vaultCount: data.vaultAddresses.length,
    }))
    .sort((a, b) => b.repartition - a.repartition);

  // Separate wallet (idle assets) from DeFi protocols for HHI calculation
  const walletExposure = allExposures.find((e) => e.protocolKey === 'wallet');
  const defiExposures = allExposures.filter((e) => e.protocolKey !== 'wallet');

  // Recalculate percentages for DeFi-only (for HHI)
  const defiTotalValue = defiExposures.reduce((sum, e) => sum + e.valueUsd, 0);
  const defiExposuresForHHI = defiExposures.map((e) => ({
    ...e,
    repartition: defiTotalValue > 0 ? (e.valueUsd / defiTotalValue) * 100 : 0,
  }));

  // Calculate portfolio-level HHI (excluding wallet)
  const portfolioHHI = defiExposuresForHHI.reduce(
    (sum, e) => sum + Math.pow(e.repartition / 100, 2),
    0
  );

  // Determine diversification level
  const diversificationLevel: 'High' | 'Medium' | 'Low' =
    portfolioHHI < 0.15 ? 'High' : portfolioHHI < 0.25 ? 'Medium' : 'Low';

  // Calculate idle assets percentage
  const idleAssetsPercent = walletExposure?.repartition || 0;

  // Detect accidental concentration (same protocol in 3+ vaults with >20% total exposure)
  const accidentalConcentration: AccidentalConcentration[] = [];
  for (const [protocolKey, data] of protocolExposureMap.entries()) {
    // Skip wallet for concentration warnings
    if (protocolKey === 'wallet') continue;

    const totalExposure = totalPortfolioValue > 0 ? (data.valueUsd / totalPortfolioValue) * 100 : 0;
    if (data.vaultAddresses.length >= 3 && totalExposure >= 20) {
      accidentalConcentration.push({
        protocolKey,
        protocolName: data.protocolName,
        vaultCount: data.vaultAddresses.length,
        totalExposure,
        vaultAddresses: data.vaultAddresses,
      });
    }
  }

  return {
    protocolExposure: allExposures.slice(0, 10), // Top 10 protocols (including wallet for transparency)
    portfolioHHI: parseFloat(portfolioHHI.toFixed(4)),
    diversificationLevel,
    topProtocol: defiExposures[0]?.protocolName || null, // Top DeFi protocol (not wallet)
    topProtocolPercent: defiExposures[0]?.repartition || null,
    idleAssetsPercent: parseFloat(idleAssetsPercent.toFixed(2)),
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

          // Fetch composition data for each vault with rate limiting
          // This enables portfolio-wide diversification analysis
          // Note: Backend API returns full response with assetByProtocols
          // Rate limited to prevent 429 errors from GraphQL API
          const compositionResults = await rateLimitedMap(
            positions,
            async (position) => {
              try {
                const compResponse =
                  await container.graphqlClient.request<SingleVaultCompositionResponse>(
                    SINGLE_VAULT_COMPOSITION_QUERY,
                    { walletAddress: position.vaultAddress }
                  );

                const protocols = transformRawCompositionToProtocols(compResponse.vaultComposition);
                if (protocols.length > 0) {
                  return {
                    vaultAddress: position.vaultAddress,
                    positionValueUsd: parseFloat(position.sharesUsd || '0'),
                    protocols,
                  } as VaultCompositionEntry;
                }
                return null;
              } catch {
                // If composition fetch fails for a vault, skip it
                return null;
              }
            },
            2 // Max 2 concurrent requests to respect rate limits
          );
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
