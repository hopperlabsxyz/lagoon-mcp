# export_data

## Overview

Export vault data, transactions, or analytics in CSV or JSON format for external analysis, spreadsheets, or data visualization tools. Supports multiple data types with RFC 4180 CSV compliance.

## Use Cases

- **Spreadsheet Analysis**: Export to Excel/Google Sheets
- **Data Backup**: Archive vault data
- **External Tools**: Feed data to BI/analytics platforms
- **Reporting**: Generate formatted reports
- **Integration**: Connect with external systems

## Parameters

### Required

- `dataType` (string): Type of data to export
  - `"vaults"` - Vault list with metrics
  - `"transactions"` - Transaction history
  - `"price_history"` - OHLCV time-series
  - `"performance"` - Performance metrics
  - `"portfolio"` - User portfolio data

- `format` (string): Export format
  - `"csv"` - Comma-separated values (RFC 4180 compliant)
  - `"json"` - JavaScript Object Notation

### Optional (varies by data type)

For `vaults`:
- `filters` (object): Same filters as [search_vaults](./search-vaults.md)
- `pagination` (object): Limit export size

For `transactions`:
- `vaultAddress` (string): Required
- `chainId` (number): Required
- `filters` (object): Transaction filters

For `price_history`:
- `vaultAddress` (string): Required
- `chainId` (number): Required
- `timeRange` (string): Time period

For `performance`:
- `vaultAddress` (string): Required
- `chainId` (number): Required
- `timeRange` (string): Time period

For `portfolio`:
- `userAddress` (string): Required

## Return Format

### CSV Format

RFC 4180 compliant CSV:
```csv
address,chainId,symbol,tvl,apr,capacity
0x1234...,42161,lgUSDC,1234567.89,5.67,5000000.00
0x5678...,42161,lgWETH,987654.32,7.89,2000000.00
```

Features:
- Header row with column names
- Quoted fields containing commas/newlines
- Proper escaping
- UTF-8 encoding

### JSON Format

Structured JSON array:
```json
[
  {
    "address": "0x1234...",
    "chainId": 42161,
    "symbol": "lgUSDC",
    "tvl": 1234567.89,
    "apr": 5.67,
    "capacity": 5000000.00
  }
]
```

Features:
- Array of objects
- Nested structures preserved
- Proper type handling
- Pretty-printed (readable)

## Examples

### Export Top Vaults

```
"Export the top 10 vaults by TVL as CSV"
```

Exports vault list with key metrics in CSV format.

### Transaction History Export

```
"Download transaction history for vault 0x1234... as JSON"
```

Exports complete transaction history in JSON format.

### Price Data for Charting

```
"Export price history for vault 0x1234... for the last 90 days as CSV"
```

Exports OHLCV data suitable for importing into charting tools.

### Portfolio Backup

```
"Export my portfolio as JSON for backup"
```

Exports complete portfolio data in JSON format.

### Performance Report

```
"Generate a CSV report of vault performance over the last 30 days"
```

Exports performance metrics in spreadsheet-friendly CSV format.

## Performance Characteristics

- **Cache TTL**: None (no caching for exports)
  - Exports are on-demand operations
  - Data freshness guaranteed
  - No stale data risk
- **Token Cost**: ~200-400 tokens per export
  - Base cost: 200 tokens
  - Additional: ~10-20 tokens per row
  - Format overhead minimal
- **Response Time**: 500-2000ms (depends on data size)
  - Data fetching: 300-1500ms
  - Formatting: 200-500ms
- **Best For**: External analysis, reporting, data backup

## Implementation Notes

### CSV Compliance

RFC 4180 compliant CSV ensures:
- Proper field quoting
- Escaped special characters
- Consistent line endings (CRLF)
- UTF-8 encoding
- Compatible with Excel, Google Sheets, etc.

### Column Selection

Exports include relevant columns for each data type:

**Vaults**: address, chainId, symbol, asset, tvl, apr, capacity, curator, visibility
**Transactions**: timestamp, type, user, amount, amountUsd, shares, txHash
**Price History**: timestamp, open, high, low, close, volume, change
**Performance**: date, tvl, deposits, withdrawals, sharePrice, growth
**Portfolio**: vaultAddress, chainId, symbol, balance, balanceUsd, sharePrice

### Size Limits

Exports limited to prevent excessive token usage:
- **Vaults**: Max 1000 vaults per export
- **Transactions**: Max 1000 transactions per export
- **Price History**: Full history (all time ranges)
- **Performance**: Full history for time range
- **Portfolio**: Complete portfolio (all positions)

For larger datasets: use pagination and multiple exports.

### No Caching

Exports not cached because:
- User expects fresh data for exports
- Export parameters highly variable
- Caching overhead not worth benefits
- On-demand nature of exports

### Format Selection

**Choose CSV when**:
- Importing to spreadsheets
- Need human-readable format
- Simple data structures
- Excel/Google Sheets analysis

**Choose JSON when**:
- Programmatic processing
- Complex nested structures
- Integration with applications
- Need to preserve types

## Related Tools

- [search_vaults](./search-vaults.md): Find vaults to export
- [get_transactions](./get-transactions.md): Transaction data for export
- [get_price_history](./price-history.md): Price data for export
- [get_vault_performance](./vault-performance.md): Performance data for export

## Common Workflows

### Spreadsheet Analysis
```
1. search_vaults - Find vaults by criteria
2. export_data - Export as CSV
3. Import to Excel/Google Sheets
4. Perform custom analysis
```

### Data Backup
```
1. get_user_portfolio - Get all positions
2. export_data - Export as JSON
3. Store locally or in cloud
4. Use for historical tracking
```

### External Integration
```
1. Query relevant data (vaults/transactions/etc.)
2. export_data - Export as JSON
3. Feed to BI tool or custom application
4. Automate reporting/monitoring
```

## See Also

- [Export Validators](../../src/utils/validators.ts) - Data type options
- [CSV Generator](../../src/utils/csv-generator.ts) - CSV formatting implementation
- [Development Guide](../DEVELOPMENT.md#export-tool) - Technical details
