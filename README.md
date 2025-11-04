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
npm install -g @yourorg/lagoon-mcp

# Or install locally
npm install @yourorg/lagoon-mcp
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

### 1. `query_graphql` ✅
Execute raw GraphQL queries for advanced use cases.

```
"Run this GraphQL query: { vaults { items { symbol } } }"
```

### 2. `get_vault_data` ✅
Get comprehensive vault information by address and chain.

```
"Get details for vault 0x1234... on Arbitrum"
```

**Note**: Returns all available vault fields. No field selection parameter - comprehensive data is always returned.

### 3. `get_user_portfolio` ✅
Aggregate user holdings across all supported chains with USD values.

```
"Show my complete portfolio"
"Analyze my DeFi positions"
```

**Note**: Automatically queries all 12+ supported chains. No chain selection parameter needed.

### 4. `search_vaults` ✅
Search and filter vaults with advanced criteria (20+ filter options).

```
"Find WETH vaults on Ethereum with TVL > $5M"
"Show me all visible vaults managed by curator X"
"Search for vaults with APR > 10% on Arbitrum"
```

**Features**: Filter by asset, chain, TVL, capacity, curator, APR, visibility, and more.

### 5. `get_vault_performance` ✅
Historical metrics and performance analysis with time-series data.

```
"Analyze vault 0x1234... performance over the last 90 days"
"Show me TVL trends for the lgUSDC vault"
"Compare performance across 7d, 30d, and 90d periods"
```

**Supported time ranges**: 7d, 30d, 90d, 1y with summary statistics

## Resources

### 1. GraphQL Schema (`lagoon://graphql-schema`)
Complete GraphQL schema in SDL format with introspection.

- **Format**: Text/Plain (SDL format)
- **Caching**: 24-hour TTL
- **Use Cases**: Query validation, type discovery, schema exploration
- **Content**: All types, queries, mutations with documentation

### 2. DeFi Glossary (`lagoon://defi-glossary`)
Comprehensive terminology guide for Lagoon DeFi Protocol.

- **Format**: Markdown
- **Content**: 500+ lines covering vault concepts, financial metrics, transactions, fees, roles, calculations
- **Sections**: Core concepts, financial metrics, operations, transaction types, risk assessment, best practices
- **Use Cases**: Understanding vault mechanics, interpreting metrics, learning DeFi terminology

## Prompts

### 1. Financial Analysis (`financial-analysis`)
Structured guidance for analyzing vault performance and portfolios.

- **Analysis Frameworks**: Portfolio analysis, performance evaluation, discovery patterns
- **Metrics Interpretation**: APR analysis, TVL trends, capacity assessment, volume patterns
- **Risk Assessment**: LOW/MEDIUM/HIGH risk categorization with specific criteria
- **Report Structure**: Executive summary, detailed findings, recommendations, risk disclosure
- **Best Practices**: Data quality, communication, calculations, risk disclosure

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/yourorg/lagoon-mcp.git
cd lagoon-mcp

# Install dependencies
npm install

# Generate types from GraphQL schema
npm run codegen

# Run in development mode
npm run dev
```

### Project Structure

```
lagoon-mcp/
├── .claude/                    # Project documentation
│   ├── PROJECT.md              # Overview and goals
│   ├── DEVELOPMENT_PLAN.md     # Implementation roadmap
│   └── BACKEND_CONTEXT.md      # GraphQL API reference
├── docs/                       # Technical documentation
│   ├── ARCHITECTURE.md         # System architecture
│   ├── TOOLS_SPECIFICATION.md  # Tool specifications
│   ├── DECISIONS.md            # Technical decisions
│   └── SETUP.md                # Development setup
├── src/                        # Source code
│   ├── index.ts                # Entry point
│   ├── server.ts               # MCP server setup
│   ├── tools/                  # Tool implementations
│   ├── resources/              # MCP resources
│   ├── prompts/                # MCP prompts
│   ├── graphql/                # GraphQL client
│   ├── cache/                  # Caching layer
│   └── utils/                  # Utilities
├── tests/                      # Test suite
└── package.json
```

### Scripts

```bash
npm run dev          # Development mode with watch
npm run build        # Compile TypeScript
npm run test         # Run test suite
npm run codegen      # Generate types from GraphQL schema
npm run lint         # Lint code
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/tools/vault-data.test.ts
```

### Type Generation

When the backend GraphQL schema changes:

```bash
# Regenerate TypeScript types
npm run codegen

# Verify types compile
npm run build

# Update tests if needed
npm test
```

## Architecture

### System Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Claude    │ ◄─MCP──►│  Lagoon MCP  │◄─GraphQL─►│  Backend   │
│    Code     │         │    Server    │         │     API     │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Cache
                              ▼
                        ┌──────────────┐
                        │  node-cache  │
                        └──────────────┘
```

