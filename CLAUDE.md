# Lagoon MCP

A **stdio** Model Context Protocol server exposing 16 tools for Lagoon DeFi vault analytics over a
GraphQL backend. TypeScript + ESM. See [README.md](README.md) for the tool catalog and quick start,
and @docs/agent-notes.md for the full developer reference.

## ⚠️ Critical domain rules — read before touching analytics

These have all shipped as real bugs. Get them wrong and APR / risk numbers are silently corrupt.

1. **Fees are basis points** (uint16 from GraphQL; `2000` = 20%). Divide by 100 before displaying or
   using as a percent. Affects `risk.service`, `compare-vaults`, `predict-yield`. The SDK simulator
   path expects basis points — leave it as-is.
2. **Cross-chain address reuse** — the same vault address exists on multiple chains. ALWAYS add
   `chainId_eq` to transaction and performance queries. Filtering by `vault_in` alone interleaves
   chains and produces nonsense APR (10⁶% has been observed on cbBTC).
3. **USD time-series** — build it from `TotalAssetsUpdated` events only (USD-denominated).
   `PeriodSummary.totalAssetsAtEnd` is raw wei; mixing the two corrupts the series.
4. **Prediction / performance queries** must use `VAULT_FRAGMENT` (has `decimals`, `pricePerShare`),
   never `VaultListFragment`. `responseFormat` controls output only — never which data is fetched.
5. **Money math uses `BigInt`** (wei); never floats. Serialize with `bigIntReplacer` (BigInt is not
   JSON-serializable).
6. **Octav composition is rate-limited** — fetch through `p-limit` / `rateLimitedMap` (concurrency 2).
   Fan-out tools (`compare_vaults`, `analyze_risks`, `get_user_portfolio`) MUST rate-limit.

Full write-ups with file paths: @docs/agent-notes.md

## Commands

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev (stdio, hot-reload) | `npm run dev` |
| Build | `npm run build` (`tsc` → `dist/`) |
| Typecheck (no separate script) | `npx tsc --noEmit` |
| Codegen (after backend schema change) | `npm run codegen` |
| Lint / fix | `npm run lint` / `npm run lint:fix` |
| Format / check | `npm run format` / `npm run format:check` |
| Test (watch / unit / changed-only) | `npm test` / `npm run test:unit` / `npm run test:quick` |
| Coverage (80% gate) | `npm run test:coverage` |

`npm run codegen` introspects the **live** `LAGOON_GRAPHQL_URL` and regenerates
`src/types/generated.ts` (committed — do not hand-edit). Only needed when the backend schema changes;
a fresh checkout builds without it.

## Architecture

Entry `src/index.ts` → `runServer()` in `src/server.ts`. Request flow:

```
MCP tool call → Zod validation (src/utils/validators.ts)
  → tool factory createExecute<Name>(container)   # src/tools/*.ts, registered in src/tools/registry.ts
    → simple tool: executeToolWithCache → GraphQL (src/graphql/)
    → complex tool: service (e.g. src/services/analytics/risk.service.ts)
      → node-cache (src/cache/, src/core/cache-invalidation.ts) → Lagoon GraphQL backend
```

Dependencies flow through a DI `ServiceContainer` (`src/core/container.ts`); tests use a mock container.

## Conventions (project-specific)

- **ESM with `moduleResolution: Node16`** → relative imports MUST end in `.js`
  (e.g. `import { x } from './foo.js'`).
- **Validate every tool input with Zod** in `src/utils/validators.ts`; derive the type via `z.infer<>`.
- **Tools are factories**: export `createExecute<Name>(container)` and register in
  `src/tools/registry.ts` — the single source of truth (there is no `tools/index.ts`).
- Tool names are `snake_case` (`get_vault_data`); factories are `createExecute…`.
- TypeScript is strict; **no `any`**, no floating promises (ESLint enforces both).
- Adding a tool or writing tests → follow the checklist in @docs/agent-notes.md.

## Environment

Copy `.env.example` → `.env`. **`LAGOON_GRAPHQL_URL`** is required (validated at startup; example
`http://localhost:3001/query`). Optional: `NODE_ENV`, `CACHE_TTL` (600s), `CACHE_MAX_KEYS` (1000).
Never commit `.env`.

## Parallel development (Conductor.build)

- This server speaks **stdio**, not HTTP — there are **no port collisions** across parallel worktrees,
  and the in-memory cache is per-process (isolated automatically).
- A fresh worktree needs its own `.env` (Conductor doesn't copy gitignored files) plus
  `npm install && npm run build`. `src/types/generated.ts` is committed, so build works without
  backend access.
- Run `npm run codegen` in a worktree only if the backend GraphQL schema changed — it needs a
  reachable `LAGOON_GRAPHQL_URL`.

## Scope

This file covers only what is unique to this repo. Standard engineering hygiene (clear naming, small
commits, tests before "done") is assumed and not repeated here.
