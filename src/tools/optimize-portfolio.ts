/**
 * optimize_portfolio Tool
 *
 * Portfolio optimization with rebalancing recommendations.
 * Analyzes current holdings and provides optimal allocation strategy.
 *
 * Use cases:
 * - Portfolio rebalancing and optimization
 * - Risk-adjusted allocation strategies
 * - Diversification improvement
 * - Performance enhancement through optimal weighting
 * - Performance: ~600-800 tokens per optimization
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
import { PORTFOLIO_OPTIMIZATION_QUERY } from '../graphql/queries/index.js';
import {
  optimizePortfolio,
  VaultForOptimization,
  PortfolioOptimization,
} from '../utils/portfolio-optimization.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';

/**
 * GraphQL response type
 */
interface PortfolioOptimizationResponse {
  vaults: {
    items: VaultData[];
  };
  priceHistory: {
    items: Array<{
      vault: string;
      timestamp: string;
      data: { pricePerShareUsd: number };
    }>;
  };
  performanceData: {
    items: Array<{
      vault: string;
      timestamp: string;
      data: { apy: number };
    }>;
  };
}

/**
 * GraphQL variables type for PORTFOLIO_OPTIMIZATION_QUERY
 */
interface PortfolioOptimizationVariables {
  vaultAddresses: string[];
  chainId: number;
  timestamp_gte: string;
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
 * Calculate average APY from performance data
 */
function calculateAverageAPY(apyValues: number[]): number {
  if (apyValues.length === 0) {
    return 0;
  }

  return apyValues.reduce((sum, apy) => sum + apy, 0) / apyValues.length;
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
 * Transform raw GraphQL response into portfolio optimization markdown output
 * Uses closure to capture input values and current positions
 */
function createTransformOptimizationData(input: OptimizePortfolioInput) {
  return (data: PortfolioOptimizationResponse): PortfolioOptimizationOutput => {
    // Build current positions map from input
    const currentPositions = new Map<string, number>();
    for (const position of input.currentPositions) {
      currentPositions.set(position.vaultAddress.toLowerCase(), position.valueUsd);
    }

    // Group price history by vault
    const priceHistoryByVault = new Map<string, number[]>();
    if (data.priceHistory && data.priceHistory.items) {
      for (const item of data.priceHistory.items) {
        const vaultAddress = item.vault.toLowerCase();
        if (!priceHistoryByVault.has(vaultAddress)) {
          priceHistoryByVault.set(vaultAddress, []);
        }
        priceHistoryByVault.get(vaultAddress)!.push(item.data.pricePerShareUsd);
      }
    }

    // Group performance data by vault
    const performanceByVault = new Map<string, number[]>();
    if (data.performanceData && data.performanceData.items) {
      for (const item of data.performanceData.items) {
        const vaultAddress = item.vault.toLowerCase();
        if (!performanceByVault.has(vaultAddress)) {
          performanceByVault.set(vaultAddress, []);
        }
        performanceByVault.get(vaultAddress)!.push(item.data.apy);
      }
    }

    // Prepare vaults for optimization
    const vaultsForOptimization: VaultForOptimization[] = data.vaults.items.map((vault) => {
      const vaultAddress = vault.address.toLowerCase();
      const currentValueUsd = currentPositions.get(vaultAddress) || 0;

      // Calculate volatility from price history
      const priceHistory = priceHistoryByVault.get(vaultAddress) || [];
      const volatility = calculateVolatility(priceHistory);

      // Calculate expected APY from performance data
      const apyHistory = performanceByVault.get(vaultAddress) || [];
      const expectedApy = calculateAverageAPY(apyHistory);

      // Use simplified risk score (based on volatility)
      const riskScore = Math.min(1, volatility / 0.2); // Normalize to 0-1

      return {
        address: vault.address,
        name: vault.name || 'Unknown Vault',
        chainId: vault.chain.id,
        currentValueUsd,
        expectedApy,
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
  };
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
    // Calculate timestamp threshold for 90-day lookback
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const lookbackSeconds = 90 * 24 * 60 * 60; // 90 days
    const timestampThreshold = nowTimestamp - lookbackSeconds;

    const executor = executeToolWithCache<
      OptimizePortfolioInput,
      PortfolioOptimizationResponse,
      PortfolioOptimizationVariables,
      PortfolioOptimizationOutput
    >({
      container,
      cacheKey: (input) => {
        const vaultAddressesKey = input.vaultAddresses.sort().join(',');
        return `portfolio_optimization:${input.chainId}:${vaultAddressesKey}:${input.strategy}`;
      },
      cacheTTL: cacheTTL.portfolioOptimization,
      query: PORTFOLIO_OPTIMIZATION_QUERY,
      variables: () => ({
        vaultAddresses: input.vaultAddresses,
        chainId: input.chainId,
        timestamp_gte: String(timestampThreshold),
      }),
      validateResult: (data) => ({
        valid: !!(data.vaults && data.vaults.items.length > 0),
        message:
          data.vaults && data.vaults.items.length > 0
            ? undefined
            : `No vaults found for the provided addresses on chain ${input.chainId}`,
      }),
      transformResult: createTransformOptimizationData(input),
      toolName: 'optimize_portfolio',
    });

    // Register cache tags for invalidation
    const vaultAddressesKey = input.vaultAddresses.sort().join(',');
    const cacheKey = `portfolio_optimization:${input.chainId}:${vaultAddressesKey}:${input.strategy}`;
    container.cacheInvalidator.register(cacheKey, [CacheTag.PORTFOLIO, CacheTag.ANALYTICS]);

    // Execute and get result
    const result = await executor(input);

    // Transform JSON output to markdown text format
    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const output = JSON.parse(result.content[0].text) as PortfolioOptimizationOutput;
        result.content[0].text = output.markdown;
      } catch (error) {
        console.error('Failed to parse optimization output:', error);
      }
    }

    return result;
  };
}
