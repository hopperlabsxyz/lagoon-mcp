# compare_vaults

## Overview

Side-by-side comparison of 2-10 vaults with normalized metrics, percentile rankings, and best/worst identification. Ideal for evaluating investment options and identifying top performers.

## Use Cases

- **Investment Evaluation**: Compare candidate vaults before investing
- **Performance Benchmarking**: Identify best/worst performers
- **Due Diligence**: Side-by-side analysis of multiple options
- **Risk-Adjusted Returns**: Compare APR relative to comprehensive 12-factor risk scores
- **Portfolio Optimization**: Find better alternatives for current holdings
- **Safety Assessment**: Identify safest and riskiest vaults based on multi-dimensional risk analysis

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

Returns structured markdown comparison table with normalized metrics, risk analysis, and rankings:

**Output includes**:
- Summary statistics (average TVL, APR, risk)
- Best/worst performers identification
- Safest/riskiest vaults (when risk data available)
- Detailed comparison table with percentile rankings
- Delta from average metrics
- 12-factor risk scores with visual indicators

**Example Output** (with risk analysis):

```
# Vault Comparison Results

**Chain ID**: 42161
**Vaults Analyzed**: 3

## Summary Statistics

- **Average TVL**: $2.50M
- **Average APR**: 8.50%
- **Average Risk**: 35.0%

### Best Performer
- **Vault**: High Yield Vault
- **APR**: 12.00%

### Worst Performer
- **Vault**: Stable Vault
- **APR**: 6.50%

### Highest TVL
- **Vault**: Popular Vault
- **TVL**: $5.00M

### Lowest TVL
- **Vault**: Small Vault
- **TVL**: $1.00M

### Safest Vault
- **Vault**: Conservative Vault
- **Risk Score**: 25.0% (Low)

### Riskiest Vault
- **Vault**: Aggressive Vault
- **Risk Score**: 55.0% (Medium)

## Detailed Comparison

| Rank | Vault | TVL | APR | Risk | Score | TVL Δ | APR Δ | Risk Δ |
|------|-------|-----|-----|------|-------|-------|-------|--------|
| 1 | High Yield (lgUSDC) | $2.00M | 12.00% | 🟡 30.0% | 72.5 | -20.0% | +41.2% | -14.3% |
| 2 | Popular (lgWETH) | $5.00M | 8.50% | 🟢 25.0% | 68.3 | +100.0% | 0.0% | -28.6% |
| 3 | Stable (lgDAI) | $1.00M | 6.50% | 🟠 55.0% | 42.1 | -60.0% | -23.5% | +57.1% |

**Legend**:
- **Rank**: Overall ranking based on weighted score (40% APR, 30% TVL, 30% Safety)
- **Score**: Overall performance score (0-100)
- **TVL Δ**: Delta from average TVL (%)
- **APR Δ**: Delta from average APR (%)
- **Risk**: 12-factor risk score (🟢 Low, 🟡 Medium, 🟠 High, 🔴 Critical)
- **Risk Δ**: Delta from average risk (%)
```

**Without risk data** (fallback):
- Table excludes Risk and Risk Δ columns
- Scoring uses 60% APR, 40% TVL weighting
- Summary excludes safest/riskiest vault sections

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

Rankings assigned (1 = best) based on weighted composite scores:

**With Risk Data** (recommended):
- **40% APR Percentile**: Rewards higher yields
- **30% TVL Percentile**: Considers vault size and trust
- **30% Safety Percentile**: Incorporates 12-factor risk analysis (inverted: lower risk = higher score)
- **Lower rank = Better overall performance**

**Without Risk Data** (fallback):
- **60% APR Percentile**: Primary focus on yields
- **40% TVL Percentile**: Secondary consideration for size
- Ties resolved by TVL when scores equal

**Percentile Calculation**:
- 0-100 scale showing relative position within comparison set
- Higher percentile = better performance for that metric
- Risk percentiles inverted: lower risk scores → higher percentiles (safer vaults rank higher)

### Best/Worst Identification

Automatically identifies:
- **Highest TVL**: Most trusted/used vault
- **Best APR**: Highest net returns
- **Safest Vault**: Lowest risk score based on 12-factor analysis (when available)
- **Riskiest Vault**: Highest risk score requiring careful evaluation (when available)
- **Best Overall**: Weighted composite score balancing yield, size, and safety

### Delta Analysis

Calculates differences for context:
- **Highest vs. Lowest**: Range of variation
- **Delta Percentage**: Relative difference
- **Median**: Central tendency
- **Standard Deviation**: Volatility indicator

### 12-Factor Risk Analysis

When vault risk data is available, comparison includes comprehensive risk scoring based on 12 factors:

**Financial Factors** (30%):
1. **TVL Risk** (15%): Vault size relative to protocol total
2. **TVL Concentration** (15%): Position concentration risk

**Market Factors** (15%):
3. **Volatility Risk** (15%): Historical price stability

**Protocol Factors** (20%):
4. **Age Risk** (5%): Time since vault creation
5. **Curator Track Record** (10%): Curator success rate and professionalism
6. **Fee Structure** (5%): Management and performance fees impact

**Operational Factors** (20%):
7. **Liquidity Risk** (8%): Safe asset availability for redemptions
8. **APR Consistency** (7%): Yield stability over time
9. **Settlement Risk** (5%): Pending operations and settlement times

**Technical Factors** (15%):
10. **Yield Sustainability** (8%): Native vs. temporary yield sources
11. **Integration Complexity** (4%): Number of DeFi protocol dependencies
12. **Capacity Utilization** (3%): Vault capacity usage percentage

**Risk Levels**:
- 🟢 **Low** (0-25%): Conservative vaults with strong fundamentals
- 🟡 **Medium** (25-50%): Balanced risk-return profiles
- 🟠 **High** (50-75%): Elevated risk requiring careful monitoring
- 🔴 **Critical** (75-100%): Significant risk factors, expert evaluation recommended

**Integration Benefits**:
- Risk-adjusted rankings prioritize safer high-yield vaults
- Identify concentration and sustainability risks
- Enable informed investment decisions beyond just APR
- Support due diligence and compliance requirements

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
