# optimize_portfolio

## Overview

AI-powered portfolio optimization engine based on Modern Portfolio Theory (MPT). Analyzes vault portfolios to maximize risk-adjusted returns through intelligent rebalancing recommendations. Implements multiple optimization strategies including Sharpe ratio maximization, minimum variance, equal risk contribution, and maximum diversification.

## Use Cases

- **Portfolio Rebalancing**: Get systematic rebalancing recommendations
- **Risk-Return Optimization**: Maximize returns for a given risk tolerance
- **Diversification Analysis**: Identify over-concentrated positions
- **Strategic Asset Allocation**: Optimize long-term portfolio structure
- **Performance Enhancement**: Improve risk-adjusted returns through scientific allocation
- **Yield Sustainability Assessment**: Identify vaults with unsustainable yield dependencies

## Parameters

### Required

- `vaults` (array): List of vault addresses to include in optimization
  - Minimum: 2 vaults required for meaningful diversification
  - Maximum: Recommended 20 vaults for computational efficiency
  - Format: Array of `{ address: string, chainId: number }`
  - Example: `[{ address: "0x1234...", chainId: 42161 }, { address: "0x5678...", chainId: 1 }]`

### Optional

- `strategy` (string): Optimization strategy to use
  - Default: `"max_sharpe"`
  - Options:
    - `"max_sharpe"`: Maximize Sharpe ratio (risk-adjusted returns)
    - `"min_variance"`: Minimize portfolio volatility
    - `"equal_risk"`: Equal risk contribution across assets
    - `"max_diversification"`: Maximize diversification ratio
    - `"risk_parity"`: Balance risk across all positions

- `constraints` (object): Portfolio constraints
  - `maxWeight` (number): Maximum weight per vault (0-1), default 0.30
  - `minWeight` (number): Minimum weight per vault (0-1), default 0.05
  - `targetReturn` (number): Target annual return (%), optional
  - `maxVolatility` (number): Maximum acceptable volatility (%), optional

- `riskTolerance` (string): Investor risk profile
  - Options: `"conservative"`, `"moderate"`, `"aggressive"`
  - Default: `"moderate"`
  - Affects recommended portfolios on efficient frontier

- `rebalanceThreshold` (number): Minimum drift % to trigger rebalancing
  - Default: 5
  - Example: 5 means only recommend changes if allocation drifts >5%

## Return Format

Returns comprehensive optimization analysis with actionable recommendations:

```json
{
  "current": {
    "allocations": [
      {
        "vault": {
          "address": "0x1234...",
          "symbol": "lgUSDC",
          "chainId": 42161
        },
        "currentWeight": 0.40,
        "currentValue": 40000
      }
    ],
    "metrics": {
      "expectedReturn": 12.5,
      "volatility": 8.2,
      "sharpeRatio": 1.22,
      "diversificationRatio": 1.85
    }
  },
  "recommended": {
    "allocations": [
      {
        "vault": {
          "address": "0x1234...",
          "symbol": "lgUSDC",
          "chainId": 42161
        },
        "currentWeight": 0.40,
        "targetWeight": 0.25,
        "change": -0.15,
        "action": "REDUCE",
        "value": {
          "current": 40000,
          "target": 25000,
          "change": -15000
        }
      }
    ],
    "metrics": {
      "expectedReturn": 13.8,
      "volatility": 7.5,
      "sharpeRatio": 1.54,
      "diversificationRatio": 2.15,
      "improvement": {
        "returnIncrease": 1.3,
        "volatilityDecrease": -0.7,
        "sharpeIncrease": 0.32
      }
    }
  },
  "analysis": {
    "correlations": [
      {
        "vault1": "lgUSDC",
        "vault2": "lgWETH",
        "correlation": 0.35,
        "diversificationBenefit": "MODERATE"
      }
    ],
    "concentrationRisk": {
      "topHoldingsPercent": 65,
      "herfindahlIndex": 0.28,
      "level": "MODERATE"
    },
    "efficientFrontier": [
      {
        "risk": 5.0,
        "return": 10.2,
        "sharpe": 1.42
      },
      {
        "risk": 7.5,
        "return": 13.8,
        "sharpe": 1.54,
        "recommended": true
      },
      {
        "risk": 10.0,
        "return": 16.5,
        "sharpe": 1.38
      }
    ]
  },
  "recommendations": [
    {
      "priority": "HIGH",
      "action": "Reduce lgUSDC from 40% to 25% (-$15,000)",
      "rationale": "Over-concentrated position reduces diversification benefits"
    },
    {
      "priority": "MEDIUM",
      "action": "Increase lgWETH from 15% to 25% (+$10,000)",
      "rationale": "Low correlation (0.35) provides diversification, improves Sharpe ratio"
    }
  ],
  "summary": {
    "needsRebalancing": true,
    "maxDrift": 15,
    "expectedImprovement": {
      "sharpeRatio": "+26%",
      "volatility": "-8.5%",
      "diversification": "+16%"
    }
  },
  "yieldSustainabilityWarnings": [
    {
      "vault": {
        "address": "0x5678...",
        "symbol": "lgWETH",
        "chainId": 1
      },
      "yieldSustainabilityRisk": 0.75,
      "yieldComposition": {
        "nativeYields": 12.5,
        "incentives": 45.0,
        "airdrops": 12.5,
        "total": 70.0
      },
      "warning": "HIGH",
      "message": "🚨 This vault is heavily dependent on temporary incentives (64% of yield). Native protocol yields represent only 18% of total APR. Consider this yield may not be sustainable long-term.",
      "recommendation": "Monitor closely for incentive program changes. Consider diversifying into vaults with higher native yield ratios."
    },
    {
      "vault": {
        "address": "0x9abc...",
        "symbol": "lgUSDC",
        "chainId": 42161
      },
      "yieldSustainabilityRisk": 0.50,
      "yieldComposition": {
        "nativeYields": 35.0,
        "incentives": 15.0,
        "airdrops": 5.0,
        "total": 55.0
      },
      "warning": "MEDIUM",
      "message": "⚠️ Monitor yield composition for lgUSDC - native yields are 64% of total APR. Watch for changes in incentive programs.",
      "recommendation": "Current yield composition is acceptable but monitor regularly."
    }
  ]
}
```

