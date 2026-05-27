# Lagoon MCP Server

[![npm](https://img.shields.io/npm/v/@lagoon-protocol/lagoon-mcp)](https://www.npmjs.com/package/@lagoon-protocol/lagoon-mcp)
[![CI](https://github.com/hopperlabsxyz/lagoon-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/hopperlabsxyz/lagoon-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@lagoon-protocol/lagoon-mcp)](./LICENSE)
[![node](https://img.shields.io/node/v/@lagoon-protocol/lagoon-mcp)](https://nodejs.org)

Model Context Protocol (MCP) server providing conversational access to Lagoon DeFi vault analytics through Claude, Codex, Cursor, and any other MCP-compatible client.

## Overview

Lagoon MCP enables natural language queries about DeFi vaults, user portfolios, and performance metrics. Query vault data, analyze portfolios, and generate financial reports without writing GraphQL by hand.

**Key features**:
- Vault discovery — search and filter by asset, chain, TVL, and more
- Portfolio analysis — cross-chain aggregation with risk and performance metrics
- Performance tracking — historical metrics, OHLCV, and trend analysis
- Smart caching — tiered TTLs tuned to data volatility
- Type-safe — TypeScript types generated from the GraphQL schema
- Rich resources — schema introspection and a DeFi terminology guide
- Smart prompts — financial-analysis guidance with best practices

## Quick Install

> Prerequisites: Node.js ≥18.0.0. Pick your agent below and run the command.

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --transport stdio \
  --env LAGOON_GRAPHQL_URL=https://api.lagoon.finance/query \
  lagoon -- npx -y @lagoon-protocol/lagoon-mcp
```

Then run `/mcp` in Claude Code to confirm `lagoon` is connected.
</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add lagoon \
  --env LAGOON_GRAPHQL_URL=https://api.lagoon.finance/query \
  -- npx -y @lagoon-protocol/lagoon-mcp
```

Or edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.lagoon]
command = "npx"
args = ["-y", "@lagoon-protocol/lagoon-mcp"]
env = { LAGOON_GRAPHQL_URL = "https://api.lagoon.finance/query" }
```
</details>

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "lagoon": {
      "command": "npx",
      "args": ["-y", "@lagoon-protocol/lagoon-mcp"],
      "env": { "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query" }
    }
  }
}
```

Restart Cursor and check the MCP panel.
</details>

<details>
<summary><b>Other MCP clients</b> (Claude Desktop, Cline, Continue, OpenAI Agents SDK, …)</summary>

stdio command: `npx -y @lagoon-protocol/lagoon-mcp`
Required env: `LAGOON_GRAPHQL_URL=https://api.lagoon.finance/query`

For client-specific config snippets see [Manual configuration](#manual-configuration).
</details>

**How it works**: ① Run the command. ② Your agent registers the MCP server. ③ Ask natural-language questions — e.g. *"Find USDC vaults on Arbitrum with TVL > $1M."*

### Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `LAGOON_GRAPHQL_URL` | Recommended | `http://localhost:3001/query` | Lagoon backend GraphQL endpoint (production: `https://api.lagoon.finance/query`) |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `CACHE_TTL` | No | `600` | Default cache TTL (seconds) |
| `CACHE_MAX_KEYS` | No | `1000` | Maximum cache entries |

### Usage

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

Complete tool documentation in [docs/tools/](./docs/tools/).

| Tool | Description | Documentation |
|------|-------------|---------------|
| **discover_tools** | Search and discover available tools by category or keyword | — |
| **query_graphql** | Execute raw GraphQL queries for advanced use cases | [→ Details](./docs/tools/query-graphql.md) |
| **get_vault_data** | Get comprehensive vault information by address and chain | [→ Details](./docs/tools/get-vault-data.md) |
| **get_user_portfolio** | Aggregate user holdings across all supported chains | [→ Details](./docs/tools/user-portfolio.md) |
| **search_vaults** | Search and filter vaults with 20+ advanced criteria | [→ Details](./docs/tools/search-vaults.md) |
| **get_vault_performance** | Historical metrics and performance analysis | [→ Details](./docs/tools/vault-performance.md) |
| **get_transactions** | Query vault transaction history with flexible filtering | [→ Details](./docs/tools/get-transactions.md) |
| **compare_vaults** | Side-by-side vault comparison with normalized metrics and rankings (2–20 vaults, cross-chain) | [→ Details](./docs/tools/compare-vaults.md) |
| **get_price_history** | Historical share price data with OHLCV time-series | [→ Details](./docs/tools/price-history.md) |
| **export_data** | Export vault data, transactions, price history, or performance in CSV/JSON format | [→ Details](./docs/tools/export-data.md) |
| **analyze_risk** | Multi-factor risk analysis with comprehensive scoring | [→ Details](./docs/tools/analyze-risk.md) |
| **analyze_risks** | Batch risk analysis for 2–20 vaults in a single call (cross-chain) | — |
| **predict_yield** | ML-based yield forecasting with confidence intervals | [→ Details](./docs/tools/predict-yield.md) |
| **optimize_portfolio** | Modern Portfolio Theory optimization with yield sustainability warnings | [→ Details](./docs/tools/optimize-portfolio.md) |
| **simulate_vault** | Simulate vault behavior under different parameters for scenario analysis | [→ Details](./docs/tools/simulate-vault.md) |
| **get_vault_composition** | Typed DeFi protocol composition (Vault.composition) with HHI diversification scoring. Chain-aware (requires chainId). | — |
| **get_global_tvl** | Live total value locked across all Lagoon vaults & chains (USD) | — |
| **get_indexing_status** | Last indexed block per chain — call BEFORE analytics to detect stale data | — |
| **list_chains** | Lagoon-supported chains with chainId, factory address, wrapped native token | — |
| **list_curators** | Curator directory (name, id, description, website) | — |
| **get_curator** | Single curator lookup by id | — |
| **get_asset** | ERC20 asset metadata + current USD price | — |
| **get_historical_state** | Vault state at a specific Unix timestamp (price-per-share, fees, totalAssets, roles, guardrails) | — |

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

- **GraphQL Schema** (`lagoon://graphql-schema`) — full GraphQL schema in SDL format with 24-hour caching
- **DeFi Glossary** (`lagoon://defi-glossary`) — terminology guide for Lagoon DeFi Protocol (500+ lines)

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

Invoke prompts by name in your agent (e.g. *"Use the financial-analysis prompt to evaluate this vault"*).

**See also**: [Disclaimer Standards](./docs/prompts/DISCLAIMER_STANDARDS.md)

## Manual configuration

[Quick Install](#quick-install) covers the four most common agents. The snippets below are for clients without a `mcp add` CLI, or for users who prefer to edit config files directly.

<details>
<summary><b>Claude Desktop</b></summary>

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lagoon": {
      "command": "npx",
      "args": ["-y", "@lagoon-protocol/lagoon-mcp"],
      "env": { "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query" }
    }
  }
}
```

For local development, replace `npx -y @lagoon-protocol/lagoon-mcp` with `node /absolute/path/to/lagoon-mcp/dist/index.js`.
</details>

<details>
<summary><b>Claude Code (.mcp.json for team sharing)</b></summary>

Create `.mcp.json` in your project root and check it into version control so teammates get the same config:

```json
{
  "mcpServers": {
    "lagoon": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@lagoon-protocol/lagoon-mcp"],
      "env": { "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query" }
    }
  }
}
```
</details>

<details>
<summary><b>OpenAI Agents SDK</b></summary>

`mcp_agent.config.yaml`:

```yaml
$schema: "https://raw.githubusercontent.com/lastmile-ai/mcp-agent/main/schema/mcp-agent.config.schema.json"
mcp:
  servers:
    lagoon:
      command: "npx"
      args: ["-y", "@lagoon-protocol/lagoon-mcp"]
      env:
        LAGOON_GRAPHQL_URL: "https://api.lagoon.finance/query"
```

For Python or TypeScript SDK usage, point `MCPServerStdio` at the same `npx -y @lagoon-protocol/lagoon-mcp` command. See the [OpenAI Agents MCP guide](https://openai.github.io/openai-agents-js/guides/mcp/).
</details>

## Development

For gotchas, conventions, testing, and how to add a tool, see [docs/agent-notes.md](./docs/agent-notes.md) — the developer reference, also imported by [CLAUDE.md](./CLAUDE.md).

### Quick start

```bash
git clone https://github.com/hopperlabsxyz/lagoon-mcp.git
cd lagoon-mcp
npm install
npm run codegen    # generate types from the GraphQL schema (only after backend schema changes)
npm run build
npm run dev        # stdio, hot-reload
npm test
```

### Project structure

```
lagoon-mcp/
├── docs/
│   ├── agent-notes.md          # Developer reference (gotchas, conventions, add-a-tool)
│   └── tools/                  # Individual tool documentation
├── skills/                     # Claude Skills for enhanced interactions
├── src/
│   ├── tools/                  # Tool implementations + registry.ts
│   ├── services/               # Business-logic services (e.g. RiskService)
│   ├── resources/              # MCP resources
│   ├── prompts/                # MCP prompts
│   ├── skills/                 # Skills TypeScript API
│   ├── graphql/                # GraphQL client, queries, fragments
│   ├── sdk/                    # APR, simulation, and math utilities
│   ├── core/                   # DI container, cache adapter, invalidation
│   ├── cache/                  # Cache TTL and key definitions
│   ├── schemas/                # Zod config/env schemas
│   ├── types/                  # TypeScript + generated GraphQL types
│   └── utils/                  # Utilities
├── tests/                      # Test suite
└── package.json
```

## Architecture

### System flow

```
┌─────────────┐         ┌──────────────┐           ┌─────────────┐
│   Agent     │ ◄─MCP──►│  Lagoon MCP  │◄─GraphQL─►│   Backend   │
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

### Patterns

- **Hybrid service layer** — direct GraphQL for simple tools; service layer (e.g. `RiskService`) for complex multi-step analytics.
- **Dependency injection** — `ServiceContainer` wires GraphQL client, cache, and config; tests inject a mock container.
- **Type safety** — GraphQL schema → TS via `graphql-codegen`; runtime input validation with Zod; strict TS compilation.

### Caching strategy

Tiered TTLs optimized for data volatility:

| Data type | TTL | Rationale | Cache tag |
|-----------|-----|-----------|-----------|
| User portfolios | 5 min | Dynamic user holdings | `PORTFOLIO` |
| Search results | 10 min | Balance freshness/performance | `VAULT` |
| Transactions | 15 min | Recent activity, moderately static | `TRANSACTION` |
| Vault data | 15 min | Relatively static | `VAULT` |
| Vault composition | 15 min | Backend caches Octav data ~6h | `VAULT` |
| Risk analysis | 15 min | Multi-factor metrics | `RISK` |
| Performance data | 30 min | Historical, less volatile | `PERFORMANCE` |
| Price history | 30 min | Daily aggregates | `PERFORMANCE` |
| Yield predictions | 60 min | ML forecasts valid longer | `PREDICTION` |
| Schema | 24 hours | Rarely changes | `SCHEMA` |

Tag-based invalidation; automatic expiration via TTL; manual invalidation on data mutations.

### Testing

- **Vitest** with multi-layer coverage: unit (mocked GraphQL), integration (real backend, optional), SDK (computation library).
- **80% coverage gate** enforced via vitest thresholds.
- Cache hit-rate monitoring (target: 60–70%); ~300–800 tokens per query.

### Quality

TypeScript strict mode · ESLint · Prettier · Vitest · Husky pre-commit hooks · Commitlint conventional commits.

## Troubleshooting

**Connection errors** (`Error: Request timeout`)
→ Check `LAGOON_GRAPHQL_URL` and verify the backend is running.

**GraphQL errors** (`Vault not found`)
→ Verify vault address and chain ID. Use the `query_graphql` tool to test raw queries.

**Stale cache data**
→ Cache TTLs are conservative. Restart the MCP server to clear cache, or wait for TTL expiration.

**Type errors after schema update** (`Type 'unknown' is not assignable to type 'Vault'`)
→ Run `npm run codegen` to regenerate types from the updated schema.

## FAQ

**Which clients does this work with?**
Any MCP-compatible client. Verified with Claude Code, Claude Desktop, Codex, Cursor, and the OpenAI Agents SDK; works with other MCP clients (Cline, Continue, …) since it uses the standard stdio transport.

**Do I need to modify the code for different platforms?**
No. The server uses the standard MCP protocol over stdio. Only the per-client config syntax differs — covered in [Quick Install](#quick-install) and [Manual configuration](#manual-configuration).

**Is there a rate limit?**
No rate limiting in the MCP itself. The Lagoon GraphQL backend is public, no auth.

**Can I add custom tools?**
Yes — fork the repo, add your tool in `src/tools/`, and register it in `TOOL_REGISTRY` in `src/tools/registry.ts`. See [docs/agent-notes.md](./docs/agent-notes.md#adding-a-new-tool).

**How do I update to a new version?**
`npx -y @lagoon-protocol/lagoon-mcp` always pulls the latest published version. If you used the legacy global install, run `npm update -g @lagoon-protocol/lagoon-mcp`.

**Does this work with all chains?**
Yes — all chains available in the Lagoon backend (12+ networks).

## License

MIT — see [LICENSE](./LICENSE).

## Support

- **Issues**: [GitHub Issues](https://github.com/hopperlabsxyz/lagoon-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hopperlabsxyz/lagoon-mcp/discussions)
- **Documentation**: [Tool Docs](./docs/tools/) · [Developer Reference](./docs/agent-notes.md)
- **Release history**: [CHANGELOG.md](./CHANGELOG.md)

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Anthropic Claude](https://claude.ai)
- GraphQL backend by the [Lagoon Team](https://github.com/hopperlabsxyz/backend)

---

**Made with ❤️ for the Lagoon DeFi community**
