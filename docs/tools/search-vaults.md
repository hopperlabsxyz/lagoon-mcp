# search_vaults

## Overview

Advanced vault discovery with 20+ filter options for finding vaults by asset, chain, TVL, capacity, curator, and more. Features intelligent caching with MD5 filter hashing and pagination support for large result sets.

## Use Cases

- **Vault Discovery**: Find vaults matching specific criteria
- **Asset-Specific Search**: Filter by asset symbol or ID
- **Chain-Specific Search**: Find vaults on specific blockchains
- **TVL Filtering**: Find vaults above/below certain TVL thresholds
- **Curator Research**: Discover vaults by specific curators
- **Visibility Filtering**: Find only publicly visible or all vaults

## Parameters

### Optional

#### `filters` (object)
Advanced filtering options with 20+ criteria:

**Asset Filters:**
- `assetSymbol_eq` (string): Exact asset symbol match (e.g., "USDC")
- `assetSymbol_in` (string[]): Match any of the asset symbols
- `assetId_eq` (string): Exact asset ID match
- `assetId_in` (string[]): Match any of the asset IDs

**Chain Filters:**
- `chainId_eq` (number): Exact chain ID match (e.g., 42161 for Arbitrum)
- `chainId_in` (number[]): Match any of the chain IDs

**TVL Filters:**
- `state_totalAssetsUsd_gte` (number): Minimum TVL in USD (greater than or equal)
- `state_totalAssetsUsd_lte` (number): Maximum TVL in USD (less than or equal)

**Curator Filters:**
- `curatorIds_contains` (string[]): Must contain all curator IDs
- `curatorIds_contains_any` (string[]): Must contain at least one curator ID

**Visibility:**
- `isVisible_eq` (boolean): Filter by visibility status (true = public only)

**Additional Filters:**
- `address_eq` (string): Exact vault address match
- `address_in` (string[]): Match any of the addresses
- `symbol_eq` (string): Exact vault symbol match
- `symbol_in` (string[]): Match any of the symbols
- `integratorId_eq` (string): Exact integrator ID
- `integratorId_in` (string[]): Match any integrator IDs

#### `pagination` (object)
- `first` (number): Number of results per page (default: 100, max: 1000)
- `skip` (number): Number of results to skip (default: 0)

#### `orderBy` (string)
Sort field (default: "totalAssetsUsd")
- Common values: "totalAssetsUsd", "apr", "symbol", "chainId"

#### `orderDirection` (string)
Sort direction (default: "desc")
- "desc" = descending (high to low)
- "asc" = ascending (low to high)

## Return Format

Returns paginated vault results:

```json
{
  "items": [
    {
      "address": "0x1234...",
      "chainId": 42161,
      "symbol": "lgUSDC",
      "asset": {
        "symbol": "USDC",
        "decimals": 6
      },
      "state": {
        "totalAssetsUsd": 1234567.89,
        "capacity": "5000000000000",
        "capacityUsd": 5000000.00
      },
      "apr": {
        "net": 5.67,
        "gross": 6.45
      },
      "curator": {
        "name": "Curator Name"
      },
      "metadata": {
        "name": "Lagoon USDC Vault",
        "isVisible": true
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": true,
    "total": 245
  }
}
```

## Examples

### Find USDC Vaults on Arbitrum

```
"Find all USDC vaults on Arbitrum"
```

Applies filters:
```json
{
  "assetSymbol_eq": "USDC",
  "chainId_eq": 42161
}
```

### High TVL Vaults

```
"Show me vaults with more than $5M TVL"
```

Applies filter:
```json
{
  "state_totalAssetsUsd_gte": 5000000
}
```

### Curator-Specific Search

```
"Find all visible vaults managed by curator 0x1234..."
```

Applies filters:
```json
{
  "curatorIds_contains_any": ["0x1234..."],
  "isVisible_eq": true
}
```

### Multi-Asset Search

```
"Find WETH or WBTC vaults on Ethereum with TVL > $1M"
```

Applies filters:
```json
{
  "assetSymbol_in": ["WETH", "WBTC"],
  "chainId_eq": 1,
  "state_totalAssetsUsd_gte": 1000000
}
```

### Pagination Example

```
"Show me the next 50 vaults after the first 100"
```

Pagination:
```json
{
  "first": 50,
  "skip": 100
}
```

## Performance Characteristics

- **Cache TTL**: 10 minutes
  - MD5 hash of filter object for cache key
  - Different filters = different cache entries
  - Balance between freshness and query performance
- **Token Cost**: ~300-500 tokens per page
  - Varies with result count
  - Pagination reduces token usage
- **Response Time**:
  - Cached: <100ms
  - Fresh: 500-1500ms (depends on filters)
- **Best For**: Vault discovery, research, finding investment opportunities

## Implementation Notes

### Intelligent Cache Keys

Cache key uses MD5 hash of:
- Filter object (JSON stringified, sorted keys)
- Pagination parameters
- Sort order and direction

This ensures:
- Identical queries hit cache
- Different filters don't collide
- Efficient cache lookups

### Filter Composition

All filters are combined with AND logic:
- `assetSymbol_eq: "USDC"` AND `chainId_eq: 42161` AND `state_totalAssetsUsd_gte: 1000000`

For OR logic within a single field, use `_in` variants:
- `assetSymbol_in: ["USDC", "USDT"]` = USDC OR USDT

### Nested State Filters

TVL filters use nested path:
- `state_totalAssetsUsd_gte` accesses `vault.state.totalAssetsUsd`
- Backend GraphQL supports nested filter paths
- Allows filtering on computed/aggregated values

### Pagination Best Practices

For large result sets:
1. Start with `first: 100` (default)
2. Check `hasNextPage` in response
3. Increment `skip` by `first` for next page
4. Maximum page size: 1000 (enforced)

## Related Tools

- [get_vault_data](./get-vault-data.md): Get details after finding vaults
- [compare_vaults](./compare-vaults.md): Compare search results
- [query_graphql](./query-graphql.md): Custom search queries beyond provided filters

## Common Workflows

### Discovery Workflow
```
1. search_vaults - Find candidates by criteria
2. compare_vaults - Compare top results
3. get_vault_data - Deep dive into selected vaults
4. analyze_risk - Assess risk profiles
```

### Market Research
```
1. search_vaults - All vaults for an asset
2. Sort by TVL/APR
3. Analyze top performers
4. Identify market trends
```

## Related Prompts

**Vault Discovery Pattern**: [/docs/prompts/financial-analysis.md#3-vault-discovery-pattern](../prompts/financial-analysis.md#3-vault-discovery-pattern)

See the analytical guide for:
- Criteria matching strategies
- Quality filtering approaches
- Ranking and recommendation patterns
- Risk-tolerance-based vault selection

---

## See Also

- [Search Validators](../../src/utils/validators.ts) - Complete filter reference
- [Development Guide](../DEVELOPMENT.md#search-tool) - Implementation details
- [GraphQL Filters](../../README.md#resources) - Backend filter capabilities
