# predict_yield

## Overview

ML-based yield forecasting using linear regression and exponential moving average (EMA) analysis. Provides projected returns for multiple time horizons (7d, 30d, 90d, 1y) with confidence intervals and trend detection.

## Use Cases

- **Investment Planning**: Forecast expected returns
- **Yield Optimization**: Compare projected yields across vaults
- **Trend Analysis**: Identify yield trends (increasing/decreasing)
- **Performance Expectations**: Set realistic return expectations
- **Portfolio Strategy**: Plan based on projected returns

## Parameters

### Required

- `vaultAddress` (string): Ethereum address of the vault
  - Format: `0x` followed by 40 hexadecimal characters
  - Example: `0x1234567890123456789012345678901234567890`

- `chainId` (number): Blockchain chain ID
  - Must be a positive integer
  - Common values: 1 (Ethereum), 42161 (Arbitrum), 10 (Optimism)

### Optional

- `historicalDays` (number): Days of history for training (default: 30)
  - Minimum: 7 days
  - Maximum: 365 days
  - Recommended: 30-90 days for balance of recency and data points
  - More days = more stable predictions but less responsive to recent changes

## Return Format

Returns yield projections with confidence:

```json
{
  "vault": {
    "address": "0x1234...",
    "chainId": 42161,
    "symbol": "lgUSDC"
  },
  "predictions": {
    "7d": {
      "projected": 5.85,
      "confidence": 0.85,
      "range": {
        "low": 5.45,
        "high": 6.25
      }
    },
    "30d": {
      "projected": 6.12,
      "confidence": 0.78,
      "range": {
        "low": 5.50,
        "high": 6.74
      }
    },
    "90d": {
      "projected": 6.45,
      "confidence": 0.65,
      "range": {
        "low": 5.20,
        "high": 7.70
      }
    },
    "1y": {
      "projected": 7.20,
      "confidence": 0.50,
      "range": {
        "low": 4.80,
        "high": 9.60
      }
    }
  },
  "trend": {
    "direction": "increasing",
    "strength": 0.72,
    "volatility": 0.15,
    "description": "Yields trending upward with moderate confidence"
  },
  "currentAPR": 5.67,
  "historicalData": {
    "days": 30,
    "avgAPR": 5.45,
    "minAPR": 4.89,
    "maxAPR": 6.12,
    "stdDev": 0.34
  },
  "model": {
    "type": "Linear Regression + EMA",
    "r2Score": 0.78,
    "mse": 0.12,
    "dataPoints": 30
  },
  "disclaimer": "Predictions are estimates based on historical data. Actual yields may vary significantly due to market conditions, protocol changes, and other factors."
}
```

## Examples

### Basic Yield Prediction

```
"Predict future yields for vault 0x1234... based on 30-day history"
```

Returns projections for 7d, 30d, 90d, and 1y with confidence intervals.

### Expected APR Trend

```
"What's the expected APR trend for lgUSDC over the next quarter?"
```

Focuses on 90d projection with trend analysis.

### Confidence Intervals

```
"Show me yield projections with confidence intervals for vault 0x1234..."
```

Returns projected yields with high/low ranges for each time horizon.

### Historical Comparison

```
"Based on 90-day history, what yields can I expect from this vault?"
```

Uses longer historical period (90 days) for more stable predictions.

## Performance Characteristics

- **Cache TTL**: 60 minutes
  - Longest cache TTL among tools
  - ML predictions computationally expensive
  - Predictions valid for longer periods
  - Cache key: `yield:{address}:{chainId}:{historicalDays}`
- **Token Cost**: ~400-600 tokens per prediction
  - Includes all time horizons
  - Confidence intervals and trend analysis
  - Model performance metrics
- **Response Time**:
  - Cached: <100ms
  - Fresh: 2000-4000ms (ML computation + data fetching)
- **Best For**: Investment planning, yield optimization, strategy development

## Implementation Notes

### Prediction Algorithm

**Two-Model Ensemble**:

1. **Linear Regression**
   - Fits linear trend to historical APR data
   - Captures long-term trends
   - Good for stable yield patterns
   - Coefficient represents trend direction/strength

2. **Exponential Moving Average (EMA)**
   - Weights recent data more heavily
   - Responsive to recent changes
   - Smooths short-term volatility
   - Alpha = 0.3 (balanced responsiveness)

**Ensemble**: Average of both models for robust predictions

### Confidence Calculation

Confidence score (0-1) based on:
- **Model Fit** (R² score): How well historical data fits model
- **Prediction Horizon**: Shorter horizons = higher confidence
- **Historical Volatility**: Lower volatility = higher confidence
- **Data Quality**: More data points = higher confidence

Confidence scores by horizon:
- **7d**: 0.80-0.95 (high confidence)
- **30d**: 0.70-0.85 (moderate-high)
- **90d**: 0.60-0.75 (moderate)
- **1y**: 0.45-0.60 (low-moderate)

### Confidence Intervals

Prediction ranges calculated using:
- Standard deviation of historical yields
- Confidence score adjustment
- Time horizon multiplier (longer = wider range)

Formula:
```
Range = Prediction ± (StdDev × (1 - Confidence) × HorizonMultiplier)
```

### Trend Detection

Trend analysis identifies:
- **Direction**: increasing, decreasing, or stable
- **Strength**: How strong the trend is (0-1)
- **Volatility**: Yield stability measure
- **Description**: Human-readable interpretation

Trend classifications:
- **Strong Increasing**: Slope > 0.5, R² > 0.7
- **Moderate Increasing**: Slope > 0.2, R² > 0.5
- **Stable**: Slope -0.2 to 0.2
- **Moderate Decreasing**: Slope < -0.2, R² > 0.5
- **Strong Decreasing**: Slope < -0.5, R² > 0.7

### Historical Data Requirements

Minimum requirements:
- **7 days** of history for any prediction
- **30 days** recommended for reliable predictions
- **90 days** for stable long-term forecasts

Insufficient data results in:
- Error message indicating minimum requirements
- Suggestion to check back when more history available

### Prediction Limitations

Important disclaimers:
- **Not Financial Advice**: Predictions are estimates only
- **Market Dependent**: External factors not modeled
- **Protocol Changes**: Updates can invalidate predictions
- **Black Swan Events**: Unexpected events not predicted
- **Past Performance**: Not indicative of future returns

## Related Tools

- [get_vault_performance](./vault-performance.md): Historical data for model training
- [get_vault_data](./get-vault-data.md): Current APR for comparison
- [analyze_risk](./analyze-risk.md): Risk assessment for predicted yields
- [compare_vaults](./compare-vaults.md): Compare predicted yields

## Common Workflows

### Investment Decision
```
1. search_vaults - Find high-yield candidates
2. predict_yield - Forecast future returns
3. analyze_risk - Assess risk for predicted yields
4. Calculate risk-adjusted expected returns
5. Make informed decision
```

### Yield Optimization
```
1. get_user_portfolio - Current positions
2. predict_yield - Project yields for each vault
3. search_vaults - Find better alternatives
4. compare_vaults - Compare current vs. projected alternatives
```

### Performance Expectations
```
1. predict_yield - Get projections
2. Monitor actual performance
3. Compare actual vs. predicted
4. Refine investment strategy
```

## Related Prompts

**Vault Performance Analysis Pattern**: [/docs/prompts/financial-analysis.md#2-vault-performance-analysis-pattern](../prompts/financial-analysis.md#2-vault-performance-analysis-pattern)

See the analytical guide for:
- Forward-looking yield analysis
- Confidence interval interpretation
- Forecast-based investment planning
- Combining historical and predicted performance

---

## See Also

- [Yield Prediction Algorithm](../../src/utils/yield-prediction.ts) - Implementation
- [Development Guide](../DEVELOPMENT.md#yield-prediction-tool) - Technical specs
- [DeFi Glossary](../../README.md#resources) - Understanding APR
