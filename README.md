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

### Installation (will be updated after publishing)

```bash
# Install globally
npm install -g @hopperlabsxyz/lagoon-mcp

# Or install locally
npm install @hopperlabsxyz/lagoon-mcp
```

### Configuration

#### Supported Platforms

| Platform | Status | Config Format | Documentation |
|----------|--------|---------------|---------------|
| **Claude Desktop** | ✅ Available Now | JSON | [↓ See below](#claude-desktop) |
| **Claude Code (CLI)** | ✅ Available Now | JSON | [↓ See below](#claude-code-cli) |
| **OpenAI Agents SDK** | ✅ Available Now | YAML | [↓ See below](#openai-agents-sdk) |
| **ChatGPT Desktop** | ⏳ Coming Soon | JSON (expected) | [↓ See below](#chatgpt-desktop) |
| **Grok** | ❌ Not Supported | N/A | No native MCP support |

---

#### Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

**Local development**:
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

---

#### Claude Code (CLI)

**Configuration file**: `~/.claude.json` (project-based configuration)

Claude Code CLI uses a project-scoped configuration system. You can configure MCP servers in two ways:

##### Option 1: Project-Specific Configuration (~/.claude.json)

Edit your `~/.claude.json` file and add lagoon-mcp to your project:

**For production use** (after `npm install -g @hopperlabsxyz/lagoon-mcp`):

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "lagoon": {
          "type": "stdio",
          "command": "lagoon-mcp",
          "env": {
            "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query"
          }
        }
      }
    }
  }
}
```

**For local development**:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "lagoon": {
          "type": "stdio",
          "command": "node",
          "args": ["/absolute/path/to/lagoon-mcp/dist/index.js"],
          "env": {
            "LAGOON_GRAPHQL_URL": "http://localhost:3000/query"
          }
        }
      }
    }
  }
}
```

##### Option 2: Team Collaboration (.mcp.json)

Create a `.mcp.json` file in your project root for team-wide configuration:

```json
{
  "mcpServers": {
    "lagoon": {
      "type": "stdio",
      "command": "lagoon-mcp",
      "env": {
        "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query"
      }
    }
  }
}
```

This file can be committed to version control for consistent team setup.

**After configuration**: Restart Claude Code and use `/mcp` command to verify lagoon appears in the server list.

