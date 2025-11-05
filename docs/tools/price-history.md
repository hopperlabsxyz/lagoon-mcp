# get_price_history

## Overview

Historical share price data with OHLCV (Open, High, Low, Close, Volume) time-series analysis. Includes volatility calculation, trend identification, and daily aggregation for price movement analysis.

## Use Cases

- **Price Trend Analysis**: Track share price movements over time
- **Volatility Assessment**: Measure price stability
- **Technical Analysis**: OHLCV candlestick data for charting
- **Investment Timing**: Identify entry/exit points
- **Performance Attribution**: Separate price gains from APR

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
  - `"all"` = Complete history since vault creation

## Return Format

Returns OHLCV time-series with statistics:

```json
{
  "vault": {
    "address": "0x1234...",
    "chainId": 42161,
    "symbol": "lgUSDC"
  },
  "timeRange": "30d",
  "priceHistory": [
    {
      "timestamp": "2025-01-01T00:00:00Z",
      "open": "1.045678",
      "high": "1.046789",
      "low": "1.044567",
      "close": "1.045890",
      "volume": "1234567.89",
      "change": "0.02"
    }
  ],
  "statistics": {
    "startPrice": "1.040000",
    "endPrice": "1.045890",
    "priceChange": 0.57,
    "high": "1.050000",
    "low": "1.038000",
    "volatility": 0.15,
    "trend": "upward"
  }
}
```

## Examples

### 30-Day Price History

```
"Show me price history for vault 0x1234... over the last 30 days"
```

Returns daily OHLCV data for the past 30 days with summary statistics.

### Volatility Check

```
"What's the price volatility for lgUSDC vault?"
```

Returns volatility metric (standard deviation of returns) indicating price stability.

### Complete History

```
"Get all-time price history for vault 0x1234..."
```

Uses `timeRange: "all"` to return complete price history since creation.

### Short-Term Analysis

```
"Has the price been stable over the last week?"
```

Uses `timeRange: "7d"` to analyze recent price movements and volatility.

## Performance Characteristics

- **Cache TTL**: 30 minutes
  - Historical price data changes less frequently
  - Cache key: `price:{address}:{chainId}:{timeRange}`
  - Balances freshness with performance
- **Token Cost**: ~300-500 tokens per vault per time range
  - Varies with number of data points
  - Includes statistics and trend analysis
- **Response Time**:
  - Cached: <100ms
  - Fresh: 1000-2500ms (depends on time range)
- **Best For**: Price analysis, volatility assessment, technical analysis

## Implementation Notes

### Daily Aggregation

Price data aggregated by day:
- **Open**: First price of the day
- **High**: Highest price during the day
- **Low**: Lowest price during the day
- **Close**: Last price of the day
- **Volume**: Total volume for the day

Hourly data available for 7d range (if requested).

### Volatility Calculation

Volatility metric calculated as:
- Standard deviation of daily returns
- Annualized for comparability
- Higher volatility = more price risk
- Lower volatility = more stable

Typical ranges:
- **Low**: <5% volatility (stable stablecoin vaults)
- **Medium**: 5-15% volatility (most vaults)
- **High**: >15% volatility (volatile assets)

### Trend Identification

Trend analysis includes:
- **Direction**: upward, downward, or sideways
- **Strength**: How consistent the trend is
- **Recent Change**: Last 24h vs. overall trend
- **Support/Resistance**: Key price levels

### Share Price vs. Asset Price

Returns **share price**, not asset price:
- Share price represents vault performance
- Includes accrued yields and fees
- Price appreciation = vault returns
- Compare with asset price for alpha

### Time Range Limits

All-time history can be large:
- Consider token costs for long histories
- Use specific time ranges for focused analysis
- Pagination not available for price history
- Large histories returned in full

## Related Tools

- [get_vault_data](./get-vault-data.md): Current share price
- [get_vault_performance](./vault-performance.md): Aggregated performance metrics
- [analyze_risk](./analyze-risk.md): Risk assessment including volatility
- [export_data](./export-data.md): Export price data for charting

## Common Workflows

### Technical Analysis
```
1. get_price_history - OHLCV data (30d or 90d)
2. Export to charting tool
3. Apply technical indicators
4. Identify entry/exit points
```

### Volatility Assessment
```
1. get_price_history - Multiple time ranges
2. Compare volatility across periods
3. Assess stability trend
4. Use in risk-adjusted return calculations
```

### Performance Attribution
```
1. get_price_history - Price appreciation
2. get_vault_performance - Total returns
3. Calculate yield contribution vs. price gains
4. Understand return sources
```

## See Also

- [Price Validators](../../src/utils/validators.ts) - Time range options
- [Development Guide](../DEVELOPMENT.md#price-history-tool) - Implementation
- [DeFi Glossary](../../README.md#resources) - Understanding share price
