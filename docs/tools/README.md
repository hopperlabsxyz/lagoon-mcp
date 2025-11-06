# Lagoon MCP Tools Reference

Complete reference for all available tools in the Lagoon MCP Server.

## Related Documentation

📊 **Analytical Frameworks**: [/docs/prompts/README.md](../prompts/README.md)

For guidance on *how to analyze* vault data using these tools, see:
- **[Financial Analysis Framework](../prompts/financial-analysis.md)** - Comprehensive patterns for portfolio analysis, vault evaluation, and risk assessment
- **[Advanced Analysis Patterns](../prompts/analysis-patterns.md)** - Complex analysis techniques *(coming soon)*

This document focuses on **tool capabilities** (what tools can do). For **analytical patterns** (how to use tools together), see the prompts documentation above.

---

## Tool Categories

### Core Data Access
- [query_graphql](./query-graphql.md) - Execute raw GraphQL queries
- [get_vault_data](./get-vault-data.md) - Get comprehensive vault information
- [get_user_portfolio](./user-portfolio.md) - Cross-chain portfolio aggregation

### Discovery & Search
- [search_vaults](./search-vaults.md) - Advanced vault filtering with 20+ criteria

### Analytics & Performance
- [get_vault_performance](./vault-performance.md) - Historical metrics and trends
- [get_transactions](./get-transactions.md) - Transaction history with filtering
- [compare_vaults](./compare-vaults.md) - Side-by-side vault comparison
- [get_price_history](./price-history.md) - OHLCV time-series data

### Data Export
- [export_data](./export-data.md) - Export to CSV/JSON formats

### Advanced Analysis
- [analyze_risk](./analyze-risk.md) - Multi-factor risk assessment
- [predict_yield](./predict-yield.md) - ML-based yield forecasting

## Quick Reference

| Tool | Purpose | Use When | Cache TTL |
|------|---------|----------|-----------|
| [query_graphql](./query-graphql.md) | Raw GraphQL execution | Custom queries, power users | None |
| [get_vault_data](./get-vault-data.md) | Vault details | Analyzing 1-5 vaults | 15 min |
| [get_user_portfolio](./user-portfolio.md) | Portfolio overview | User position tracking | 5 min |
| [search_vaults](./search-vaults.md) | Vault discovery | Finding vaults by criteria | 10 min |
| [get_vault_performance](./vault-performance.md) | Historical analysis | Performance tracking | 30 min |
| [get_transactions](./get-transactions.md) | Transaction history | Activity analysis | 15 min |
| [compare_vaults](./compare-vaults.md) | Comparison analysis | Evaluating options | 15 min |
| [get_price_history](./price-history.md) | Price trends | Price analysis | 30 min |
| [export_data](./export-data.md) | Data export | External analysis | None |
| [analyze_risk](./analyze-risk.md) | Risk assessment | Due diligence | 15 min |
| [predict_yield](./predict-yield.md) | Yield forecasting | Future planning | 60 min |

## Tool Selection Guide

### "I want to..."

**...analyze a specific vault**
→ Use [get_vault_data](./get-vault-data.md) for current state
→ Use [get_vault_performance](./vault-performance.md) for history
→ Use [analyze_risk](./analyze-risk.md) for risk profile

**...find vaults matching criteria**
→ Use [search_vaults](./search-vaults.md) for filtering
→ Use [compare_vaults](./compare-vaults.md) to compare results

**...track my investments**
→ Use [get_user_portfolio](./user-portfolio.md) for overview
→ Use [get_transactions](./get-transactions.md) for activity

**...make investment decisions**
→ Use [compare_vaults](./compare-vaults.md) for comparison
→ Use [analyze_risk](./analyze-risk.md) for risk assessment
→ Use [predict_yield](./predict-yield.md) for forecasting

**...export data for analysis**
→ Use [export_data](./export-data.md) for CSV/JSON
→ Combine with other tools for specific datasets

**...do something custom**
→ Use [query_graphql](./query-graphql.md) for full flexibility

## Common Workflows

### Portfolio Analysis
```
1. get_user_portfolio - Get overview of all positions
2. get_vault_data - Deep dive into specific vaults
3. analyze_risk - Assess risk exposure
4. export_data - Export for spreadsheet analysis
```

### Vault Research
```
1. search_vaults - Find candidates by criteria
2. compare_vaults - Compare top candidates
3. get_vault_performance - Check historical performance
4. analyze_risk - Evaluate risk factors
```

### Performance Monitoring
```
1. get_vault_data - Current vault state
2. get_vault_performance - Historical trends
3. get_price_history - Price movements
4. get_transactions - Recent activity
```

### Yield Optimization
```
1. get_user_portfolio - Current positions
2. predict_yield - Forecast returns
3. search_vaults - Find better opportunities
4. compare_vaults - Evaluate alternatives
```

## Performance Characteristics

### Cache Strategy
Tools use intelligent caching based on data volatility:
- **No cache**: Raw queries, exports (unpredictable)
- **5 min**: Portfolio data (dynamic)
- **10-15 min**: Vault data, transactions (moderate)
- **30-60 min**: Historical data, predictions (stable)

### Token Cost Estimates
- **Simple**: 200-400 tokens (exports, basic queries)
- **Medium**: 400-600 tokens (vault data, portfolio, search)
- **Complex**: 600-800 tokens (comparisons, risk analysis, predictions)

### Response Times
- **Cached**: <100ms
- **Fresh**: 500-2000ms (depends on backend)
- **Large datasets**: 2-5s (pagination recommended)

## See Also

- [GraphQL Schema Resource](../resources/graphql-schema.md) - Complete schema reference
- [DeFi Glossary Resource](../resources/defi-glossary.md) - Terminology guide
- [Financial Analysis Prompt](../prompts/financial-analysis.md) - Analysis guidance
- [Development Guide](../DEVELOPMENT.md) - Contributing and extending tools