**Note**: Claude Code CLI uses different config files than Claude Desktop. See [FAQ](#faq) for details.

---

#### OpenAI Agents SDK

For developers using the [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/guides/mcp/), create `mcp_agent.config.yaml`:

```yaml
$schema: "https://raw.githubusercontent.com/lastmile-ai/mcp-agent/main/schema/mcp-agent.config.schema.json"
mcp:
  servers:
    lagoon:
      command: "lagoon-mcp"
      env:
        LAGOON_GRAPHQL_URL: "https://api.lagoon.finance/query"
```

**Python SDK Usage**:
```python
from agents.mcp import MCPServerStdio

lagoon_server = MCPServerStdio(
    params={
        "command": "lagoon-mcp",
        "env": {
            "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query"
        }
    },
    name="lagoon"
)
```

**TypeScript SDK Usage**:
```typescript
import { MCPServerStdio } from '@openai/openai-agents-mcp';

const lagoonServer = new MCPServerStdio({
  command: 'lagoon-mcp',
  env: {
    LAGOON_GRAPHQL_URL: 'https://api.lagoon.finance/query'
  }
});
```

**Note**: This is for API developers building custom applications, not end-user desktop usage.

---

#### ChatGPT Desktop

**Status**: MCP support for ChatGPT Desktop is currently in development and expected "in the coming months" per OpenAI.

**Availability**:
- ⏳ Desktop app with MCP: Not yet released
- ⏳ Enterprise/Team: Limited beta access only
- ❌ Individual ChatGPT Plus: Not available yet

**Expected Configuration** (once available):

Configuration file location will likely follow a similar pattern to Claude Desktop (exact location TBD).

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

**Technical Note**: The lagoon-mcp server is already compatible with ChatGPT's MCP implementation (uses standard MCP protocol and stdio transport). No code changes will be needed once ChatGPT Desktop launches with MCP support

### Usage

Restart Claude Desktop and start asking questions:

```
"Show me my portfolio for wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

"Find all USDC vaults on Arbitrum with more than $1M TVL"

"How has the lgUSDC vault on Arbitrum performed over the last 30 days?"

"What are the top 5 vaults by TVL across all chains?"
```

## ⚠️ Important Legal Disclaimer

**THIS TOOL PROVIDES INFORMATIONAL CONTENT ONLY - NOT FINANCIAL ADVICE**

Lagoon MCP is a data analysis tool that provides information about DeFi vaults. **All analysis outputs are for educational and informational purposes only** and should NOT be interpreted as:

- Financial, investment, legal, or tax advice
- Recommendations to buy, sell, hold, or trade any asset
- Guarantees of future performance or returns
- Professional financial guidance

### Your Responsibilities

Before making ANY investment decisions:

1. **Conduct Independent Research**: Verify all data independently
2. **Consult Professionals**: Seek advice from qualified financial, legal, and tax advisors
3. **Understand Risks**: DeFi and cryptocurrency investments carry substantial risks including:
   - Complete loss of invested capital
   - Smart contract vulnerabilities
   - Market volatility and illiquidity
   - Regulatory uncertainty
4. **Invest Responsibly**: Only invest what you can afford to lose completely

### No Warranties or Guarantees

We provide this software "AS IS" without warranties of any kind. We:
- Make no guarantees about data accuracy, completeness, or timeliness
- Accept no liability for investment losses or damages
- Do not endorse any specific vaults, protocols, or strategies
- Disclaim all responsibility for third-party platform performance

**Past performance does not predict future results.** Market conditions change rapidly.

---

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
| **compare_vaults** | Side-by-side vault comparison with 12-factor risk analysis and rankings | [→ Details](./docs/tools/compare-vaults.md) |
| **optimize_portfolio** | Modern Portfolio Theory optimization with yield sustainability warnings | [→ Details](./docs/tools/optimize-portfolio.md) |
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

Prompts are self-explanatory templates invoked by name. See [Prompt Guidelines](./docs/prompts/README.md) for usage patterns.

| Prompt | Description |
|--------|-------------|
| **financial-analysis** | Guidance for analyzing DeFi vault data and generating financial insights with risk assessment frameworks |
| **curator-performance** | Comprehensive framework for evaluating curator performance, reputation, and vault management capabilities |
| **competitor-comparison** | Objective comparison of Lagoon Protocol against major competitors with data-driven analysis |
| **onboarding-first-vault** | Structured guidance for new users making their first vault deposit with risk profile assessment |
| **protocol-overview** | Real-time protocol health insights and KPI dashboard tracking TVL, growth, and ecosystem health |
| **portfolio-optimization** | AI-powered portfolio optimization based on modern portfolio theory with systematic rebalancing |

**Usage**: Invoke prompts by name in Claude (e.g., "Use the financial-analysis prompt to evaluate this vault")

**See also**: [Disclaimer Standards](./docs/prompts/DISCLAIMER_STANDARDS.md)

## Development

For development setup, testing, and contributing guidelines, see [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

### Quick Start

```bash
# Clone and setup
git clone https://github.com/hopperlabsxyz/lagoon-mcp.git
cd lagoon-mcp
npm install

# Generate types from GraphQL schema
npm run codegen

# Build the project
npm run build

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

**Q: Does this work with ChatGPT?**  
A: Not yet for end users. ChatGPT Desktop MCP support is "coming in the coming months" per OpenAI. Currently available for API developers via OpenAI Agents SDK (YAML config format). See the [ChatGPT Desktop section](#chatgpt-desktop) above.

**Q: Does this work with Grok?**  
A: No. xAI has not announced native MCP support for Grok, and there is no Grok desktop app with MCP capabilities. We recommend using Claude Desktop or waiting for ChatGPT Desktop MCP support.

**Q: Do I need to modify the code for different platforms?**  
A: No! The lagoon-mcp server is already compatible with all MCP clients (uses standard MCP protocol and stdio transport). Only configuration format differs between platforms.

**Q: What's the difference between Claude Desktop and Claude Code CLI configuration?**
A: They use different config files:
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) - single global config
- **Claude Code CLI**: `~/.claude.json` (project-based) or `.mcp.json` (team sharing)
Make sure to edit the correct file for your platform!

**Q: Can I use this with other Claude clients?**
A: Yes! The MCP protocol is standard. Any MCP-compatible client should work (e.g., Cline, Cursor IDE)

**Q: Is there a rate limit?**
A: No rate limiting in MCP. Backend GraphQL API is public with no auth.

**Q: Can I add custom tools?**
A: Yes! Fork the repo, add your tool in `src/tools/`, and register in `src/tools/index.ts`.

**Q: How do I update to a new version?**
A: Run `npm update -g @hopperlabsxyz/lagoon-mcp` and restart Claude Desktop.

**Q: Does this work with all chains?**
A: Yes! Supports all chains available in the Lagoon backend (12+ networks).

## License

MIT License - see [LICENSE](./LICENSE) for details

## Support

- **Issues**: [GitHub Issues](https://github.com/hopperlabsxyz/lagoon-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hopperlabsxyz/lagoon-mcp/discussions)
- **Documentation**: [Tool Docs](./docs/tools/) | [Development Guide](./docs/DEVELOPMENT.md)

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Anthropic Claude](https://claude.ai)
- GraphQL backend by [Lagoon Team](https://github.com/hopperlabsxyz/backend)

---

**Made with ❤️ for the Lagoon DeFi community**
