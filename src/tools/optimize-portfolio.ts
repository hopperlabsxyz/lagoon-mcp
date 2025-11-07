/**
 * optimize_portfolio Tool
 *
 * Portfolio optimization with rebalancing recommendations using parallel vault queries.
 * Analyzes current holdings and provides optimal allocation strategy based on
 * per-vault historical data (price history and performance metrics).
 *
 * Implementation:
 * - Executes N parallel GraphQL queries (one per vault) using Promise.all
 * - Each vault gets up to 1000 transactions of historical data
 * - Processes per-vault price history for accurate volatility calculation
 * - Uses per-vault performance data for expected APR estimation
 *
 * Use cases:
 * - Portfolio rebalancing and optimization
 * - Risk-adjusted allocation strategies (equal_weight, risk_parity, max_sharpe, min_variance)
 * - Diversification improvement
 * - Performance enhancement through optimal weighting
 * - Performance: ~800-1200 tokens per optimization (scales with vault count)
 *
 * Cache strategy:
 * - 30-minute TTL (balances freshness with stability)
 * - Cache key: portfolio_optimization:{chainId}:{vaultAddresses}:{strategy}
 * - Cache hit rate target: 70-80%
 * - Cache tags: [CacheTag.PORTFOLIO, CacheTag.ANALYTICS] for invalidation
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { OptimizePortfolioInput } from '../utils/validators.js';
import { VaultData } from '../graphql/fragments/index.js';
import { SINGLE_VAULT_OPTIMIZATION_QUERY } from '../graphql/queries/index.js';
import {
  optimizePortfolio,
  VaultForOptimization,
  PortfolioOptimization,
} from '../utils/portfolio-optimization.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';

/**
 * GraphQL response type for single vault query
 */
interface SingleVaultOptimizationResponse {
  vault: VaultData | null;
  priceHistory: {
    items: Array<{
      timestamp: string;
      data: {
        totalAssetsUsd: number;
        totalSupply: string;
      };
    }>;
  };
}

/**
 * Optimization output with markdown
 */
interface PortfolioOptimizationOutput {
  markdown: string;
}

/**
 * Calculate volatility from price history
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) {
    return 0.05; // Default 5% volatility if insufficient data
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(dailyReturn);
    }
  }

  if (returns.length === 0) {
    return 0.05;
  }

  // Calculate standard deviation of returns
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize volatility (assuming daily data)
  return stdDev * Math.sqrt(365);
}

/**
 * Calculate average APR from performance data
 */
function calculateAverageAPR(aprValues: number[]): number {
  if (aprValues.length === 0) {
    return 0;
  }

  return aprValues.reduce((sum, apr) => sum + apr, 0) / aprValues.length;
}

/**
 * Format portfolio optimization as markdown
 */
