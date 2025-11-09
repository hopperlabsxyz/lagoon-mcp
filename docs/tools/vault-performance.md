# get_vault_performance

## Overview

Historical metrics and performance analysis with time-series data for TVL, deposits, withdrawals, and share price trends. Supports multiple time ranges (7d, 30d, 90d, 1y) with summary statistics for quick analysis.

## Use Cases

- **TVL Trends**: Track total value locked over time
- **Activity Analysis**: Monitor deposit/withdrawal patterns
- **Price History**: Analyze share price movements
- **Performance Comparison**: Compare across different time periods
- **Trend Identification**: Detect growth or decline patterns

## Parameters

### Required

- `vaultAddress` (string): Ethereum address of the vault
  - Format: `0x` followed by 40 hexadecimal characters
  - Example: `0x1234567890123456789012345678901234567890`

- `chainId` (number): Blockchain chain ID
  - Must be a positive integer
  - Common values: 1 (Ethereum), 42161 (Arbitrum), 10 (Optimism)

### Optional

- `timeRange` (string): Historical time period (default: "30d")
  - `"7d"` = Last 7 days
  - `"30d"` = Last 30 days
  - `"90d"` = Last 90 days
  - `"1y"` = Last 1 year

- `includeSDKCalculations` (boolean): Include SDK-calculated APR data (default: true)
  - When enabled, includes protocol-accurate APR calculations using Lagoon SDK
  - Fetches period summaries and calculates 30-day and inception APR
  - Gracefully degrades if data unavailable (new vaults)

## Return Format

Returns time-series metrics with summary statistics and optional SDK-calculated APR:

```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "timeRange": "30d",
  "metrics": [
    {
      "timestamp": 1704067200,
      "totalAssetsUsd": 1234567.89,
      "blockNumber": "12345678"
    }
  ],
  "summary": {
    "startValue": 1000000.00,
    "endValue": 1234567.89,
    "percentChange": 23.46,
    "volumeUsd": 567890.12,
    "transactionCount": 342
  },
  "hasMoreData": false,
  "sdkCalculatedAPR": {
    "method": "Lagoon SDK v0.10.1",
    "dataSource": "Lagoon GraphQL period summaries",
    "thirtyDay": {
      "timestamp": 1701475200,
      "pricePerShare": "1025000",
      "pricePerShareDecimal": "1.025000",
      "apr": 30.42
    },
    "inception": {
      "timestamp": 1696118400,
      "pricePerShare": "1000000",
      "pricePerShareDecimal": "1.000000",
      "apr": 12.75
    }
  }
}
```

### SDK-Calculated APR Fields

When `includeSDKCalculations` is true (default), the response includes:

- `sdkCalculatedAPR.method`: SDK version used for calculations
- `sdkCalculatedAPR.dataSource`: Source of historical data
- `sdkCalculatedAPR.thirtyDay`: 30-day APR calculation (if available)
  - `timestamp`: Unix timestamp of historical price point
  - `pricePerShare`: Raw price per share (wei format)
  - `pricePerShareDecimal`: Human-readable price per share
  - `apr`: Annualized percentage return (e.g., 30.42 = 30.42%)
- `sdkCalculatedAPR.inception`: Inception APR from vault creation (if available)

**Note**: SDK APR calculations are gracefully degraded for new vaults with insufficient history.

## Examples

### 30-Day Performance

```
"Analyze vault 0x1234... performance over the last 30 days"
```

Returns 30-day time-series data with daily granularity and summary statistics.

### Compare Time Periods

```
"Compare performance for vault 0x1234... across 7d, 30d, and 90d periods"
```

Executes three queries (can leverage cache if recently queried) and compares results.

### TVL Trend Analysis

```
"Show me TVL trends for the lgUSDC vault on Arbitrum"
```

Returns TVL time-series with growth rates and trend direction.

### Activity Monitoring

```
"How active has vault 0x1234... been over the last week?"
```

Uses 7d time range to show recent deposit/withdrawal activity.

## Performance Characteristics

- **Cache TTL**: 30 minutes
  - Historical data changes less frequently
  - Longer TTL improves performance
  - Cache key: `performance:{address}:{chainId}:{timeRange}`
