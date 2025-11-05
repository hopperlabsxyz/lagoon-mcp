# analyze_risk

## Overview

Multi-factor risk analysis with comprehensive scoring across 5 key risk dimensions: TVL risk, concentration risk, volatility risk, age risk, and curator risk. Provides weighted composite risk score with actionable insights and risk level classification.

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

Returns comprehensive 5-factor risk analysis with overall score and recommendations.

### Risk Level Query

```
"What's the overall risk level of lgUSDC vault?"
```

Provides risk level (LOW/MEDIUM/HIGH/CRITICAL) with explanation.

### Factor Breakdown

```
"Show me the detailed risk breakdown for vault 0x1234..."
```

Returns all 5 risk factors with individual scores, weights, and insights.

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
  - Includes all 5 factors
  - Detailed insights and recommendations
- **Response Time**:
  - Cached: <100ms
  - Fresh: 1000-2000ms (multi-factor calculation)
- **Best For**: Due diligence, risk assessment, investment decisions

## Implementation Notes

### Risk Scoring Methodology

**Score Range**: 0-100 (lower = lower risk)
- **0-25**: LOW risk
- **26-50**: MEDIUM risk
- **51-75**: HIGH risk
- **76-100**: CRITICAL risk

### Five Risk Factors

#### 1. TVL Risk (Weight: 30%)
Assesses vault size and liquidity:
- **LOW (0-25)**: TVL > $10M - Highly liquid, established
- **MEDIUM (26-50)**: TVL $1M-$10M - Adequate liquidity
- **HIGH (51-75)**: TVL $100K-$1M - Limited liquidity
- **CRITICAL (76-100)**: TVL < $100K - Very low liquidity

#### 2. Concentration Risk (Weight: 25%)
Evaluates holder distribution:
- **LOW**: Top 10 holders < 30% - Well distributed
- **MEDIUM**: Top 10 holders 30-50% - Moderate concentration
- **HIGH**: Top 10 holders 50-70% - Concentrated
- **CRITICAL**: Top 10 holders > 70% - High concentration risk

#### 3. Volatility Risk (Weight: 20%)
Measures price stability (30-day):
- **LOW**: Volatility < 5% - Very stable
- **MEDIUM**: Volatility 5-15% - Normal volatility
- **HIGH**: Volatility 15-30% - Elevated volatility
- **CRITICAL**: Volatility > 30% - High volatility

#### 4. Age Risk (Weight: 15%)
Considers vault maturity:
- **LOW**: Age > 180 days - Established vault
- **MEDIUM**: Age 90-180 days - Maturing vault
- **HIGH**: Age 30-90 days - Young vault
- **CRITICAL**: Age < 30 days - Very new, unproven

#### 5. Curator Risk (Weight: 10%)
Assesses curator quality:
- **LOW**: Top-tier curator, proven track record
- **MEDIUM**: Established curator, good reputation
- **HIGH**: New curator or limited track record
- **CRITICAL**: Unknown curator or negative history

### Weighted Composite Score

Overall risk score calculated as:
```
Overall = (TVL × 0.30) + (Concentration × 0.25) + (Volatility × 0.20) +
          (Age × 0.15) + (Curator × 0.10)
```

Weights reflect relative importance of each factor.

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

## See Also

- [Risk Scoring Algorithm](../../src/utils/risk-scoring.ts) - Implementation details
- [Development Guide](../DEVELOPMENT.md#risk-analysis-tool) - Technical specs
- [DeFi Glossary](../../README.md#resources) - Understanding risk factors
