# get_transactions

## Overview

Query vault transaction history with flexible filtering by transaction type, time range, and pagination support. Returns detailed transaction data including all transaction types (deposits, withdrawals, period summaries, fee events, etc.).

## Use Cases

- **Transaction History**: View all transactions for a vault
- **Activity Analysis**: Monitor deposit/withdrawal patterns
- **Type Filtering**: Focus on specific transaction types
- **Audit Trail**: Track vault activity over time
- **Volume Analysis**: Analyze transaction volumes and frequency

## Parameters

### Required

- `vaultAddress` (string): Ethereum address of the vault
  - Format: `0x` followed by 40 hexadecimal characters
  - Example: `0x1234567890123456789012345678901234567890`

- `chainId` (number): Blockchain chain ID
  - Must be a positive integer
  - Common values: 1 (Ethereum), 42161 (Arbitrum), 10 (Optimism)

### Optional

- `filters` (object):
  - `transactionTypes` (string[]): Filter by transaction type
    - `"Deposit"` - User deposits
    - `"Withdrawal"` - User withdrawals/redemptions
    - `"PeriodSummary"` - Period summary events
    - `"FeeCollection"` - Fee collection events
    - `"StateUpdate"` - State change events
    - `"Transfer"` - Share transfers
  - `fromDate` (string): Start date (ISO 8601 format)
  - `toDate` (string): End date (ISO 8601 format)

- `pagination` (object):
  - `first` (number): Number of results per page (default: 100, max: 1000)
  - `skip` (number): Number of results to skip (default: 0)

- `orderBy` (string): Sort field (default: "timestamp")
  - Common values: "timestamp", "amountUsd", "type"

- `orderDirection` (string): Sort direction (default: "desc")
  - "desc" = most recent first
  - "asc" = oldest first

## Return Format

Returns paginated transaction list:

```json
{
  "vault": {
    "address": "0x1234...",
    "chainId": 42161,
    "symbol": "lgUSDC"
  },
  "transactions": [
    {
      "id": "tx_12345",
      "type": "Deposit",
      "timestamp": "2025-01-05T10:30:00Z",
      "user": {
        "address": "0x5678..."
      },
      "amount": "1000000000",
      "amountUsd": 1234.56,
      "shares": "987654321",
      "txHash": "0xabcd...",
      "blockNumber": 12345678
    }
  ],
  "pageInfo": {
    "total": 1523,
    "hasNextPage": true
  }
}
```

## Examples

### All Recent Transactions

```
"Show me the last 50 transactions for vault 0x1234... on Arbitrum"
```

Returns most recent 50 transactions (all types), sorted by timestamp descending.

### Deposit-Only History

```
"Get all deposits for vault 0x1234... from the last week"
```

Filters:
```json
{
  "transactionTypes": ["Deposit"],
  "fromDate": "2025-01-01T00:00:00Z"
}
```

### Period Summaries

```
"Show me all PeriodSummary transactions for the last month"
```

Filters by transaction type to get period summary events only.

### Large Transaction Search

```
"Find all withdrawals over $10,000 for vault 0x1234..."
```

Retrieves all withdrawals, then filters by USD amount (post-processing).

### Paginated Query

```
"Get transactions 100-200 for vault 0x1234..."
```

Pagination:
```json
{
  "first": 100,
  "skip": 100
}
```

## Performance Characteristics

- **Cache TTL**: 15 minutes
  - Balance between freshness and performance
  - Cache key includes filters and pagination
  - New transactions appear after TTL expires
- **Token Cost**: Variable based on results
  - ~20-30 tokens per transaction
  - Typical query: 300-500 tokens for 50 transactions
- **Response Time**:
  - Cached: <100ms
  - Fresh: 500-1500ms (depends on filters and pagination)
- **Best For**: Transaction analysis, audit trails, activity monitoring

## Implementation Notes

### Transaction Union Type

Backend GraphQL uses union type for transactions:
- Each transaction type has specific fields
- Common fields: id, timestamp, txHash, blockNumber
- Type-specific fields accessed via GraphQL fragments

### All Transaction Types Returned

This tool returns ALL transaction union types:
- `Deposit`: User deposit events
- `Withdrawal`: User withdrawal/redemption events
- `PeriodSummary`: Period summary aggregations
- `FeeCollection`: Fee collection events
- `StateUpdate`: State change events
- `Transfer`: Share transfer events between users

### Pagination Limits

Maximum 1000 transactions per query:
- Enforced to prevent excessive token usage
- Use pagination for larger datasets
- Consider filtering by type or date range

### Timestamp Filtering

Date filters use ISO 8601 format:
- `fromDate`: Inclusive start date
- `toDate`: Inclusive end date
- Timezone: UTC recommended
- Example: `"2025-01-01T00:00:00Z"`

### No Amount Filtering

Amount filtering not supported in query:
- Backend doesn't support amount range filters
- For amount-based filtering:
  1. Query all transactions
  2. Filter results by amount in post-processing
  3. Consider type filtering to reduce dataset

## Related Tools

- [get_vault_data](./get-vault-data.md): Current vault state
- [get_vault_performance](./vault-performance.md): Aggregated metrics from transactions
- [get_user_portfolio](./user-portfolio.md): User's positions affected by transactions
- [export_data](./export-data.md): Export transactions for analysis

## Common Workflows

### Activity Audit
```
1. get_transactions - All transactions (paginated)
2. Filter by type and date
3. Analyze patterns and anomalies
4. export_data - Export for reporting
```

### User Activity Tracking
```
1. get_transactions - Filter by user address
2. Group by transaction type
3. Calculate user's total deposits/withdrawals
4. Assess user behavior patterns
```

### Volume Analysis
```
1. get_transactions - Deposits over time period
2. Aggregate volume by day/week
3. Identify peak activity periods
4. Compare with performance metrics
```

## See Also

- [Transaction Validators](../../src/utils/validators.ts) - Filter options
- [GraphQL Transaction Types](../../README.md#resources) - Union type details
- [Development Guide](../DEVELOPMENT.md#transaction-tool) - Implementation