- **Token Cost**: ~400-600 tokens per vault per time range
  - Includes time-series data points
  - Summary statistics
  - Vault metadata
- **Response Time**:
  - Cached: <100ms
  - Fresh: 1000-2000ms (depends on time range)
- **Best For**: Performance tracking, trend analysis, historical comparisons

## Implementation Notes

### SDK APR Methodology

The SDK-calculated APR uses Lagoon protocol's official calculation logic:

1. **Data Collection**: Fetches historical period summaries from GraphQL
2. **Price Per Share Calculation**: Uses `VaultUtils.convertToAssets()` for protocol-accurate pricing
3. **APR Calculation**: Annualizes price per share changes over time
4. **Graceful Degradation**: Returns undefined for new vaults with <30 days history

**Advantages over GraphQL APR**:
- Matches smart contract logic exactly
- Uses same SDK as frontend application
- Production-validated patterns from frontend-dapp-v2
- Handles edge cases (zero supply, decimal offsets)

### Time-Series Granularity

Data points returned based on time range:
- **7d**: All available TotalAssetsUpdated and PeriodSummary transactions
- **30d**: All available TotalAssetsUpdated and PeriodSummary transactions
- **90d**: All available TotalAssetsUpdated and PeriodSummary transactions
- **1y**: All available TotalAssetsUpdated and PeriodSummary transactions

Data granularity determined by transaction frequency (not sampled).

### Summary Statistics

Automatically calculated:
- **TVL Growth**: Percentage change from start to end
- **Average Daily Deposits**: Mean deposit volume per day
- **Average Daily Withdrawals**: Mean withdrawal volume per day
- **Share Price Growth**: Percentage price change
- **Net Flow**: Deposits minus withdrawals

### Trend Detection

Analysis includes:
- Growth vs. decline trends
- Volatility indicators
- Anomaly detection (sudden spikes/drops)
- Seasonal patterns (for 1y data)

### Caching Strategy

30-minute TTL because:
- Historical data doesn't change (immutable)
- New data points added periodically (not real-time)
- Performance benefit outweighs freshness need
- Most analysis doesn't require minute-by-minute updates

## ⚠️ Legal Disclaimer

**NOT FINANCIAL ADVICE** - This tool provides data analysis for informational purposes only.

- Do NOT rely solely on this tool for investment decisions
- Consult qualified financial professionals before investing
- Cryptocurrency investments carry substantial risk including complete loss of capital
- We accept no liability for losses from using this information
- Past performance ≠ future results

See [main disclaimer](../../README.md#️-important-legal-disclaimer) for full details.

## Related Tools

- [get_vault_data](./get-vault-data.md): Current vault state
- [get_price_history](./price-history.md): Detailed price OHLCV data
- [get_transactions](./get-transactions.md): Individual transaction details
- [compare_vaults](./compare-vaults.md): Compare performance across vaults

## Common Workflows

### Performance Monitoring
```
1. get_vault_data - Current state
2. get_vault_performance - Historical trends (30d)
3. Identify growth patterns
4. Compare against benchmarks
```

### Due Diligence
```
1. search_vaults - Find candidates
2. get_vault_performance - Check history (90d or 1y)
3. analyze_risk - Assess stability
4. Compare against alternatives
```

### Trend Analysis
```
1. get_vault_performance - Multiple time ranges
2. Identify short-term vs. long-term trends
3. Detect anomalies or pattern changes
4. Forecast future performance
```

## Related Prompts

**Vault Performance Analysis Pattern**: [/docs/prompts/financial-analysis.md#2-vault-performance-analysis-pattern](../prompts/financial-analysis.md#2-vault-performance-analysis-pattern)

See the analytical guide for:
- Time-series analysis techniques
- Return calculation methodologies
- Benchmark comparison strategies
- Volume analysis and trend identification

---

## See Also

- [Performance Validators](../../src/utils/validators.ts) - Time range options
- [Development Guide](../DEVELOPMENT.md#performance-tool) - Implementation
- [DeFi Glossary](../../README.md#resources) - Understanding metrics
