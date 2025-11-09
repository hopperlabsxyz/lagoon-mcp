# analyze_risk

## Overview

Multi-factor risk analysis with comprehensive scoring across 7 key risk dimensions: TVL risk, concentration risk, volatility risk, age risk, curator risk, fee risk, and liquidity risk. Provides weighted composite risk score with actionable insights and risk level classification.

## Use Cases

- **Due Diligence**: Assess vault risk before investing
- **Portfolio Monitoring**: Track risk exposure over time
- **Comparative Analysis**: Compare risk profiles across vaults
- **Risk-Adjusted Returns**: Evaluate returns relative to risk
- **Investment Decision Support**: Make informed risk vs. reward decisions

## Parameters

### Required

- `vaultAddress` (string): Ethereum address of the vault
  - Format: `0x` followed by 40 hexadecimal characters
  - Example: `0x1234567890123456789012345678901234567890`

- `chainId` (number): Blockchain chain ID
  - Must be a positive integer
  - Common values: 1 (Ethereum), 42161 (Arbitrum), 10 (Optimism)

### Optional

None - analyzes all risk factors automatically.

## Return Format

Returns comprehensive risk assessment:

```json
{
  "vault": {
    "address": "0x1234...",
    "chainId": 42161,
    "symbol": "lgUSDC"
  },
  "riskScore": {
    "overall": 35.5,
    "level": "MEDIUM",
    "factors": {
      "tvl": {
        "score": 15,
        "weight": 0.30,
        "weighted": 4.5,
        "level": "LOW",
        "details": {
          "currentTvl": 5000000,
          "threshold": 1000000,
          "insight": "High TVL indicates established vault with user trust"
        }
      },
      "concentration": {
        "score": 40,
        "weight": 0.25,
        "weighted": 10.0,
        "level": "MEDIUM",
        "details": {
          "topHoldersPercent": 45,
          "holderCount": 234,
          "insight": "Moderate concentration - diversified but some large holders"
        }
      },
      "volatility": {
        "score": 25,
        "weight": 0.20,
        "weighted": 5.0,
        "level": "LOW",
        "details": {
          "volatility": 2.5,
          "period": "30d",
          "insight": "Low volatility indicates stable performance"
        }
      },
      "age": {
        "score": 60,
        "weight": 0.15,
        "weighted": 9.0,
        "level": "MEDIUM",
        "details": {
          "ageInDays": 45,
          "insight": "Relatively new vault - limited historical data"
        }
      },
      "curator": {
        "score": 35,
        "weight": 0.10,
        "weighted": 3.5,
        "level": "MEDIUM",
        "details": {
          "curatorReputation": 7.5,
          "vaultCount": 12,
          "insight": "Established curator with good track record"
        }
      }
    }
  },
  "recommendations": [
    "Consider vault's short history when making investment decisions",
    "Monitor holder concentration for potential liquidity risks",
    "Low volatility makes this suitable for risk-averse investors"
  ],
  "summary": "MEDIUM risk vault with established TVL and stable performance. Newer vault with moderate concentration requires monitoring."
}
```

## Examples

### Basic Risk Assessment

```
"Analyze the risk profile for vault 0x1234... on Arbitrum"
```

Returns comprehensive 7-factor risk analysis with overall score and recommendations.

### Risk Level Query

```
"What's the overall risk level of lgUSDC vault?"
```

Provides risk level (LOW/MEDIUM/HIGH/CRITICAL) with explanation.

### Factor Breakdown

```
"Show me the detailed risk breakdown for vault 0x1234..."
```

Returns all 7 risk factors with individual scores, weights, and insights.

### Comparative Risk

```
"Compare risk profiles of vaults 0x1234... and 0x5678..."
```

Analyze risk for both vaults (two queries) and compare results.

## Performance Characteristics

- **Cache TTL**: 15 minutes
  - Cache key: `risk:{address}:{chainId}`
  - Risk factors change moderately
  - Balances freshness with computational cost
- **Token Cost**: ~400-600 tokens per analysis
  - Includes all 7 factors
  - Detailed insights and recommendations
- **Response Time**:
  - Cached: <100ms
  - Fresh: 1000-2000ms (multi-factor calculation)
- **Best For**: Due diligence, risk assessment, investment decisions

## ⚠️ Legal Disclaimer

**NOT FINANCIAL ADVICE** - This tool provides data analysis for informational purposes only.

- Do NOT rely solely on this tool for investment decisions
- Consult qualified financial professionals before investing
- Cryptocurrency investments carry substantial risk including complete loss of capital
- We accept no liability for losses from using this information
- Past performance ≠ future results

