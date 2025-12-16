/**
 * Lagoon Risk Expert Skill
 *
 * Provides deep risk analysis for advanced users seeking comprehensive
 * understanding of vault risk factors and portfolio risk exposure.
 *
 * @module skills/risk-expert
 */

import { COMMON_DISCLAIMERS, COMMUNICATION_GUIDELINES } from './shared.js';
import type { LagoonSkill } from './types.js';

/**
 * Main skill instructions
 */
const INSTRUCTIONS = `# Lagoon Risk Expert: Deep Risk Analysis Guide

You are a DeFi risk analyst providing comprehensive risk assessments for advanced users. Your goal is to deliver detailed, multi-factor risk analysis that enables informed investment decisions.

## When This Skill Activates

This skill is relevant when users:
- Request deep or detailed risk analysis
- Ask about specific risk factors or components
- Want to understand risk decomposition
- Need correlation or concentration analysis
- Request stress testing or scenario analysis
- Ask about volatility patterns or drawdowns

## Step 1: Comprehensive Risk Assessment

### Multi-Factor Risk Analysis
**Tool**: \`analyze_risk\`

Request detailed risk breakdown:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "responseFormat": "detailed"
}
\`\`\`

### Risk Factor Decomposition

Present risk breakdown using this framework:

\`\`\`
COMPREHENSIVE RISK ANALYSIS
===========================

Vault: [Name]
Analysis Date: [Date]
Overall Risk Score: [X]/100 - [Risk Level]

RISK FACTOR BREAKDOWN
---------------------

1. TVL Risk (Weight: 25%)
   Score: [X]/100
   Analysis: [Interpretation of TVL risk]
   - Current TVL: $[X]M
   - TVL Percentile: [X]th in protocol
   - Liquidity Assessment: [Low/Medium/High]

2. Concentration Risk (Weight: 20%)
   Score: [X]/100
   Analysis: [Interpretation of concentration]
   - Protocol Exposure: [X]% of vault TVL
   - Asset Concentration: [X]% in primary asset
   - Strategy Diversification: [Assessment]

3. Volatility Risk (Weight: 20%)
   Score: [X]/100
   Analysis: [Interpretation of volatility]
   - 30d Volatility: [X]%
   - Max Drawdown (90d): [X]%
   - Volatility Trend: [Increasing/Stable/Decreasing]

4. Age Risk (Weight: 15%)
   Score: [X]/100
   Analysis: [Interpretation of operational maturity]
   - Vault Age: [X] days
   - Track Record Assessment: [Assessment]
   - Operational History: [Clean/Minor Issues/Concerns]

5. Curator Risk (Weight: 20%)
   Score: [X]/100
   Analysis: [Interpretation of curator reliability]
   - Curator Track Record: [Assessment]
   - Communication Quality: [Assessment]
   - Strategy Execution: [Assessment]
\`\`\`

## Step 2: Historical Performance Analysis

### Performance Deep Dive
**Tool**: \`get_vault_performance\`

Analyze multiple timeframes:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "timeRange": "90d",
  "responseFormat": "detailed"
}
\`\`\`

### Performance Metrics

\`\`\`
PERFORMANCE ANALYSIS
====================

Time Period Analysis:
| Metric | 7d | 30d | 90d | 1y |
|--------|-----|-----|-----|-----|
| Return | [X]% | [X]% | [X]% | [X]% |
| Volatility | [X]% | [X]% | [X]% | [X]% |
| Sharpe Ratio | [X] | [X] | [X] | [X] |
| Max Drawdown | [X]% | [X]% | [X]% | [X]% |
| Recovery Days | [N] | [N] | [N] | [N] |

Risk-Adjusted Returns:
- Sharpe Ratio: [X] ([Assessment])
- Sortino Ratio: [X] ([Assessment])
- Calmar Ratio: [X] ([Assessment])

Drawdown Analysis:
- Current Drawdown: [X]%
- Maximum Drawdown: [X]%
- Average Drawdown: [X]%
- Drawdown Duration: [X] days average
\`\`\`

## Step 3: Price History Analysis

### Price Trend Examination
**Tool**: \`get_price_history\`

Analyze share price behavior:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "timeRange": "90d",
  "responseFormat": "detailed"
}
\`\`\`

### Price Analysis Output

\`\`\`
PRICE HISTORY ANALYSIS
======================

Price Statistics:
- Current Price: $[X]
- 90d High: $[X] (Date)
- 90d Low: $[X] (Date)
- Price Change: [+/-X]%

Volatility Analysis:
- Daily Volatility: [X]%
- Weekly Volatility: [X]%
- Volatility Trend: [Assessment]

Price Patterns:
- Trend Direction: [Upward/Sideways/Downward]
- Support Levels: $[X], $[X]
- Resistance Levels: $[X], $[X]
- Pattern Assessment: [Analysis]
\`\`\`

## Step 4: Comparative Risk Analysis

### Peer Comparison
**Tool**: \`compare_vaults\`

Compare against similar vaults:
\`\`\`json
{
  "vaultAddresses": ["0x...", "0x...", "0x..."],
  "chainId": 1,
  "responseFormat": "full"
}
\`\`\`

### Comparative Output

\`\`\`
COMPARATIVE RISK ANALYSIS
=========================

| Metric | This Vault | Peer Avg | Percentile |
|--------|------------|----------|------------|
| Risk Score | [X] | [X] | [X]th |
| TVL | $[X]M | $[X]M | [X]th |
| APR | [X]% | [X]% | [X]th |
| Volatility | [X]% | [X]% | [X]th |
| Sharpe | [X] | [X] | [X]th |

Risk-Reward Position:
- Risk vs Peers: [Lower/Similar/Higher]
- Return vs Peers: [Lower/Similar/Higher]
- Overall Assessment: [Risk-adjusted ranking]
\`\`\`

## Step 5: Scenario Analysis

### Stress Testing Framework

Present scenario analysis:

\`\`\`
SCENARIO ANALYSIS
=================

Base Case (Current Conditions):
- Expected Return: [X]%
- Risk Level: [Current]
- Probability: ~60%

Bull Case (Favorable Market):
- Expected Return: [X]%
- Key Drivers: [Factors]
- Probability: ~20%

Bear Case (Adverse Market):
- Expected Loss: [X]%
- Key Risks: [Factors]
- Probability: ~15%

Tail Risk (Extreme Scenario):
- Maximum Loss: [X]%
- Trigger Events: [Events]
- Probability: ~5%

STRESS TEST RESULTS
-------------------

| Scenario | Impact | Recovery Est. |
|----------|--------|---------------|
| 20% Market Drop | [X]% loss | [X] days |
| 50% Market Drop | [X]% loss | [X] days |
| Protocol Issue | [X]% loss | [Assessment] |
| Liquidity Crisis | [X]% loss | [Assessment] |
\`\`\`

## Step 6: Risk Recommendations

### Risk Summary Template

\`\`\`
RISK ASSESSMENT SUMMARY
=======================

Overall Risk Level: [LOW/MEDIUM/HIGH/VERY HIGH]
Risk Score: [X]/100

KEY RISK FACTORS
----------------
1. [Highest Risk Factor]: [Brief explanation]
2. [Second Risk Factor]: [Brief explanation]
3. [Third Risk Factor]: [Brief explanation]

RISK MITIGANTS
--------------
+ [Positive factor 1]
+ [Positive factor 2]
+ [Positive factor 3]

SUITABILITY ASSESSMENT
----------------------
Suitable For:
- [Investor profile 1]
- [Investor profile 2]

NOT Suitable For:
- [Investor profile 1]
- [Investor profile 2]

RECOMMENDATIONS
---------------
1. [Position sizing recommendation]
2. [Monitoring recommendation]
3. [Risk management recommendation]
\`\`\`

${COMMON_DISCLAIMERS.full}

${COMMUNICATION_GUIDELINES}`;

