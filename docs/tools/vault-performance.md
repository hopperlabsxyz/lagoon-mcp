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

## Return Format

Returns time-series data with summary statistics:

```json
{
  "vault": {
    "address": "0x1234...",
    "chainId": 42161,
    "symbol": "lgUSDC"
  },
  "timeRange": "30d",
  "metrics": {
    "tvl": [
      {
        "timestamp": "2025-01-01T00:00:00Z",
        "value": 1234567.89,
        "change24h": 2.34
      }
    ],
    "deposits": [
      {
        "timestamp": "2025-01-01T00:00:00Z",
        "count": 15,
        "volumeUsd": 45678.90
      }
    ],
    "withdrawals": [
      {
        "timestamp": "2025-01-01T00:00:00Z",
        "count": 8,
        "volumeUsd": 23456.78
      }
    ],
    "sharePrice": [
      {
        "timestamp": "2025-01-01T00:00:00Z",
        "price": "1.045678"
      }
    ]
  },
  "summary": {
    "startTvl": 1000000.00,
    "endTvl": 1234567.89,
    "tvlGrowth": 23.46,
    "avgDailyDeposits": 15234.56,
    "avgDailyWithdrawals": 7890.12,
    "sharePriceGrowth": 4.57
  }
}
```

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

### Time-Series Granularity

Data points returned based on time range:
- **7d**: Hourly or 4-hour intervals
- **30d**: Daily intervals
- **90d**: Daily intervals
- **1y**: Weekly intervals

Backend determines optimal granularity for readability and performance.

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

## See Also

- [Performance Validators](../../src/utils/validators.ts) - Time range options
- [Development Guide](../DEVELOPMENT.md#performance-tool) - Implementation
- [DeFi Glossary](../../README.md#resources) - Understanding metrics