## Optimization Strategies

### Max Sharpe Ratio
**Best for**: Maximizing risk-adjusted returns

Finds allocation that maximizes the Sharpe ratio (return / volatility). Optimal for investors seeking the best risk-reward trade-off.

**Mathematical Formula**:
```
max(w) = (E[R_p] - R_f) / σ_p
where:
  w = portfolio weights
  E[R_p] = expected portfolio return
  R_f = risk-free rate (assumed 3%)
  σ_p = portfolio volatility
```

### Minimum Variance
**Best for**: Conservative investors prioritizing capital preservation

Minimizes portfolio volatility regardless of returns. Suitable for risk-averse investors or bear market conditions.

**Mathematical Formula**:
```
min(w) = w^T Σ w
where:
  w = portfolio weights
  Σ = covariance matrix
```

### Equal Risk Contribution
**Best for**: Balanced risk exposure across all positions

Ensures each vault contributes equally to total portfolio risk. Prevents over-concentration in high-risk assets.

**Mathematical Formula**:
```
RC_i = w_i * (∂σ_p / ∂w_i)
Target: RC_1 = RC_2 = ... = RC_n
```

### Maximum Diversification
**Best for**: Maximizing diversification benefits

Maximizes the diversification ratio, which measures the ratio of weighted average volatility to portfolio volatility.

**Mathematical Formula**:
```
max(w) = (Σ w_i * σ_i) / σ_p
```

### Risk Parity
**Best for**: Institutional-style balanced portfolios

Similar to Equal Risk Contribution but also considers correlation structure for more sophisticated risk balancing.

## Examples

### Basic Optimization

**Query**: "Optimize my portfolio of 5 vaults for maximum Sharpe ratio"

**Input**:
```json
{
  "vaults": [
    { "address": "0xvault1...", "chainId": 42161 },
    { "address": "0xvault2...", "chainId": 42161 },
    { "address": "0xvault3...", "chainId": 1 },
    { "address": "0xvault4...", "chainId": 1 },
    { "address": "0xvault5...", "chainId": 10 }
  ]
}
```

**Response**: Provides current vs. recommended allocations with Sharpe ratio improvement from 1.22 → 1.54

### Conservative Portfolio

**Query**: "Optimize for minimum risk, I'm risk-averse"

**Input**:
```json
{
  "vaults": [...],
  "strategy": "min_variance",
  "riskTolerance": "conservative",
  "constraints": {
    "maxWeight": 0.25,
    "maxVolatility": 6.0
  }
}
```

