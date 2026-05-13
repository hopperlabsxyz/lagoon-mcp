# Changelog

All notable changes to the Lagoon MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-04-30

### Sync with backend v0.6.0

This release aligns every query and tool with breaking schema changes shipped in
the Lagoon backend v0.6.0 release. Tools that were silently producing `NaN` /
`undefined` numerics now return correct, typed data.

#### Changed

- **Price history migrated to `Vault.stateHistory`**: `get_price_history`,
  `analyze_risk`, `optimize_portfolio`, and `export_data` (price_history) now
  consume `Vault.stateHistory.pricePerShareUsd: [{x, y}]` directly. The previous
  `totalAssetsUsd / (totalSupply / 1e18)` reconstruction from
  `TotalAssetsUpdated` events is gone — the backend removed the placeholder
  `totalSupply` field on those events, which had broken the reconstruction.
- **Transaction event coverage expanded**: `get_transactions` now selects 23
  additional `TransactionData` union variants (Deposit, Withdraw, WithdrawSync,
  RedeemRequestCanceled, FeeTaken, HaircutTaken, PreMint, AccessModeUpdated,
  AsyncOnlyActivated, BlacklistUpdated, ExternalSanctionsListUpdated,
  GuardrailsUpdated, GuardrailsStatusUpdated, MaxCapUpdated, NameUpdated,
  ProxyDeployed, SafeUpdated, SecurityCouncilUpdated, SuperOperatorUpdated,
  SymbolUpdated, SyncModeUpdated, TotalAssetsExpirationUpdated,
  WhitelistUpdated). The validator's `transactionTypes` enum reflects the same
  set.
- **Server version bumped to 0.6.0** in both `package.json` and `src/config.ts`
  (the previous mismatch where config still reported 0.4.0 is resolved).

#### Removed

- `totalSupply` field from `TotalAssetsUpdated` and `NewTotalAssetsUpdated`
  selections (backend removed it as a placeholder; querying it now 400s).
- Deprecated `PORTFOLIO_OPTIMIZATION_QUERY` (already replaced by
  `SINGLE_VAULT_OPTIMIZATION_QUERY` running in parallel; kept around for no
  reason).
- Truncation indicator in `get_price_history` output — `Vault.stateHistory`
  doesn't expose pagination, so the "More data available" line was unrealizable.

#### Deferred

- Migration from the deprecated `vaultComposition(walletAddress:)` query to the
  typed `Vault.composition: CompositionData` field. The deprecated query is
  still alive on backend v0.6.0 (commit 25f8ab9) and four consumers
  (`get_vault_composition`, `get_user_portfolio`, `compare_vaults`,
  `analyze_risk`) depend on the JSONObject shape via `transformRawComposition` /
  `calculateCompositionMetrics`. Tracked for a follow-up release.

#### Notes

- Codegen now points at `https://api.lagoon.finance/query`.
- `npm run codegen` regenerates `src/types/generated.ts` from the live v0.6.0
  schema.

## [0.1.0] - 2025-01-07

### Added

#### Core Features
- **13 MCP Tools** for comprehensive DeFi vault analytics
  - `query_graphql` - Execute raw GraphQL queries
  - `get_vault_data` - Get comprehensive vault information
  - `get_user_portfolio` - Aggregate user holdings across chains
  - `search_vaults` - Search and filter vaults with 20+ criteria
  - `get_vault_performance` - Historical metrics and performance analysis
  - `get_transactions` - Query vault transaction history with flexible filtering
  - `compare_vaults` - Side-by-side vault comparison with rankings
  - `get_price_history` - Historical share price data with OHLCV time-series
  - `export_data` - Export vault data in CSV/JSON format
  - `analyze_risk` - Multi-factor risk analysis with comprehensive scoring
  - `predict_yield` - ML-based yield forecasting with confidence intervals
  - `simulate_vault` - Simulate vault share price with APR projections
  - `optimize_portfolio` - Modern Portfolio Theory based portfolio optimization

