# Lagoon MCP Server

Model Context Protocol (MCP) server providing Claude Code with conversational access to Lagoon DeFi vault analytics.

## Overview

Lagoon MCP enables natural language queries about DeFi vaults, user portfolios, and performance metrics through Claude Code. Query vault data, analyze portfolios, and generate financial reports without writing GraphQL manually.

**Key Features**:
- 🔍 **Vault Discovery** - Search and filter vaults by asset, chain, TVL, and more
- 📊 **Portfolio Analysis** - Cross-chain portfolio aggregation and analysis
- 📈 **Performance Tracking** - Historical metrics and trend analysis
- ⚡ **Smart Caching** - Optimized response times with intelligent caching
- 🔒 **Type-Safe** - Full TypeScript type safety from GraphQL to Claude
- 📚 **Rich Resources** - GraphQL schema introspection and DeFi terminology guide
- 🎯 **Smart Prompts** - Financial analysis guidance with best practices

## Quick Start

### Prerequisites

- Node.js ≥18.0.0
- Claude Desktop app
- Access to Lagoon backend GraphQL endpoint

### Installation

```bash
# Install globally
npm install -g @schwepps/lagoon-mcp

# Or install locally
npm install @schwepps/lagoon-mcp
```

### Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "lagoon": {
      "command": "lagoon-mcp",
      "env": {
        "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query"
      }
    }
  }
}
```

For local development:
```json
{
  "mcpServers": {
    "lagoon": {
      "command": "node",
      "args": ["/path/to/lagoon-mcp/dist/index.js"],
      "env": {
        "LAGOON_GRAPHQL_URL": "http://localhost:3000/query"
      }
    }
  }
}
```

### Usage

Restart Claude Desktop and start asking questions:

```
"Show me my portfolio for wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

"Find all USDC vaults on Arbitrum with more than $1M TVL"

"How has the lgUSDC vault on Arbitrum performed over the last 30 days?"

"What are the top 5 vaults by TVL across all chains?"
```

## Available Tools

Complete tool documentation available in [docs/tools/](./docs/tools/).

| Tool | Description | Documentation |
|------|-------------|---------------|
| **query_graphql** | Execute raw GraphQL queries for advanced use cases | [→ Details](./docs/tools/query-graphql.md) |
| **get_vault_data** | Get comprehensive vault information by address and chain | [→ Details](./docs/tools/get-vault-data.md) |
| **get_user_portfolio** | Aggregate user holdings across all supported chains | [→ Details](./docs/tools/user-portfolio.md) |
| **search_vaults** | Search and filter vaults with 20+ advanced criteria | [→ Details](./docs/tools/search-vaults.md) |
| **get_vault_performance** | Historical metrics and performance analysis | [→ Details](./docs/tools/vault-performance.md) |
| **get_transactions** | Query vault transaction history with flexible filtering | [→ Details](./docs/tools/get-transactions.md) |
| **compare_vaults** | Side-by-side vault comparison with rankings | [→ Details](./docs/tools/compare-vaults.md) |
| **get_price_history** | Historical share price data with OHLCV time-series | [→ Details](./docs/tools/price-history.md) |
| **export_data** | Export vault data in CSV/JSON format | [→ Details](./docs/tools/export-data.md) |
| **analyze_risk** | Multi-factor risk analysis with comprehensive scoring | [→ Details](./docs/tools/analyze-risk.md) |
| **predict_yield** | ML-based yield forecasting with confidence intervals | [→ Details](./docs/tools/predict-yield.md) |

**See also**: [Tool Selection Guide](./docs/tools/README.md#tool-selection-guide) | [Common Workflows](./docs/tools/README.md#common-workflows)

## Quick Examples

### Basic Vault Analysis
```
"Show me vault details for 0x1234... on Arbitrum"
→ Returns comprehensive vault data with current metrics

"How has this vault performed over the last 30 days?"
→ Returns TVL history, growth metrics, and trend analysis
```

### Portfolio Management
```
"Analyze my portfolio at 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
→ Returns cross-chain positions sorted by USD value