**Response**: Low-volatility allocation emphasizing stable vaults, volatility reduced from 8.2% → 5.8%

### Aggressive Growth

**Query**: "Maximize returns, I can tolerate high risk"

**Input**:
```json
{
  "vaults": [...],
  "strategy": "max_sharpe",
  "riskTolerance": "aggressive",
  "constraints": {
    "targetReturn": 20.0,
    "minWeight": 0.10
  }
}
```

**Response**: Growth-focused allocation with expected return 18.5%, Sharpe 1.48, volatility 12.5%

### Diversification Focus

**Query**: "I want maximum diversification across vaults"

**Input**:
```json
{
  "vaults": [...],
  "strategy": "max_diversification"
}
```

**Response**: Balanced allocation emphasizing low-correlation vaults, diversification ratio improved from 1.85 → 2.35

## Yield Sustainability Warnings

Portfolio optimization now includes **yield sustainability risk assessment** to identify vaults heavily dependent on temporary incentives or airdrops that may not persist long-term.

### Warning Levels

**🚨 High Risk** (Sustainability Risk ≥ 0.7):
- Native protocol yields < 20% of total APR
- Heavy reliance on temporary incentives/airdrops (>80%)
- **Action Required**: Consider reducing allocation or diversifying
- **Example**: Vault with 5% native yield + 20% incentives = 20% total (only 25% sustainable)

**⚠️ Medium Risk** (Sustainability Risk ≥ 0.4):
- Native protocol yields 20-50% of total APR
- Moderate dependence on temporary programs (50-80%)
- **Action**: Monitor closely for incentive program changes
- **Example**: Vault with 6% native yield + 6% incentives = 12% total (50% sustainable)

**✅ Low Risk / No Concerns** (Sustainability Risk < 0.4):
- Native protocol yields > 50% of total APR
- Strong fundamental yield generation
- **Status**: Healthy yield composition, no immediate concerns
- **Example**: Vault with 8% native yield + 2% incentives = 10% total (80% sustainable)

### Yield Composition Breakdown

**Native Yields** (Sustainable):
- Protocol fees, lending interest, staking rewards
- Derived from fundamental protocol operations
- Expected to persist long-term

**Incentives** (Temporary):
- Liquidity mining rewards, yield farming bonuses
- Protocol-specific incentive programs
- May be reduced or discontinued

**Airdrops** (One-time):
- Token distributions, governance rewards
- Typically non-recurring events
- Should not be relied upon for steady income

### Risk-Adjusted Recommendations

When yield sustainability warnings are present, optimization considers:

1. **Reduced Allocation**: High-risk vaults may receive lower recommended weights
2. **Diversification Priority**: Suggests balancing risky vaults with stable ones
3. **Monitoring Guidance**: Provides specific metrics to track for each warned vault
4. **Alternative Suggestions**: May recommend vaults with better sustainability profiles

### Example Output Section

```
## ⚠️ Yield Sustainability Warnings

### 🚨 High Risk - Monitor Closely

**lgWETH (Ethereum)**: 75% yield sustainability risk
- **Current Yield**: 18% APR (12% native, 45% incentives, 12% airdrops)
- **Concern**: Only 18% of yield comes from native protocol activity
- **Recommendation**: Monitor incentive program duration. Consider reducing allocation if programs expire.

### ⚠️ Medium Risk - Watch For Changes

**lgUSDC (Arbitrum)**: 50% yield sustainability risk
- **Current Yield**: 12% APR (6% native, 5% incentives, 1% airdrops)
- **Concern**: 50% of yield from temporary programs
- **Recommendation**: Acceptable for now, but review quarterly for program changes.

### ✅ No Sustainability Concerns

The following vaults have healthy yield compositions with >50% native yields:
- lgDAI (Ethereum): 85% native yields
- lgUSDT (Arbitrum): 72% native yields
```

## Interpretation Guide

### Sharpe Ratio
- **< 1.0**: Poor risk-adjusted returns
- **1.0 - 2.0**: Good risk-adjusted returns
- **> 2.0**: Excellent risk-adjusted returns

### Diversification Ratio
- **< 1.5**: Low diversification, high concentration risk
- **1.5 - 2.5**: Moderate diversification
- **> 2.5**: High diversification, good risk spreading

