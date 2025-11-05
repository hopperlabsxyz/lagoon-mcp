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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { OptimizePortfolioInput, optimizePortfolioInputSchema } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments.js';
import {
  optimizePortfolio,
  VaultForOptimization,
  PortfolioOptimization,
} from '../utils/portfolio-optimization.js';
import { cache, cacheTTL } from '../cache/index.js';

/**
 * GraphQL query for portfolio optimization data
 */
const PORTFOLIO_OPTIMIZATION_QUERY = `
  query PortfolioOptimization($vaultAddresses: [Address!]!, $chainId: Int!, $timestamp_gte: BigInt!) {
    vaults(where: { address_in: $vaultAddresses, chainId: $chainId }) {
      items {
        ...VaultFragment
      }
    }

    # Get price history for volatility calculation
    priceHistory: transactions(
      where: {
        vault_in: $vaultAddresses,
        timestamp_gte: $timestamp_gte,
        type: "TotalAssetsUpdated"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        vault
        timestamp
        data {
          ... on TotalAssetsUpdated {
            pricePerShareUsd
          }
        }
      }
    }

    # Get APY data for return estimation
    performanceData: transactions(
      where: {
        vault_in: $vaultAddresses,
        timestamp_gte: $timestamp_gte,
        type: "PeriodSummary"
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: 1000
    ) {
      items {
        vault
        timestamp
        data {
          ... on PeriodSummary {
            apy
          }
        }
      }
    }
  }
  ${VAULT_FRAGMENT}
`;

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
 * Optimize portfolio with rebalancing recommendations
 *
 * @param input - Portfolio configuration (vault addresses, positions, strategy)
 * @returns Portfolio optimization with target allocations and rebalancing guidance
 */
export async function executeOptimizePortfolio(
  input: OptimizePortfolioInput
): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = optimizePortfolioInputSchema.parse(input);

    // Check cache
    const vaultAddressesKey = validatedInput.vaultAddresses.sort().join(',');
    const cacheKey = `portfolio_optimization:${validatedInput.chainId}:${vaultAddressesKey}:${validatedInput.strategy}`;
    const cached = cache.get<{
      optimization: PortfolioOptimization;
      currentPositions: Map<string, number>;
    }>(cacheKey);

    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: `${formatPortfolioOptimization(cached.optimization)}\n\n_Cached result from ${new Date().toISOString()}_`,
          },
        ],
        isError: false,
      };
    }

    // Calculate timestamp threshold for 90-day lookback
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const lookbackSeconds = 90 * 24 * 60 * 60; // 90 days
    const timestampThreshold = nowTimestamp - lookbackSeconds;

    // Fetch vault data
    const data = await graphqlClient.request<{
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
    }>(PORTFOLIO_OPTIMIZATION_QUERY, {
      vaultAddresses: validatedInput.vaultAddresses,
      chainId: validatedInput.chainId,
      timestamp_gte: String(timestampThreshold),
    });

    if (!data.vaults || data.vaults.items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No vaults found for the provided addresses on chain ${validatedInput.chainId}`,
          },
        ],
        isError: false,
      };
    }

    // Build current positions map from input
    const currentPositions = new Map<string, number>();
    for (const position of validatedInput.currentPositions) {
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
      // In production, this would use the full risk scoring from analyze_risk
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
      validatedInput.strategy,
      validatedInput.rebalanceThreshold
    );

    // Cache the result
    const cacheValue = {
      optimization,
      currentPositions,
    };
    cache.set(cacheKey, cacheValue, cacheTTL.portfolioOptimization);

    // Return formatted optimization
    return {
      content: [
        {
          type: 'text',
          text: formatPortfolioOptimization(optimization),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return handleToolError(error, 'optimize_portfolio');
  }
}
