# query_graphql

## Overview

Execute raw GraphQL queries directly against the Lagoon backend API. This tool is designed for power users who need full control over query structure, field selection, and filtering. No caching is applied since queries are unpredictable and often one-time operations.

## Use Cases

- **Custom Queries**: Execute queries with specific field selections not covered by other tools
- **Large Datasets**: Query 20+ vaults or complex aggregations
- **One-Time Analysis**: Ad-hoc queries for specific research needs
- **Advanced Filtering**: Complex filtering logic beyond standard tool parameters
- **Schema Exploration**: Test and validate GraphQL queries during development

## Parameters

### Required

- `query` (string): GraphQL query string (SDL format)
  - Must be valid GraphQL syntax
  - Can include fragments and nested selections
  - Should follow Lagoon schema structure

### Optional

- `variables` (object): GraphQL variables for parameterized queries
  - Key-value pairs matching query variable definitions
  - Supports all JSON-serializable types
  - Useful for dynamic queries

## Return Format

Returns the raw GraphQL response data as returned by the backend API. Structure depends on the query executed.

```json
{
  "data": {
    // Query-specific response structure
  }
}
```

## Examples

### Basic Vault Query

```
"Execute this GraphQL query: { vaults { items { symbol chainId } } }"
```

Returns all vaults with just symbol and chainId fields.

### Parameterized Query

```
"Run a GraphQL query to get vault 0x1234... on chain 42161 with custom fields"
```

The tool will construct and execute:
```graphql
query GetVault($address: Address!, $chainId: Int!) {
  vaultByAddress(address: $address, chainId: $chainId) {
    symbol
    asset { symbol }
    state { totalAssetsUsd }
  }
}
```

### Advanced Filtering

```
"Query all USDC vaults with TVL > $1M and sort by APR"
```

Executes complex filtering with multiple conditions and sorting.

## Performance Characteristics

- **Cache TTL**: None (no caching for custom queries)
- **Token Cost**: Variable (depends on query complexity)
  - Simple queries: ~200-300 tokens
  - Complex queries: 500-1000+ tokens
- **Response Time**: 500-2000ms (depends on backend and query complexity)
- **Best For**: Custom analysis, large datasets, one-time queries

## Implementation Notes

### No Caching Strategy

Custom queries are not cached because:
- Query structure is unpredictable
- Variables can change frequently
- Caching overhead would exceed benefits
- Users typically run one-time analysis queries

### Query Validation

The tool validates:
- Query string is non-empty
- GraphQL syntax is correct (via backend)
- Variables match query definitions (via backend)

Backend errors are returned directly to help debug query issues.

### When to Use Other Tools

Consider using specialized tools instead of `query_graphql` when:
- **1-5 vaults**: Use [get_vault_data](./get-vault-data.md) for caching benefits
- **User portfolios**: Use [get_user_portfolio](./user-portfolio.md) for optimized cross-chain queries
- **Vault search**: Use [search_vaults](./search-vaults.md) for advanced filtering
- **Historical data**: Use [get_vault_performance](./vault-performance.md) for time-series analysis

## ⚠️ Legal Disclaimer

**NOT FINANCIAL ADVICE** - This tool provides data analysis for informational purposes only.

- Do NOT rely solely on this tool for investment decisions
- Consult qualified financial professionals before investing
- Cryptocurrency investments carry substantial risk including complete loss of capital
- We accept no liability for losses from using this information
- Past performance ≠ future results

See [main disclaimer](../../README.md#️-important-legal-disclaimer) for full details.

## Related Tools

- [get_vault_data](./get-vault-data.md): Optimized single vault queries with caching
- [search_vaults](./search-vaults.md): Advanced vault filtering without writing GraphQL
- [get_user_portfolio](./user-portfolio.md): Cross-chain portfolio queries

## Technical Details

### GraphQL Client

Uses `graphql-request` library for query execution:
- Automatic request/response handling
- Error parsing and formatting
- Variable injection and validation

### Error Handling

Returns detailed error information for:
- GraphQL syntax errors
- Backend validation errors
- Network timeouts
- Invalid query structures

## See Also

- [GraphQL Schema Resource](../../README.md#resources) - Complete schema reference
- [Development Guide](../DEVELOPMENT.md) - Adding custom queries
- [Backend API Documentation](./.claude/BACKEND_CONTEXT.md) - GraphQL API details