### Correlation
- **< 0.3**: Low correlation, strong diversification benefit
- **0.3 - 0.7**: Moderate correlation
- **> 0.7**: High correlation, limited diversification benefit

### Concentration (Herfindahl Index)
- **< 0.15**: Low concentration, well-diversified
- **0.15 - 0.30**: Moderate concentration
- **> 0.30**: High concentration, consider rebalancing

## Performance Characteristics

- **Computation Time**: 2-5 seconds for 5-10 vaults, 5-10 seconds for 10-20 vaults
- **Cache TTL**: 15 minutes (optimization results cached)
- **Token Usage**: ~1,500-3,000 tokens per optimization
- **Historical Data**: Uses 90-day rolling window for return/volatility estimates
- **Reoptimization**: Recommended monthly or when portfolio drifts >10%

## Limitations

### Data Requirements
- Requires minimum 30 days of historical data per vault
- Assumes historical patterns persist (not predictive guarantees)
- Correlations estimated from historical data may change

### Optimization Constraints
- **Minimum Vaults**: 2 vaults required (3+ recommended)
- **Maximum Vaults**: 20 vaults (computational limit)
- **Minimum Allocation**: 5% per vault by default
- **Maximum Allocation**: 30% per vault by default

### Market Assumptions
- Assumes normally distributed returns (may not hold during black swan events)
- Uses historical volatility (forward-looking volatility may differ)
- Risk-free rate assumed at 3% (adjust for current market conditions)

## Advanced Usage

### Custom Constraints

**Query**: "Optimize but keep at least 20% in stablecoins"

**Implementation**:
1. Identify stablecoin vaults (USDC, USDT, DAI)
2. Apply constraint: `sum(stablecoin_weights) >= 0.20`
3. Optimize remaining allocation

### Rebalancing Thresholds

**Query**: "Only recommend rebalancing if allocations drift more than 10%"

**Input**:
```json
{
  "vaults": [...],
  "rebalanceThreshold": 10
}
```

**Response**: If max drift < 10%, returns "No rebalancing needed" with current metrics

### Multi-Chain Optimization

**Query**: "Optimize across Ethereum, Arbitrum, and Optimism"

**Input**:
```json
{
  "vaults": [
    { "address": "0x...", "chainId": 1 },
    { "address": "0x...", "chainId": 42161 },
    { "address": "0x...", "chainId": 10 }
  ]
}
```

**Response**: Considers gas costs and bridge risks in recommendations

## Related Tools

- [**user_portfolio**](./user-portfolio.md): Get current portfolio allocations to optimize
- [**compare_vaults**](./compare-vaults.md): Compare individual vaults before adding to portfolio
- [**analyze_risk**](./analyze-risk.md): Assess risk of individual vaults
- [**predict_yield**](./predict-yield.md): Forecast expected returns for optimization inputs

## Best Practices

1. **Regular Reoptimization**: Reoptimize monthly or when markets change significantly
2. **Rebalance Gradually**: Implement large changes over multiple transactions to minimize price impact
3. **Consider Costs**: Factor in gas fees and potential slippage when rebalancing
4. **Risk Tolerance**: Choose strategy aligned with your investment goals and risk tolerance
5. **Diversification**: Include 5-10 vaults minimum for meaningful diversification benefits
6. **Review Correlations**: Ensure selected vaults have low correlations for better diversification
7. **Monitor Drift**: Set up alerts when allocations drift >10% from targets
8. **Assess Yield Sustainability**: Pay attention to warnings about incentive-dependent yields
9. **Track Incentive Programs**: Monitor expiration dates and renewal status of yield programs
10. **Balance Risk Factors**: Consider both traditional portfolio metrics and yield composition risk

## Technical Details

### Algorithm
- **Optimization Method**: Sequential Least Squares Programming (SLSQP)
- **Covariance Estimation**: Exponentially-weighted moving average (EWMA) with decay factor 0.94
- **Expected Returns**: Historical mean returns with forward-bias adjustment
- **Constraints**: Linear inequality constraints via scipy.optimize
- **Convergence**: Tolerance 1e-6, maximum 1000 iterations

### Data Sources
- Historical prices from vault state updates
- Correlation matrix from 90-day rolling window
- Return estimates from 30/60/90-day performance
- Risk-free rate: 3% annual (US Treasury 3-month yield proxy)

---

**Last Updated**: 2025-01-07
**Version**: 0.1.0
**Status**: Production-ready
