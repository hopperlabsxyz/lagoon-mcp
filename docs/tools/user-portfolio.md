# get_user_portfolio

## Overview

Aggregate user holdings across all supported chains in a single query. Returns cross-chain portfolio with USD valuations, sorted by position size. Optimized with 5-minute caching for frequently accessed portfolios.

## Use Cases

- **Portfolio Overview**: Get complete view of all positions across chains
- **Position Tracking**: Monitor holdings and their USD values
- **Asset Allocation**: Understand cross-chain exposure
- **Quick Portfolio Check**: Frequently query same address with caching benefits

## Parameters

### Required

- `userAddress` (string): Ethereum address of the user/wallet
  - Format: `0x` followed by 40 hexadecimal characters
  - Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
  - Case-insensitive (automatically normalized)
  - Works across all supported chains automatically

### Optional

None - automatically queries all 12+ supported chains.

## Return Format

Returns user positions sorted by USD value (descending):

```json
{
  "userAddress": "0x742d35...",
  "positions": [
    {
      "vault": {
        "address": "0x1234...",
        "chainId": 42161,
        "symbol": "lgUSDC",
        "asset": {
          "symbol": "USDC",
          "decimals": 6
        }
      },
      "balance": "1000000000",
      "balanceUsd": 1234.56,
      "sharePrice": "1.23456",
      "shares": "812345"
    }
  ],
  "totalValueUsd": 5678.90,
  "positionCount": 3,
  "chainCount": 2
}
```

## Examples

### Basic Portfolio Query

```
"Show my portfolio for wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

Returns all positions across all chains, sorted by USD value.

### Portfolio Analysis

```
"Analyze my DeFi positions"
"What's my total exposure to USDC vaults?"
```

Claude will use portfolio data to provide analysis and answer questions about asset exposure.

### Empty Portfolio

```
"Check portfolio for address 0x9999..."
```

Returns: "No positions found for this address" (not treated as an error).

## Performance Characteristics

- **Cache TTL**: 5 minutes
  - Shorter TTL due to more dynamic nature of user positions
  - Cache key: `portfolio:{userAddress}`
  - Fresh data for active traders, caching for passive investors
- **Token Cost**: ~500-1000 tokens
  - Varies with number of positions
  - Includes vault details for each position
- **Response Time**:
  - Cached: <100ms
  - Fresh: 1000-2000ms (queries all chains)
- **Best For**: Frequent portfolio checks, position tracking, portfolio analysis

## Implementation Notes

### Cross-Chain Aggregation

Queries all supported chains in a single request:
- Ethereum, Arbitrum, Optimism, Base, Polygon, and more (12+ networks)
- Backend handles parallel chain queries
- Results aggregated and sorted by USD value
- No need to specify chains - automatic coverage

### USD Valuation

Position values calculated using:
- Current share price from vault state
- User's share balance
- Asset price feeds from backend
- Automatic currency conversion

### Sorting Strategy

Positions sorted by USD value (descending) to:
- Highlight largest holdings first
- Prioritize important positions
- Simplify risk assessment
- Improve readability

### No Chain Selection

No chain parameter because:
- Users typically want complete portfolio view
- Cross-chain holdings are common
- Partial portfolio data is misleading
- Backend efficiently handles multi-chain queries

For single-chain analysis, filter results after query or use [query_graphql](./query-graphql.md).

## Related Tools

- [get_vault_data](./get-vault-data.md): Deep dive into specific vault positions
- [analyze_risk](./analyze-risk.md): Risk assessment for portfolio vaults
- [get_transactions](./get-transactions.md): Transaction history for positions
- [export_data](./export-data.md): Export portfolio for spreadsheet analysis

## Common Workflows

### Portfolio Monitoring
```
1. get_user_portfolio - Get current positions
2. get_vault_data - Details on largest positions
3. analyze_risk - Risk profile for each vault
4. export_data - Export for tracking
```

### Asset Exposure Analysis
```
1. get_user_portfolio - Get all positions
2. Group by asset (USDC, WETH, etc.)
3. Calculate total exposure per asset
4. Assess concentration risk
```

### Performance Tracking
```
1. get_user_portfolio - Current position values
2. get_transactions - Historical activity
3. Calculate realized/unrealized gains
4. Track performance over time
```

## See Also

- [GraphQL User Queries](../../src/graphql/client.ts) - Query implementation
- [Development Guide](../DEVELOPMENT.md#portfolio-tool) - Technical details
- [DeFi Glossary](../../README.md#resources) - Understanding positions and shares
