# compare_vaults

## Overview

Side-by-side comparison of 2-10 vaults with normalized metrics, percentile rankings, and best/worst identification. Ideal for evaluating investment options and identifying top performers.

## Use Cases

- **Investment Evaluation**: Compare candidate vaults before investing
- **Performance Benchmarking**: Identify best/worst performers
- **Due Diligence**: Side-by-side analysis of multiple options
- **Risk-Adjusted Returns**: Compare APR relative to risk factors
- **Portfolio Optimization**: Find better alternatives for current holdings

## Parameters

### Required

- `vaults` (array): List of 2-10 vault identifiers
  - Each item: `{ vaultAddress: string, chainId: number }`
  - Minimum: 2 vaults
  - Maximum: 10 vaults (to maintain readability and token efficiency)
  - Example:
    ```json
    [
      { "vaultAddress": "0x1234...", "chainId": 42161 },
      { "vaultAddress": "0x5678...", "chainId": 42161 }
    ]
    ```

### Optional

None - comparison uses all available vault fields automatically.

## Return Format

Returns structured comparison with rankings:

```json
{
  "comparison": {
    "vaults": [
      {
        "address": "0x1234...",
        "chainId": 42161,
        "symbol": "lgUSDC",
        "metrics": {
          "tvl": 1234567.89,
          "tvlRank": 1,
          "tvlPercentile": 95,
          "apr": {
            "net": 5.67,
            "gross": 6.45,
            "rank": 2
          },
          "capacity": {
            "total": 5000000.00,
            "utilization": 24.69,
            "rank": 3
          },
          "age": {
            "days": 180,
            "rank": 1
          }
        },
        "highlights": ["Highest TVL", "Established vault"]
      }
    ],
    "summary": {
      "bestTvl": "0x1234...",
      "bestApr": "0x5678...",
      "mostCapacity": "0x9abc...",
      "oldest": "0x1234..."
    },
    "deltas": {
      "tvl": {
        "highest": 1234567.89,
        "lowest": 456789.12,
        "delta": 170.2,
        "median": 890123.45
      },
      "apr": {
        "highest": 7.89,
        "lowest": 3.45,
        "delta": 4.44,
        "median": 5.67
      }
    }
  }
}
```

## Examples

### Basic Vault Comparison

```
"Compare these 3 vaults: 0x1234..., 0x5678..., 0x9abc..."
```

Returns side-by-side comparison with rankings and best/worst identification.

### Risk-Adjusted Returns

```
"Which vault has better risk-adjusted returns?"
```

Compares APR, TVL stability, age, and provides recommendation.

### Top USDC Vaults

```
"Show me a comparison of top 5 USDC vaults on Arbitrum"
```

Workflow:
1. search_vaults to find top 5 by TVL
2. compare_vaults with results
3. Returns comprehensive comparison

### Replacement Analysis

```
"Compare my current vault 0x1234... with these alternatives: 0x5678..., 0x9abc..."
```

Helps decide if switching vaults would be beneficial.

## Performance Characteristics

- **Cache TTL**: 15 minutes
  - Cache key: MD5 hash of vault addresses + chain IDs
  - Different vault sets = different cache entries
  - Reasonable TTL for comparison stability
- **Token Cost**: ~300 tokens per vault
  - Total: 600-3000 tokens for 2-10 vaults
  - Includes metrics, rankings, and analysis
- **Response Time**:
  - Cached: <100ms
  - Fresh: 1000-3000ms (depends on vault count)
- **Best For**: Investment decisions, portfolio optimization, due diligence

## Implementation Notes

### Normalized Metrics

All metrics normalized for fair comparison:
- **APR**: Net APR as primary metric
- **TVL**: Compared in USD for cross-asset comparison
- **Capacity**: Utilization percentage (TVL / capacity)
- **Age**: Days since vault creation
- **Curator Reputation**: If available from backend

### Ranking System

Rankings assigned (1 = best) for each metric:
- **Lower rank = Better performance**
- Ties resolved by secondary metrics
- Percentile scores show relative position
- Rankings help identify outliers

### Best/Worst Identification

Automatically identifies:
- **Highest TVL**: Most trusted/used vault
- **Best APR**: Highest net returns
- **Most Capacity**: Largest growth potential
- **Oldest**: Most established
- **Best Overall**: Weighted composite score

### Delta Analysis

Calculates differences for context:
- **Highest vs. Lowest**: Range of variation
- **Delta Percentage**: Relative difference
- **Median**: Central tendency
- **Standard Deviation**: Volatility indicator

### Comparison Limits

2-10 vault limit because:
- **Minimum 2**: Need at least two for comparison
- **Maximum 10**: Maintains readability
- **Token Efficiency**: More vaults = more tokens
- **Cognitive Load**: 10 vaults is manageable
- For more than 10: Use multiple comparison queries or [search_vaults](./search-vaults.md) with sorting

## Related Tools

- [search_vaults](./search-vaults.md): Find vaults to compare
- [get_vault_data](./get-vault-data.md): Detailed data on winning vault
- [analyze_risk](./analyze-risk.md): Risk profile for each vault
- [get_vault_performance](./vault-performance.md): Historical trends for finalists

## Common Workflows

### Investment Decision
```
1. search_vaults - Find candidates by criteria
2. compare_vaults - Compare top 3-5 options
3. analyze_risk - Risk profile for finalists
4. get_vault_performance - Check historical performance
5. Make informed decision
```

### Portfolio Optimization
```
1. get_user_portfolio - Current holdings
2. search_vaults - Find better alternatives
3. compare_vaults - Compare current vs. alternatives
4. Identify improvement opportunities
```

### Market Analysis
```
1. search_vaults - Top vaults by TVL
2. compare_vaults - Analyze top performers
3. Identify market leaders and trends
```

## Related Prompts

**Vault Performance Analysis Pattern**: [/docs/prompts/financial-analysis.md#2-vault-performance-analysis-pattern](../prompts/financial-analysis.md#2-vault-performance-analysis-pattern)

See the analytical guide for:
- Benchmark comparison techniques
- Relative performance assessment
- Risk-adjusted return calculations
- Investment decision frameworks

---

## See Also

- [Comparison Validators](../../src/utils/validators.ts) - Input validation
- [Comparison Metrics](../../src/utils/comparison-metrics.ts) - Ranking algorithms
- [Development Guide](../DEVELOPMENT.md#comparison-tool) - Implementation details