### Key Components

- **MCP Server**: Modern McpServer API with automatic capability management
- **GraphQL Client**: Communicates with Lagoon backend (`graphql-request`)
- **Type Generation**: Auto-generates TypeScript types (`graphql-codegen`)
- **Caching Layer**: In-memory cache with TTL (`node-cache`)
- **Validation**: Runtime input validation (`zod`)

### Modern Implementation

Uses **McpServer API** from `@modelcontextprotocol/sdk` v1.0.0+ for:
- Automatic capability negotiation with Claude Desktop
- Clean registration patterns (`registerTool`, `registerResource`, `registerPrompt`)
- Direct Zod schema usage via `.shape` property
- Future-proof architecture for dynamic tool registration

See [`claudedocs/MCPSERVER_MIGRATION.md`](./claudedocs/MCPSERVER_MIGRATION.md) for implementation details.

### Caching Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Vault data | 15 min | Relatively static |
| User portfolios | 5 min | More dynamic |
| Search results | 10 min | Balance between freshness and performance |
| Performance data | 30 min | Historical, less time-sensitive |
| Schema | 24 hours | Rarely changes |

## Documentation

- **[PROJECT.md](./.claude/PROJECT.md)** - Project overview and goals
- **[DEVELOPMENT_PLAN.md](./.claude/DEVELOPMENT_PLAN.md)** - Phase-by-phase implementation roadmap
- **[BACKEND_CONTEXT.md](./.claude/BACKEND_CONTEXT.md)** - GraphQL API reference and schema details
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture and design patterns
- **[TOOLS_SPECIFICATION.md](./docs/TOOLS_SPECIFICATION.md)** - Detailed tool specifications
- **[DECISIONS.md](./docs/DECISIONS.md)** - Architecture Decision Records (ADRs)

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and add tests
3. Run tests: `npm test`
4. Type check: `npm run build`
5. Commit with conventional commits: `feat: add new tool`
6. Push and create PR

### Commit Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Build/tooling changes

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

## Roadmap

### Phase 1: Infrastructure ✅ COMPLETE
- ✅ Project setup and configuration
- ✅ GraphQL type generation system
- ✅ Caching layer with TTL strategy
- ✅ Validation framework (Zod schemas)
- ✅ Comprehensive documentation

### Phase 2: Core Tools ✅ COMPLETE
- ✅ `query_graphql` - Raw GraphQL query execution
- ✅ `get_vault_data` - Comprehensive vault information
- ✅ `get_user_portfolio` - Cross-chain portfolio aggregation
- ✅ Shared utilities (error handling, response formatting)
- ✅ Comprehensive test coverage (48 tests)
- ✅ Manual testing with Claude Desktop

### Phase 3: Resources & Prompts ✅ COMPLETE
- ✅ `search_vaults` - Advanced vault search and filtering with 20+ filter options
- ✅ `get_vault_performance` - Historical metrics and performance analysis
- ✅ GraphQL schema resource - Introspection-based schema access with SDL format
- ✅ DeFi glossary resource - Comprehensive terminology guide (500+ lines)
- ✅ Financial analysis prompt - Analysis guidance with best practices
- ✅ Comprehensive test coverage (91 tests)

### Phase 4: Advanced Features (FUTURE)
- [ ] Streaming responses for large datasets
- [ ] Multi-vault comparison tool
- [ ] Historical price data integration
- [ ] Export capabilities (CSV, JSON)
- [ ] Advanced analytics and reporting

## FAQ

**Q: Can I use this with other Claude clients?**
A: Currently optimized for Claude Desktop, but the MCP protocol is standard.

**Q: Is there a rate limit?**
A: No rate limiting in MCP. Backend GraphQL API is public with no auth.

**Q: Can I add custom tools?**
A: Yes! Fork the repo, add your tool in `src/tools/`, and register in `src/tools/index.ts`.

**Q: How do I update to a new version?**
A: Run `npm update -g @yourorg/lagoon-mcp` and restart Claude Desktop.

**Q: Does this work with all chains?**
A: Yes! Supports all chains available in the Lagoon backend (12+ networks).

## License

MIT License - see [LICENSE](./LICENSE) for details

## Support

- **Issues**: [GitHub Issues](https://github.com/yourorg/lagoon-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourorg/lagoon-mcp/discussions)
- **Documentation**: [Project Docs](./.claude/)

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Anthropic Claude](https://claude.ai)
- GraphQL backend by [Lagoon Team](https://github.com/yourorg/backend)

---

**Made with ❤️ for the Lagoon DeFi community**