function formatPortfolioOptimization(optimization: PortfolioOptimization): string {
  const strategyNames = {
    equal_weight: 'Equal Weight',
    risk_parity: 'Risk Parity',
    max_sharpe: 'Maximum Sharpe Ratio',
    min_variance: 'Minimum Variance',
  };

  const rebalanceStatus = optimization.rebalanceNeeded
    ? '⚠️ Rebalancing Recommended'
    : '✅ Well-Balanced';
  const rebalanceEmoji = optimization.rebalanceNeeded ? '⚠️' : '✅';

  return `
## Portfolio Optimization: ${strategyNames[optimization.strategy]}

### Portfolio Summary
- **Total Value**: $${optimization.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- **Number of Positions**: ${optimization.positions.length}
- **Rebalance Status**: ${rebalanceStatus}
- **Rebalance Threshold**: ${optimization.rebalanceThreshold.toFixed(1)}%

---

### Portfolio Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Expected Return** | ${optimization.metrics.expectedReturn.toFixed(2)}% | Annualized portfolio return |
| **Portfolio Risk** | ${optimization.metrics.portfolioRisk.toFixed(2)}% | Volatility (std. deviation) |
| **Sharpe Ratio** | ${optimization.metrics.sharpeRatio.toFixed(2)} | Risk-adjusted return |
| **Diversification** | ${(optimization.metrics.diversificationScore * 100).toFixed(0)}% | Portfolio concentration |

---

### ${rebalanceEmoji} Position Allocations

| Vault | Current | Target | Drift | Action | Amount |
|-------|---------|--------|-------|--------|--------|
${optimization.positions
  .sort(
    (a, b) =>
      Math.abs(b.targetAllocation - b.currentAllocation) -
      Math.abs(a.targetAllocation - a.currentAllocation)
  )
  .map((pos) => {
    const drift = pos.targetAllocation - pos.currentAllocation;
    const driftEmoji = Math.abs(drift) > 5 ? (drift > 0 ? '🔼' : '🔽') : '➡️';
    const action = Math.abs(drift) <= 1 ? 'Hold' : drift > 0 ? 'Buy' : 'Sell';
    const actionEmoji = action === 'Hold' ? '➡️' : action === 'Buy' ? '🟢' : '🔴';

    return `| **${pos.vaultName}** | ${pos.currentAllocation.toFixed(1)}% | ${pos.targetAllocation.toFixed(1)}% | ${driftEmoji} ${drift > 0 ? '+' : ''}${drift.toFixed(1)}% | ${actionEmoji} ${action} | $${Math.abs(pos.rebalanceAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`;
  })
  .join('\n')}

---

### Rebalancing Actions

${
  optimization.rebalanceNeeded
    ? `
**Positions to Reduce** 🔴
${
  optimization.positions
    .filter((pos) => pos.rebalanceAmount < -100)
    .sort((a, b) => a.rebalanceAmount - b.rebalanceAmount)
    .map(
      (pos) =>
        `- **${pos.vaultName}**: Reduce by $${Math.abs(pos.rebalanceAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${Math.abs(pos.rebalancePercentage).toFixed(1)}%)`
    )
    .join('\n') || '- No significant reductions needed'
}

**Positions to Increase** 🟢
${
  optimization.positions
    .filter((pos) => pos.rebalanceAmount > 100)
    .sort((a, b) => b.rebalanceAmount - a.rebalanceAmount)
    .map(
      (pos) =>
        `- **${pos.vaultName}**: Increase by $${pos.rebalanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pos.rebalancePercentage.toFixed(1)}%)`
    )
    .join('\n') || '- No significant increases needed'
}
`
    : '✅ **No rebalancing needed** - all positions are within the drift threshold'
}

---

### Key Insights

${optimization.recommendations.map((rec) => `- ${rec}`).join('\n')}

---

### Strategy Information

**${strategyNames[optimization.strategy]}** optimizes your portfolio by:
${
  optimization.strategy === 'equal_weight'
    ? '- Allocating equal weights to all vaults for maximum diversification'
    : optimization.strategy === 'risk_parity'
      ? '- Balancing risk contribution across vaults (lower risk = higher allocation)'
      : optimization.strategy === 'max_sharpe'
        ? '- Maximizing risk-adjusted returns (Sharpe ratio optimization)'
        : '- Minimizing portfolio volatility through low-variance allocations'
}

**Risk-Free Rate**: 2.0% (used for Sharpe ratio calculation)

---

**Note**: Recommendations are based on historical performance and risk metrics. Consider transaction costs, tax implications, and market conditions before rebalancing.
`;
}

/**
 * Combined data from all vault queries
 */
interface CombinedVaultData {
  vaults: VaultData[];
  priceHistoryByVault: Map<string, number[]>;
  performanceByVault: Map<string, number[]>;
}

/**
 * Process single vault response and extract historical data
 */
function processSingleVaultData(
  data: SingleVaultOptimizationResponse,
  timestampThreshold: number
): { vault: VaultData; prices: number[]; performance: number[] } | null {
  if (!data.vault) {
    return null;
  }

  // Extract price history with timestamp filtering
  // Calculate price per share from totalAssetsUsd / totalSupply
  const prices: number[] = [];
  if (data.priceHistory && data.priceHistory.items) {
    for (const item of data.priceHistory.items) {
      if (parseInt(item.timestamp) >= timestampThreshold) {
        const totalSupply = parseFloat(item.data.totalSupply);
        if (totalSupply > 0) {
          const pricePerShare = item.data.totalAssetsUsd / totalSupply;
          prices.push(pricePerShare);
        }
      }
    }
  }

  // Use pre-calculated APR from vault state
  // Prefer monthlyApr, fallback to weeklyApr, then yearlyApr
  const performance: number[] = [];
  const apr =
    data.vault.state?.monthlyApr?.linearNetApr ??
    data.vault.state?.weeklyApr?.linearNetApr ??
    data.vault.state?.yearlyApr?.linearNetApr ??
    0;

  // Convert APR to percentage (API returns decimal, e.g., 0.15 = 15%)
  const aprPercentage = apr * 100;

  // If we have price history, create a matching performance array
  if (prices.length > 0) {
    performance.push(aprPercentage);
  }

  return {
    vault: data.vault,
    prices,
    performance,
  };
}

/**
 * Transform combined vault data into portfolio optimization markdown output
 */
function transformOptimizationData(
  input: OptimizePortfolioInput,
  combinedData: CombinedVaultData
): PortfolioOptimizationOutput {
  // Build current positions map from input
  const currentPositions = new Map<string, number>();
  for (const position of input.currentPositions) {
    currentPositions.set(position.vaultAddress.toLowerCase(), position.valueUsd);
  }

  // Prepare vaults for optimization with per-vault historical data
  const vaultsForOptimization: VaultForOptimization[] = combinedData.vaults.map((vault) => {
    const vaultAddress = vault.address.toLowerCase();
    const currentValueUsd = currentPositions.get(vaultAddress) || 0;

    // Get vault-specific price history and calculate volatility
    const priceHistory = combinedData.priceHistoryByVault.get(vaultAddress) || [];
    const volatility = calculateVolatility(priceHistory);

    // Get vault-specific performance data and calculate expected APR
    const aprHistory = combinedData.performanceByVault.get(vaultAddress) || [];
    const expectedApr = calculateAverageAPR(aprHistory);

    // Use simplified risk score (based on volatility)
    const riskScore = Math.min(1, volatility / 0.2); // Normalize to 0-1

    return {
      address: vault.address,
      name: vault.name || 'Unknown Vault',
      chainId: vault.chain.id,
      currentValueUsd,
      expectedApr,
      volatility,
      riskScore,
    };
  });

  // Perform portfolio optimization
  const optimization = optimizePortfolio(
    vaultsForOptimization,
    input.strategy,
    input.rebalanceThreshold
  );

  // Format optimization as markdown
  const markdown = formatPortfolioOptimization(optimization);

  return { markdown };
}

/**
 * Create the executeOptimizePortfolio function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteOptimizePortfolio(
  container: ServiceContainer
): (input: OptimizePortfolioInput) => Promise<CallToolResult> {
  return async (input: OptimizePortfolioInput): Promise<CallToolResult> => {
    try {
      // Calculate timestamp threshold for 90-day lookback
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const lookbackSeconds = 90 * 24 * 60 * 60; // 90 days
      const timestampThreshold = nowTimestamp - lookbackSeconds;

      // Check cache first
      const vaultAddressesKey = input.vaultAddresses.sort().join(',');
      const cacheKey = `portfolio_optimization:${input.chainId}:${vaultAddressesKey}:${input.strategy}`;

      const cachedResult = container.cache.get<string>(cacheKey);
      if (cachedResult) {
        return {
          content: [{ type: 'text', text: cachedResult }],
          isError: false,
        };
      }

      // Execute parallel queries for each vault
      const vaultQueries = input.vaultAddresses.map((vaultAddress) =>
        container.graphqlClient.request<SingleVaultOptimizationResponse>(
          SINGLE_VAULT_OPTIMIZATION_QUERY,
          {
            vaultAddress,
            chainId: input.chainId,
          }
        )
      );

      const results = await Promise.all(vaultQueries);

      // Process each vault's data
      const vaults: VaultData[] = [];
      const priceHistoryByVault = new Map<string, number[]>();
      const performanceByVault = new Map<string, number[]>();

      for (const result of results) {
        const processed = processSingleVaultData(result, timestampThreshold);
        if (processed) {
          vaults.push(processed.vault);
          priceHistoryByVault.set(processed.vault.address.toLowerCase(), processed.prices);
          performanceByVault.set(processed.vault.address.toLowerCase(), processed.performance);
        }
      }

      // Validate we got data for all vaults
      if (vaults.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No vaults found for the provided addresses on chain ${input.chainId}`,
            },
          ],
          isError: true,
        };
      }

      // Transform combined data into optimization output
      const combinedData: CombinedVaultData = {
        vaults,
        priceHistoryByVault,
        performanceByVault,
      };

      const output = transformOptimizationData(input, combinedData);

      // Cache the result
      container.cache.set(cacheKey, output.markdown, cacheTTL.portfolioOptimization);

      // Register cache tags for invalidation
      container.cacheInvalidator.register(cacheKey, [CacheTag.PORTFOLIO, CacheTag.ANALYTICS]);

      return {
        content: [{ type: 'text', text: output.markdown }],
        isError: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during portfolio optimization';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  };
}