"What's my total exposure to USDC vaults?"
→ Aggregates all USDC positions across chains
```

### Advanced Analytics
```
"Compare these 3 vaults and tell me which has the best risk-adjusted returns"
→ Returns comparison table with rankings and metrics

"Analyze the risk profile for vault 0x1234..."
→ Returns multi-factor risk breakdown with insights

"Predict future yields for lgUSDC based on 90-day history"
→ Returns ML-based forecast with confidence intervals
```

### Data Export & Reporting
```
"Export the top 10 vaults by TVL as CSV"
→ Returns formatted CSV data for spreadsheet analysis

"Get transaction history for vault 0x1234... and export as JSON"
→ Returns structured transaction data for external tools
```

## Resources & Prompts

### Resources

- **GraphQL Schema** (`lagoon://graphql-schema`) - Complete GraphQL schema in SDL format with 24-hour caching
- **DeFi Glossary** (`lagoon://defi-glossary`) - Comprehensive terminology guide for Lagoon DeFi Protocol (500+ lines)

### Prompts

- **Financial Analysis** (`financial-analysis`) - Structured guidance for analyzing vault performance and portfolios with risk assessment frameworks

## Development

For development setup, testing, and contributing guidelines, see [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

### Quick Start

```bash
# Clone and setup
git clone https://github.com/schwepps/lagoon-mcp.git
cd lagoon-mcp
npm install

# Generate types from GraphQL schema
npm run codegen

# Run in development mode
npm run dev

# Run tests
npm test
```

### Project Structure

```
lagoon-mcp/
├── docs/
│   ├── DEVELOPMENT.md          # Development guide
│   └── tools/                  # Individual tool documentation
├── src/
│   ├── tools/                  # Tool implementations
│   ├── resources/              # MCP resources
│   ├── prompts/                # MCP prompts
│   ├── graphql/                # GraphQL client and fragments
│   ├── cache/                  # Caching layer
│   └── utils/                  # Utilities
├── tests/                      # Test suite
└── package.json
```

## Architecture

### System Flow

```
┌─────────────┐         ┌──────────────┐           ┌─────────────┐
│   Claude    │ ◄─MCP──►│  Lagoon MCP  │◄─GraphQL─►│   Backend   │
│             │         │    Server    │           │     API     │
└─────────────┘         └──────────────┘           └─────────────┘
                              │
                              │ Cache + DI
                              ▼
                        ┌──────────────┐
                        │  Container   │
                        └──────────────┘
                        │   │        │
                   Cache  Client  Services
```

### Architecture Patterns

**Hybrid Service Layer**:
- **Direct GraphQL** for simple operations (12/13 tools)
- **Service Layer** for complex multi-step operations (e.g., RiskService)
- See [ADR-001](./docs/architecture/ADR-001-service-layer.md) for decision rationale

**Dependency Injection**:
- Centralized `ServiceContainer` with GraphQL client, cache, config
- Consistent tool creation via factory functions
- Easy testing with container mocking

**Type Safety**:
- GraphQL schema → TypeScript types via `graphql-codegen`
- Runtime validation with Zod schemas
- Strict TypeScript compilation (`noImplicitAny`, `strictNullChecks`)

### Key Components

- **MCP Server**: Modern McpServer API with automatic capability management
- **GraphQL Client**: Communicates with Lagoon backend (`graphql-request`)
- **Type Generation**: Auto-generates TypeScript types (`graphql-codegen`)
- **Service Container**: Dependency injection with GraphQL client, cache, and config
- **Caching Layer**: In-memory cache with tag-based invalidation (`node-cache`)
- **Validation**: Runtime input validation (`zod`)
- **Services**: Complex operation encapsulation (e.g., `RiskService`)

### Tool Architecture

```typescript
// Simple tools use direct GraphQL
export function createExecuteGetVaultData(container: ServiceContainer) {
  return executeToolWithCache({
    container,
    query: VAULT_QUERY,
    cacheKey: (input) => `vault:${input.address}:${input.chainId}`,
    cacheTTL: 900,  // 15 minutes
    // ...
  });
}

// Complex tools use services
export function createExecuteAnalyzeRisk(container: ServiceContainer) {
  const riskService = new RiskService(container);

  return async (input) => {
    const risk = await riskService.analyze(input.address, input.chainId);
    return formatRiskOutput(risk);
  };
}
```

### Caching Strategy

**Tiered TTL System** optimized for data volatility:

| Data Type | TTL | Rationale | Cache Tag |
|-----------|-----|-----------|-----------|
| Transactions | 5 min | Frequently changing | `TRANSACTION` |
| User portfolios | 5 min | Dynamic user holdings | `PORTFOLIO` |
| Search results | 10 min | Balance freshness/performance | `VAULT` |
| Vault data | 15 min | Relatively static | `VAULT` |
| Risk analysis | 15 min | Multi-factor metrics | `RISK` |
| Performance data | 30 min | Historical, less volatile | `PERFORMANCE` |
| Yield predictions | 60 min | ML forecasts valid longer | `PREDICTION` |
| Schema | 24 hours | Rarely changes | `SCHEMA` |

**Cache Invalidation**:
- Tag-based invalidation for related data
- Automatic expiration via TTL
- Manual invalidation on data mutations

### Testing Strategy

**Multi-Layer Testing**:
- **Unit Tests**: Individual tool logic with mocked GraphQL
- **Integration Tests**: GraphQL client + real backend (optional)
- **SDK Tests**: Computation library (APR, simulation, math)
- **Coverage**: 80%+ enforced via vitest thresholds

**Performance Testing**:
- Cache hit rate monitoring (target: 60-70%)
- Response time tracking (~300-800 tokens per query)
- Concurrent request handling

### Quality Assurance

- **TypeScript**: Strict mode with comprehensive type checking
- **ESLint**: Code quality and consistency rules
- **Prettier**: Automated code formatting
- **Vitest**: Fast unit and integration testing
- **Husky**: Pre-commit hooks with optimized test execution
- **Commitlint**: Conventional commit message enforcement

### Architecture Decision Records

All major architectural decisions are documented in `docs/architecture/`:
- [ADR-001: Service Layer Pattern](./docs/architecture/ADR-001-service-layer.md) - Hybrid service layer rationale

## Troubleshooting

### Connection Errors

```
Error: Request timeout
```

**Solution**: Check `LAGOON_GRAPHQL_URL` environment variable and verify backend is running.

### GraphQL Errors

```
GraphQL Error: Vault not found
```

**Solution**: Verify vault address and chain ID are correct. Use `query_graphql` tool to test raw queries.

### Stale Cache Data

```
Data seems outdated
```

**Solution**: Cache TTLs are conservative. Restart MCP server to clear cache, or wait for TTL expiration.

### Type Errors After Schema Update

```
Type 'unknown' is not assignable to type 'Vault'
```

**Solution**: Run `npm run codegen` to regenerate types from updated schema.

## FAQ

**Q: Can I use this with other Claude clients?**
A: Currently optimized for Claude Desktop, but the MCP protocol is standard.

**Q: Is there a rate limit?**
A: No rate limiting in MCP. Backend GraphQL API is public with no auth.

**Q: Can I add custom tools?**
A: Yes! Fork the repo, add your tool in `src/tools/`, and register in `src/tools/index.ts`.

**Q: How do I update to a new version?**
A: Run `npm update -g @schwepps/lagoon-mcp` and restart Claude Desktop.

**Q: Does this work with all chains?**
A: Yes! Supports all chains available in the Lagoon backend (12+ networks).

## License

MIT License - see [LICENSE](./LICENSE) for details

## Support

- **Issues**: [GitHub Issues](https://github.com/schwepps/lagoon-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/schwepps/lagoon-mcp/discussions)
- **Documentation**: [Tool Docs](./docs/tools/) | [Development Guide](./docs/DEVELOPMENT.md)

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Anthropic Claude](https://claude.ai)
- GraphQL backend by [Lagoon Team](https://github.com/schwepps/backend)

---

**Made with ❤️ for the Lagoon DeFi community**
