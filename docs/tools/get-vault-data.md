# get_vault_data

## Overview

Fetch comprehensive vault information with all available fields. Optimized for detailed analysis of individual vaults with 15-minute caching for improved performance. This tool is ideal when you need complete vault data including state, asset details, curator information, and all metrics.

## Use Cases

- **Detailed Vault Analysis**: Get all vault fields for comprehensive analysis
- **Small Vault Sets**: Efficiently query 1-5 vaults with caching benefits
- **Repeated Queries**: Leverage caching for frequently accessed vault data
- **Complete Information**: Need all vault fields without field selection overhead

## Parameters

### Required

- `vaultAddress` (string): Ethereum address of the vault
  - Format: `0x` followed by 40 hexadecimal characters
  - Example: `0x1234567890123456789012345678901234567890`
  - Case-insensitive (automatically normalized)

- `chainId` (number): Blockchain chain ID
  - Must be a positive integer
  - Common values:
    - `1` = Ethereum Mainnet
    - `42161` = Arbitrum One
    - `10` = Optimism
    - `137` = Polygon
    - `8453` = Base

### Optional

None - this tool returns all available fields by design.

## Return Format

Returns a complete `Vault` object with all available fields:

```json
{
  "vaultByAddress": {
    "id": "string",
    "address": "0x...",
    "chainId": 42161,
    "symbol": "lgUSDC",
    "asset": {
      "id": "string",
      "symbol": "USDC",
      "decimals": 6,
      "address": "0x..."
    },
    "state": {
      "totalAssets": "string",
      "totalAssetsUsd": 1234567.89,
      "totalSupply": "string",
      "sharePrice": "string",
      "capacity": "string",
      "capacityUsd": 5000000.00,
      "isDepositPaused": false,
      "isWithdrawPaused": false
    },
    "apr": {
      "net": 5.67,
      "gross": 6.45,
      "breakdown": {
        "base": 5.00,
        "reward": 1.45,
        "fee": -0.78
      }
    },
    "curator": {
      "id": "string",
      "address": "0x...",
      "name": "Curator Name"
    },
    "metadata": {
      "name": "Lagoon USDC Vault",
      "description": "...",
      "isVisible": true
    }
  }
}
```

## Examples

### Basic Vault Query

```
"Get details for vault 0x1234... on Arbitrum"
```

Returns complete vault information including current state, APR, curator, and metadata.

### Multiple Vaults

```
"Get data for vaults 0x1234... and 0x5678... on chain 42161"
```

Executes two separate queries (can leverage cache if recently queried).

### Vault Not Found

```
"Get vault 0x9999... on Ethereum"
```

Returns a clear message: "Vault not found: 0x9999... on chain 1" (not treated as an error).

## Performance Characteristics

- **Cache TTL**: 15 minutes
  - Balance between freshness and performance
  - Cache key: `vault:{address}:{chainId}`
  - Target cache hit rate: 80-90%
- **Token Cost**: ~500 tokens per vault
  - Includes all fields in VaultFragment
  - Consistent cost regardless of actual data size
- **Response Time**:
  - Cached: <100ms
  - Fresh: 500-1000ms
- **Best For**: Detailed analysis of 1-5 vaults, repeated queries

## Implementation Notes

### Comprehensive Data

Uses `VaultFragment` which includes:
- **Core Identity**: address, chainId, symbol, id
- **Asset Details**: symbol, decimals, address
- **Current State**: TVL, supply, price, capacity, pause status
- **Performance**: Net/gross APR with breakdown
- **Curator**: Address, name, reputation
- **Metadata**: Name, description, visibility
- **Historical**: Creation date, last updated

### Caching Strategy

Vault data has 15-minute TTL because:
- Vault state changes moderately (deposits/withdrawals)
- APR updates happen periodically (not real-time)
- Most analysis doesn't require real-time data
- Good balance between freshness and performance

To force fresh data: wait 15 minutes or restart the MCP server.

### No Field Selection

This tool returns ALL fields intentionally:
- Simplifies tool interface (no field selection parameter)
- Ensures complete data for comprehensive analysis
- Token cost is acceptable (~500 tokens)
- Field selection adds complexity without significant benefit

For custom field selection, use [query_graphql](./query-graphql.md).

## Related Tools

- [search_vaults](./search-vaults.md): Find vaults before analyzing them
- [get_vault_performance](./vault-performance.md): Historical metrics and trends
- [compare_vaults](./compare-vaults.md): Side-by-side comparison of multiple vaults
- [analyze_risk](./analyze-risk.md): Risk assessment for a vault
- [query_graphql](./query-graphql.md): Custom queries with field selection

## Common Workflows

### Single Vault Analysis
```
1. get_vault_data - Get current state
2. get_vault_performance - Check historical performance
3. analyze_risk - Assess risk profile
```

### Vault Comparison Workflow
```
1. search_vaults - Find candidate vaults
2. get_vault_data - Get details for each
3. compare_vaults - Side-by-side comparison
```

## See Also

- [VaultFragment Definition](../../src/graphql/fragments.ts) - Complete field list
- [Development Guide](../DEVELOPMENT.md#vault-data-tool) - Technical implementation
- [GraphQL Schema](../../README.md#resources) - Schema reference
