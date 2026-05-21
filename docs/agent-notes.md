# Developer Reference (agent + human)

The accurate, working reference for developing Lagoon MCP. Imported by [CLAUDE.md](../CLAUDE.md) and
linked from the tool docs. For the project overview, tool catalog, and quick start see
[README.md](../README.md); this document covers **how to work in the code** — gotchas, conventions,
testing, and adding tools.

> All file paths below are real and verified. If something here disagrees with the code, the code wins —
> fix this file.

---

## Setup

See the [README Quick Start](../README.md). In short: copy `.env.example` → `.env`, set
`LAGOON_GRAPHQL_URL`, then `npm install && npm run build`. `src/types/generated.ts` is committed, so a
fresh checkout builds without backend access. Run `npm run codegen` only after the backend GraphQL
schema changes — it introspects the live `LAGOON_GRAPHQL_URL` and regenerates that file (never edit it
by hand).

---

## Testing

- **Vitest**, tests in `tests/tools/*.test.ts` and `src/sdk/__tests__/*.test.ts`.
- `npm test` (watch) · `npm run test:unit` (CI subset) · `npm run test:quick` (changed only) ·
  `npm run test:coverage` (**80% gate** on lines/functions/branches/statements).
- **Mock-container pattern** — tools take a `ServiceContainer`, so unit tests inject a fake one and mock
  the GraphQL client:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { createExecuteGetVaultData } from '../../src/tools/vault-data';
  import { createMockContainer } from '../helpers/test-container';
  import { parseJsonWithDisclaimer } from '../helpers/json-parser';

  vi.mock('../../src/graphql/client', () => ({ graphqlClient: { request: vi.fn() } }));
  ```

  Helpers live in `tests/helpers/` (`test-container`, `json-parser`). Build complete mock responses that
  match the GraphQL schema, and **normalize fee values to basis points** (see gotcha #1).

---

## Critical domain gotchas

These caused real shipped bugs (commits `5b7a201`, `3a87f0b`, `774ea16`). Each is cheap to reintroduce.

### 1. Fees are basis points, not percentages
GraphQL returns `state.managementFee` / `performanceFee` / `protocolFee` as uint16 **basis points**
(`2000` = 20%). Divide by 100 before displaying or using in a percentage calculation.
- **v0.6+ adds three more basis-point fields**: `entryRate` (capped 200 BPS = 2%), `exitRate`
  (capped 200 BPS), `haircutRate` (capped 2000 BPS = 20%) — exposed on `VaultState`. Plus the
  staged-rate fields `upcomingManagementFee` / `upcomingPerformanceFee` (nullable; activate at
  `newRatesTimestamp` after `feeRatesCooldown` seconds). All the same basis-point rule applies.
- **Single source of truth**: use `src/utils/fee-formatting.ts`
  (`basisPointsToPercent`, `formatBasisPointsAsPercent`, `normalizeFeesToPercent`) — do NOT
  re-inline `/ 100` in new code.
- Display/calculation paths: `src/services/analytics/risk.service.ts`, `src/tools/compare-vaults.ts`,
  `src/tools/predict-yield.ts`.
- **Exception:** the SDK simulator (`@lagoon-protocol/v0-computation`) expects uint16 basis points —
  pass them through unchanged in the simulation path.
- Tests: mock fee fields as basis points.

### 2. Cross-chain vault-address reuse → always filter by `chainId`
The same vault address is deployed on multiple chains (e.g. cbBTC on Ethereum and Arbitrum). Filtering
transactions/performance by `vault_in` alone interleaves chains by timestamp and corrupts price-per-share
(10⁶% APR observed). **Always add `chainId_eq`** to transaction and performance queries.
- Queries: `src/graphql/queries/transaction.queries.ts`, `src/graphql/queries/prediction.queries.ts`,
  `src/graphql/queries/export.queries.ts`, `src/graphql/queries/search.queries.ts`.
- Consumers: `src/tools/get-transactions.ts`, `src/tools/vault-performance.ts`, `src/tools/predict-yield.ts`.

### 3. USD time-series: `TotalAssetsUpdated` only
`TotalAssetsUpdated` events carry `totalAssetsUsd` (USD). `PeriodSummary.totalAssetsAtEnd` is **raw wei**.
Mixing them in one USD-denominated series produces ~-99.99% percent-change garbage. Build the USD series
from `TotalAssetsUpdated` events only.
- See `src/tools/vault-performance.ts` and `src/graphql/queries/prediction.queries.ts`.

### 4. Prediction/performance queries need the full vault fragment
Use `VAULT_FRAGMENT` (`src/graphql/fragments/vault.fragment.ts`) — it includes `decimals`,
`asset.decimals`, and `pricePerShare`. **Do not** use `VaultListFragment`
(`src/graphql/fragments/vault-list.fragment.ts`); it omits those fields, so price-per-share math throws
and the tool falls back to "insufficient historical data."
- `responseFormat` (`score`/`summary`/`detailed`) controls **output verbosity only** — never which data
  is fetched or computed.

### 5. Money math is `BigInt`
All wei-scale math uses `BigInt` (no floats — precision loss is a correctness bug). BigInt is not
JSON-serializable: serialize with `bigIntReplacer` from `src/sdk/math-utils.ts`. Convert with the
`formatBigInt` / `parseBigInt` helpers there.

### 6. Octav composition is rate-limited
Vault composition (via `get_vault_composition`) proxies the Octav API, which has strict limits. Fetch
through the limiter in `src/utils/rate-limiter.ts` (`rateLimitedMap`, concurrency 2). Any tool that fans
out across vaults — `compare_vaults`, `analyze_risks`, `get_user_portfolio`,
`optimize_portfolio` — must rate-limit its parallel requests.

### 7. Prediction edge cases (short period / extreme APR)
`predict_yield` regression breaks on <7 days of data or extreme-APR outliers (fixed in `774ea16`). Keep
the guard: check the data-point count before regressing and fall back to EMA for short/volatile periods.
See `src/utils/yield-prediction.ts`.

### 8. `vaultComposition(walletAddress)` is deprecated (still works)
Backend schema marks this query as `@deprecated` with the message *"Use the `composition` field on
`Vault` instead. This query returns untyped raw JSON and will be removed in a future release."*
- The MCP `get_vault_composition` tool still uses it today (works fine; migration tracked separately).
- The replacement (`Vault.composition: CompositionData` with typed
  `{ compositions: [ProtocolComposition!]!, tokenCompositions: [TokenComposition!]!, totalValueInUsd: Float }`)
  has a **different shape** from the current Octav `assetByProtocols` JSONObject. A migration must
  rewrite `transformRawComposition`, `extractPositionTypes`, the HHI calc, and the test mocks in one
  shot — it's not a query swap.
- If you add a NEW composition consumer, prefer the typed `Vault.composition` field from the start.

### 9. Discovery tools (Tier 2) for thin metadata
Thin tools wrap small backend metadata endpoints so callers don't have to drop into `query_graphql`:
- `get_global_tvl` → `getGlobalTVL` (5 min cache).
- `get_indexing_status` → `_meta(chainIds)` (60s cache). **Use this BEFORE `predict_yield` /
  `analyze_risk` to detect stale chain data** — the indexer can trail head by minutes/hours on quiet
  chains, which silently corrupts USD time-series.
- `list_chains` → `chains(…)` (24h cache).
- `list_curators`, `get_curator` → `curators(…)` / `curator(id)` (15 min cache).
- `get_asset` → `assetByAddress(address, chainId)` (5 min cache; `priceUsd` ticks with the market).
- `get_historical_state` → `Vault.stateAt(timestamp)` (60 min cache). Returns the full
  `HistoricalVaultState` shape — far simpler than reconstructing state from event streams.
- All wired through `executeToolWithCache` and registered in `src/tools/registry.ts`.

---

## Adding a new tool

Tools are factories registered in one place — there is **no `src/tools/index.ts`**.

1. **Schema** — add a Zod input schema in `src/utils/validators.ts`; export `type X = z.infer<typeof xSchema>`.
   Reuse primitives (`ethereumAddressSchema`, `chainIdSchema`, `paginationFirstSchema`).
2. **Tool file** — `src/tools/my-tool.ts`, exporting a factory:

   ```ts
   export function createExecuteMyTool(container: ServiceContainer) {
     return async (input: MyToolInput): Promise<CallToolResult> => {
       // simple tool: use executeToolWithCache (src/utils/execute-tool-with-cache.ts)
       // complex tool: delegate to a service (e.g. src/services/analytics/risk.service.ts)
     };
   }
   ```

   Remember `.js` import extensions (ESM/Node16).
3. **Register** — add one entry to `TOOL_REGISTRY` in `src/tools/registry.ts`:

   ```ts
   {
     name: 'my_tool',                         // snake_case
     description: '… include use cases + token cost …',
     schema: myToolInputSchema,
     executorFactory: createExecuteMyTool,    // (container) => executor
   }
   ```

   The registry is the single source of truth — `server.ts` registers everything from it.
4. **Cache** — if cached, add a TTL/key in `src/cache/` (see conventions below).
5. **Test** — `tests/tools/my-tool.test.ts` using the mock-container pattern. Cover validation,
   cache miss→query→store, cache hit, not-found, and GraphQL-error paths.
6. **Verify** — `npx tsc --noEmit && npm run lint && npm run test:unit`.

---

## Caching & TTL conventions

- In-memory `node-cache`; config and key builders in `src/cache/`, tag-based invalidation in
  `src/core/cache-invalidation.ts`.
- Cache keys are namespaced: `vault:{address}:{chainId}`, `portfolio:{user}`,
  `perf:{address}:{chainId}:{range}`.
- **TTL by volatility:** ~5 min (portfolio, transactions) → 15 min (vaults, risk, comparison) →
  30 min (performance, prices) → 60 min (predictions) → 24 h (schema). Raw `query_graphql`,
  `export_data`, and `simulate_vault` are uncached.
- **Fragment reuse:** `search_vaults` populates the `vault:{address}:{chainId}` fragment cache; `get_vault_data`
  reads it before issuing a query — keep keys consistent so multi-step workflows stay cheap.