#### MCP Resources
- **GraphQL Schema** (`lagoon://graphql-schema`) - Complete API schema with 24h caching
- **DeFi Glossary** (`lagoon://defi-glossary`) - Comprehensive 500+ line terminology guide

#### MCP Prompts
- **Financial Analysis** - Structured guidance for vault and portfolio analysis
- **Curator Performance** - Comprehensive curator evaluation framework
- **Competitor Comparison** - Objective protocol comparison framework
- **Onboarding: First Vault** - Structured guidance for new users
- **Protocol Overview** - Real-time protocol health insights and KPI dashboard
- **Portfolio Optimization** - Modern Portfolio Theory based optimization guidance

#### Architecture
- **Dependency Injection Container** with GraphQL client, cache, and config
- **Hybrid Service Layer** - Services for complex operations (e.g., RiskService)
- **Modern McpServer API** with automatic capability management
- **Type-Safe GraphQL** with codegen and fragment composition
- **Intelligent Caching** with configurable TTLs (5min-24h by cache type)
- **Cache Invalidation** with tag-based invalidation system
- **Comprehensive Testing** with 90%+ coverage target

#### Developer Experience
- **TypeScript** with strict type checking and modern ESNext features
- **Vitest** testing framework with coverage enforcement (80% threshold)
- **ESLint** + **Prettier** for code quality and formatting
- **Husky** pre-commit hooks with optimized fast test execution
- **GraphQL Codegen** for automatic type generation
- **Commitlint** for conventional commit messages
- **Comprehensive Documentation** for all 13 tools, 2 resources, and 6 prompts

### Documentation
- Complete tool documentation in `docs/tools/` (13 tools fully documented)
- Architecture decision records in `docs/architecture/` (ADR-001: Service Layer Pattern)
- Development guide with setup, testing, and contribution guidelines
- README with quick start, usage examples, and troubleshooting

### Testing
- **Unit Tests** for all 13 tools with comprehensive coverage
- **Integration Tests** for GraphQL client and backend connectivity
- **SDK Tests** for computation library (APR, simulation, math, vault utils)
- **Coverage Enforcement** enabled with 80% threshold across all metrics
- **Test Performance** optimized with `test:quick` for pre-commit hooks

### Performance
- **Smart Caching** with tiered TTL strategy (5min for transactions, 24h for schema)
- **Token Optimization** with efficient response formatting (~300-800 tokens per query)
- **Parallel Operations** with batched GraphQL requests
- **Quick Tests** for fast commit workflow (5-10x faster than full suite)

### Quality & Maintenance
- **80% Code Coverage** enforced via vitest thresholds
- **Zero Security Incidents** - No known vulnerabilities
- **Conventional Commits** enforced via commitlint
- **Automated Formatting** via lint-staged pre-commit hooks
- **Type Safety** with strict TypeScript compilation

### Fixed
- Removed unused `graphql-tag` dependency (-1MB in node_modules)
- Removed duplicate resource/prompt handler functions (-70 lines)
- Fixed README package name references (`@yourorg` → `@schwepps`)
- Removed TSConfig test file inclusion anomaly
- Optimized pre-commit hook (full suite → changed files only, 5-10x faster)

## [Unreleased]

### Planned
- Additional optimization strategies (Equal Risk Contribution, Maximum Diversification)
- Enhanced portfolio analytics with correlation heatmaps
- Real-time WebSocket support for live vault updates
- Multi-chain gas optimization recommendations
- Historical performance backtesting framework
- Curator reputation scoring system
- Advanced risk metrics (VaR, CVaR, Maximum Drawdown)
- Mobile-optimized prompt responses

---

## Version History Legend

- **Added**: New features and capabilities
- **Changed**: Changes to existing functionality
- **Deprecated**: Features marked for removal
- **Removed**: Deleted features
- **Fixed**: Bug fixes and corrections
- **Security**: Security vulnerability patches

For upgrade instructions and breaking changes, see [UPGRADING.md](./UPGRADING.md) (coming soon).

For contribution guidelines, see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) (coming soon).
