# Risk Analysis Frameworks

## Risk Scoring Methodology

### Factor Weights
| Factor | Weight | Rationale |
|--------|--------|-----------|
| TVL Risk | 25% | Liquidity and market validation |
| Concentration Risk | 20% | Diversification and exposure |
| Volatility Risk | 20% | Price stability and predictability |
| Age Risk | 15% | Operational maturity |
| Curator Risk | 20% | Management quality |

### Risk Score Interpretation
| Score Range | Risk Level | Description |
|-------------|------------|-------------|
| 0-20 | Very Low | Excellent risk profile, suitable for conservative investors |
| 21-40 | Low | Good risk management, moderate exposure acceptable |
| 41-60 | Medium | Balanced risk-reward, requires active monitoring |
| 61-80 | High | Elevated risk, suitable only for risk-tolerant investors |
| 81-100 | Very High | Significant risk, speculative allocation only |

## Volatility Analysis Framework

### Volatility Metrics
- **Daily Volatility**: Standard deviation of daily returns
- **Weekly Volatility**: Rolling 7-day volatility
- **Implied Volatility**: Market-expected future volatility
- **Historical Volatility**: Past price movement analysis

### Volatility Interpretation
| Volatility | Assessment | Implication |
|------------|------------|-------------|
| <5% | Very Low | Stable, predictable returns |
| 5-15% | Low | Normal market conditions |
| 15-30% | Medium | Typical DeFi volatility |
| 30-50% | High | Significant price swings expected |
| >50% | Very High | Extreme volatility, high risk |

## Drawdown Analysis

### Maximum Drawdown Categories
| Drawdown | Severity | Recovery Expectation |
|----------|----------|----------------------|
| <5% | Minor | Days to weeks |
| 5-15% | Moderate | Weeks to months |
| 15-30% | Significant | Months |
| 30-50% | Severe | Months to quarters |
| >50% | Critical | Extended recovery or permanent loss |

### Recovery Analysis
- **Recovery Factor**: Return / Max Drawdown
- **Recovery Time**: Days to recover previous high
- **Ulcer Index**: Measure of downside risk duration

## Correlation Analysis

### Asset Correlation Matrix
Analyze how vault returns correlate with:
- BTC/ETH market movements
- DeFi sector performance
- Protocol-specific factors
- Macroeconomic indicators

### Diversification Benefits
| Correlation | Diversification |
|-------------|-----------------|
| <0.3 | Strong diversification benefit |
| 0.3-0.6 | Moderate diversification |
| 0.6-0.8 | Limited diversification |
| >0.8 | High correlation, similar exposure |

## Stress Testing Scenarios

### Standard Stress Tests
1. **Market Crash**: 50% decline in underlying assets
2. **Liquidity Crisis**: Unable to exit position at fair value
3. **Protocol Failure**: Smart contract exploit or failure
4. **Correlation Breakdown**: Historical correlations don't hold
5. **Black Swan Event**: Unprecedented market conditions

### Scenario Impact Assessment
For each scenario, evaluate:
- Potential loss magnitude
- Probability of occurrence
- Recovery time estimate
- Mitigation strategies available

## Risk-Adjusted Return Metrics

### Sharpe Ratio Interpretation
| Sharpe | Quality |
|--------|---------|
| <0 | Negative risk-adjusted return |
| 0-0.5 | Poor |
| 0.5-1.0 | Adequate |
| 1.0-2.0 | Good |
| >2.0 | Excellent |

### Sortino Ratio
- Focuses on downside deviation
- More relevant for asymmetric return distributions
- Higher is better (only penalizes downside volatility)

### Calmar Ratio
- Return / Max Drawdown
- Measures return per unit of drawdown risk
- Higher indicates better drawdown-adjusted returns

## Position Sizing Framework

### Risk-Based Sizing
| Risk Level | Max Allocation |
|------------|----------------|
| Very Low | Up to 25% of portfolio |
| Low | Up to 15% of portfolio |
| Medium | Up to 10% of portfolio |
| High | Up to 5% of portfolio |
| Very High | Up to 2% of portfolio |

### Concentration Guidelines
- No single vault >25% of total DeFi allocation
- No single chain >50% of total allocation
- No single strategy type >40% of allocation