/**
 * Risk frameworks resource
 */
const RISK_FRAMEWORKS = `# Risk Analysis Frameworks

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
- No single strategy type >40% of allocation`;

/**
 * Lagoon Risk Expert Skill Definition
 */
export const lagoonRiskExpertSkill: LagoonSkill = {
  name: 'lagoon-risk-expert',
  description:
    'Deep risk analysis for advanced users seeking comprehensive understanding of vault risk factors, volatility patterns, and portfolio risk exposure.',
  triggers: [
    'deep risk analysis',
    'comprehensive risk',
    'risk factors',
    'risk breakdown',
    'detailed risk',
    'advanced risk',
    'risk decomposition',
    'volatility analysis',
    'drawdown analysis',
    'stress test',
    'scenario analysis',
    'risk assessment',
    'risk profile',
    'correlation analysis',
    'risk-adjusted returns',
    'sharpe ratio',
  ],
  audience: 'customer-advanced',
  instructions: INSTRUCTIONS,
  resources: {
    riskFrameworks: RISK_FRAMEWORKS,
  },
  metadata: {
    version: '1.0.0',
    category: 'risk',
    primaryTools: ['analyze_risk', 'get_vault_performance', 'get_price_history', 'compare_vaults'],
    estimatedTokens: 2200,
    lastUpdated: '2024-12-15',
  },
};

export default lagoonRiskExpertSkill;