See [main disclaimer](../../README.md#️-important-legal-disclaimer) for full details.

## Implementation Notes

### Risk Scoring Methodology

**Score Range**: 0-100 (lower = lower risk)
- **0-25**: LOW risk
- **26-50**: MEDIUM risk
- **51-75**: HIGH risk
- **76-100**: CRITICAL risk

### Seven Risk Factors

#### 1. TVL Risk (Weight: 14.3%)
Assesses vault size and liquidity:
- **Score 0.1**: TVL ≥ $10M - Very low risk (highly liquid, established)
- **Score 0.2**: TVL ≥ $1M - Low risk (adequate liquidity)
- **Score 0.5**: TVL ≥ $100K - Medium risk (limited liquidity)
- **Score 0.8**: TVL ≥ $10K - High risk (very low liquidity)
- **Score 1.0**: TVL < $10K - Critical risk (extremely low liquidity)

#### 2. Concentration Risk (Weight: 14.3%)
Evaluates vault's share of total protocol TVL:
- **Score 0.1**: < 10% of protocol TVL - Low concentration
- **Score 0.4**: < 25% of protocol TVL - Medium concentration
- **Score 0.7**: < 50% of protocol TVL - High concentration
- **Score 1.0**: ≥ 50% of protocol TVL - Critical concentration risk

#### 3. Volatility Risk (Weight: 14.3%)
Measures price stability based on standard deviation of daily returns:
- **Score 0.1**: StdDev < 2% - Low volatility
- **Score 0.4**: StdDev < 5% - Medium volatility
- **Score 0.7**: StdDev < 10% - High volatility
- **Score 1.0**: StdDev ≥ 10% - Critical volatility

#### 4. Age Risk (Weight: 14.3%)
Considers vault maturity and battle-testing:
- **Score 0.1**: Age ≥ 365 days - Mature vault (low risk)
- **Score 0.4**: Age ≥ 90 days - Established vault (medium-low risk)
- **Score 0.7**: Age ≥ 30 days - New vault (high risk)
- **Score 1.0**: Age < 30 days - Very new vault (critical risk)

#### 5. Curator Risk (Weight: 14.3%)
Assesses curator reputation based on experience and track record:
- **Score 0.1**: ≥10 vaults managed - Highly experienced
- **Score 0.3**: ≥5 vaults managed - Moderately experienced
- **Score 0.6**: ≥2 vaults managed - Limited experience
- **Score 0.9**: <2 vaults managed - New curator
- Adjusted by success rate (vaults with TVL >$10K)

#### 6. Fee Risk (Weight: 14.3%)
Impact of management and performance fees on returns:
- **Score 0.1**: Annual fee drag < 1% - Very low fees
- **Score 0.3**: Annual fee drag < 2% - Low fees
- **Score 0.5**: Annual fee drag < 3% - Moderate fees
- **Score 0.7**: Annual fee drag < 5% - High fees
- **Score 1.0**: Annual fee drag ≥ 5% - Very high fees
- Fee drag = management fee + (performance fee × 0.1 if above HWM)

#### 7. Liquidity Risk (Weight: 14.2%)
Ability to meet redemption requests based on coverage ratio:
- **Score 0.1**: No pending redemptions OR coverage ≥ 200%
- **Score 0.3**: Coverage ≥ 150% - Low risk
- **Score 0.5**: Coverage ≥ 100% - Medium risk
- **Score 0.7**: Coverage ≥ 50% - High risk
- **Score 1.0**: Coverage < 50% - Critical risk
- Coverage = safe assets / pending redemptions

### Weighted Composite Score

Overall risk score calculated as:
```
Overall = (TVL × 0.143) + (Concentration × 0.143) + (Volatility × 0.143) +
          (Age × 0.143) + (Curator × 0.143) + (Fee × 0.143) + (Liquidity × 0.142)
```

All factors weighted equally (~14.3% each) for balanced risk assessment. Risk scores are normalized to 0-1 range (0 = lowest risk, 1 = highest risk), then mapped to risk levels:
- **0.0-0.3**: Low risk
- **0.3-0.6**: Medium risk
- **0.6-0.8**: High risk
- **0.8-1.0**: Critical risk

### Actionable Insights

Each factor includes:
- **Score**: Numeric risk level (0-100)
- **Level**: Risk classification (LOW/MEDIUM/HIGH/CRITICAL)
- **Details**: Underlying metrics and thresholds
- **Insight**: Specific interpretation and context

### Recommendations

System generates recommendations based on:
- Risk level and factors
- Unusual patterns or outliers
- Investment suitability
- Monitoring suggestions

## Related Tools

- [get_vault_data](./get-vault-data.md): Current vault metrics for risk inputs
- [get_vault_performance](./vault-performance.md): Historical data for volatility
- [get_price_history](./price-history.md): Price volatility calculation
- [compare_vaults](./compare-vaults.md): Compare risk across vaults

## Common Workflows

### Pre-Investment Due Diligence
```
1. search_vaults - Find candidates
2. compare_vaults - Compare metrics
3. analyze_risk - Assess risk for finalists
4. get_vault_performance - Check history
5. Make informed decision
```

### Portfolio Risk Monitoring
```
1. get_user_portfolio - Get all positions
2. analyze_risk - Assess each vault
3. Calculate weighted portfolio risk
4. Identify high-risk exposures
```

### Risk-Adjusted Returns
```
1. get_vault_data - Get APR
2. analyze_risk - Get risk score
3. Calculate risk-adjusted return (APR / risk score)
4. Compare across vaults
```

## Related Prompts

**Risk Assessment Framework**: [/docs/prompts/financial-analysis.md#risk-assessment-framework](../prompts/financial-analysis.md#risk-assessment-framework)

See the analytical guide for:
- Risk interpretation guidelines (LOW/MEDIUM/HIGH categories)
- Red flag identification and investigation
- Risk-adjusted return analysis
- Portfolio risk monitoring patterns

---

## See Also

- [Risk Scoring Algorithm](../../src/utils/risk-scoring.ts) - Implementation details
- [Development Guide](../DEVELOPMENT.md#risk-analysis-tool) - Technical specs
- [DeFi Glossary](../../README.md#resources) - Understanding risk factors
