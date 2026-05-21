/**
 * Smoke test for every MCP tool against https://api.lagoon.finance/query.
 *
 * Imports each tool's factory directly, builds a real ServiceContainer
 * (production GraphQL client + in-memory cache + invalidator), invokes the
 * tool, and reports pass/fail + a short response excerpt. NOT a test suite
 * — this is the end-to-end "does it work against the live backend?" gate.
 *
 * Run with: tsx scripts/smoke-test-all-tools.ts
 */

import { graphqlClient } from '../src/graphql/client.js';
import { createContainer } from '../src/core/container.js';
import { createNodeCacheAdapter } from '../src/core/cache-adapter.js';
import { config } from '../src/config.js';

import { createExecuteGetGlobalTvl } from '../src/tools/get-global-tvl.js';
import { createExecuteGetIndexingStatus } from '../src/tools/get-indexing-status.js';
import { createExecuteListChains } from '../src/tools/list-chains.js';
import { createExecuteListCurators } from '../src/tools/list-curators.js';
import { createExecuteGetCurator } from '../src/tools/get-curator.js';
import { createExecuteGetAsset } from '../src/tools/get-asset.js';
import { createExecuteGetHistoricalState } from '../src/tools/get-historical-state.js';
import { createExecuteGetVaultData } from '../src/tools/vault-data.js';
import { createExecuteGetUserPortfolio } from '../src/tools/user-portfolio.js';
import { createExecuteSearchVaults } from '../src/tools/search-vaults.js';
import { createExecuteGetVaultPerformance } from '../src/tools/vault-performance.js';
import { createExecuteGetTransactions } from '../src/tools/get-transactions.js';
import { createExecuteCompareVaults } from '../src/tools/compare-vaults.js';
import { createExecuteGetPriceHistory } from '../src/tools/get-price-history.js';
import { createExecuteAnalyzeRisk, createExecuteAnalyzeRisks } from '../src/tools/analyze-risk.js';
import { createExecutePredictYield } from '../src/tools/predict-yield.js';
import { createExecuteOptimizePortfolio } from '../src/tools/optimize-portfolio.js';
import { createExecuteSimulateVault } from '../src/tools/simulate-vault.js';
import { createExecuteGetVaultComposition } from '../src/tools/vault-composition.js';
import { createExecuteExportData } from '../src/tools/export-data.js';
import { createExecuteQueryGraphQL } from '../src/tools/query-graphql.js';
import { createExecuteDiscoverTools } from '../src/tools/discover-tools.js';

// Vaults confirmed live during planning: top 2 visible on Ethereum.
const VAULT = '0x936facdf10c8c36294e7b9d28345255539d81bc7'; // RockSolid rETH
const VAULT2 = '0xb09f761cb13baca8ec087ac476647361b6314f98'; // 2nd by TVL
const CHAIN = 1;
const USDC_ETH = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const CURATOR_ID = '1212-capital';
// Use a well-known address; the tool just returns positions if any (otherwise empty array).
const SAMPLE_USER = '0x0000000000000000000000000000000000000001';

const cacheAdapter = createNodeCacheAdapter({
  stdTTL: config.cache.stdTTL,
  checkperiod: config.cache.checkperiod,
  maxKeys: config.cache.maxKeys,
});
const container = createContainer(graphqlClient, cacheAdapter, config);

type ToolResult = { content: Array<{ type: string; text?: string }>; isError?: boolean };

interface SmokeResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  note: string;
  durationMs: number;
}

async function runOne(
  name: string,
  exec: () => Promise<ToolResult>,
  expect: (r: ToolResult) => { ok: boolean; note: string }
): Promise<SmokeResult> {
  const t0 = Date.now();
  try {
    const result = await exec();
    const { ok, note } = expect(result);
    return {
      name,
      status: ok ? 'PASS' : 'WARN',
      note,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      name,
      status: 'FAIL',
      note: `threw: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - t0,
    };
  }
}

function textOf(r: ToolResult): string {
  return (r.content?.[0]?.text ?? '') as string;
}

// Same disclaimer-marker set as tests/helpers/json-parser.ts — disclaimers
// vary in shape across tools (full, compact, warning emoji, minimal).
const DISCLAIMER_MARKERS = [
  '\n\n---\n',
  '\n---\n',
  '\n\n⚠️',
  '\n⚠️',
  '\n\n*Disclaimer:',
  '\n*Disclaimer:',
];

function parseJsonPart(r: ToolResult): unknown {
  const t = textOf(r);
  let json = t;
  for (const marker of DISCLAIMER_MARKERS) {
    const idx = t.indexOf(marker);
    if (idx !== -1) {
      json = t.slice(0, idx);
      break;
    }
  }
  json = json.trim();
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const results: SmokeResult[] = [];

  // ---- 7 new discovery tools ----

  results.push(
    await runOne(
      'get_global_tvl',
      () => createExecuteGetGlobalTvl(container)({}),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as { totalValueLockedUsd?: number } | null;
        const v = body?.totalValueLockedUsd;
        return {
          ok: typeof v === 'number' && v > 0,
          note: `TVL = $${(v ?? 0).toLocaleString()}`,
        };
      }
    )
  );

  results.push(
    await runOne(
      'get_indexing_status (all chains)',
      () => createExecuteGetIndexingStatus(container)({}),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as { lastIndexedBlocks?: Array<{ chainId: number }> } | null;
        const n = body?.lastIndexedBlocks?.length ?? 0;
        return { ok: n > 0, note: `${n} chains reporting` };
      }
    )
  );

  results.push(
    await runOne(
      'list_chains',
      () => createExecuteListChains(container)({}),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as { items?: Array<{ name: string }> } | null;
        const n = body?.items?.length ?? 0;
        return { ok: n > 0, note: `${n} chains, first = ${body?.items?.[0]?.name ?? '?'}` };
      }
    )
  );

  results.push(
    await runOne(
      'list_curators',
      () => createExecuteListCurators(container)({}),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as { items?: Array<{ name: string }> } | null;
        const n = body?.items?.length ?? 0;
        return { ok: n > 0, note: `${n} curators, first = ${body?.items?.[0]?.name ?? '?'}` };
      }
    )
  );

  results.push(
    await runOne(
      `get_curator (${CURATOR_ID})`,
      () => createExecuteGetCurator(container)({ curatorId: CURATOR_ID }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as { curator?: { name: string } } | null;
        const name = body?.curator?.name;
        return { ok: typeof name === 'string', note: `name = ${name ?? '(none)'}` };
      }
    )
  );

  results.push(
    await runOne(
      'get_curator (unknown ID — clean error path)',
      () => createExecuteGetCurator(container)({ curatorId: 'definitely-not-a-real-curator' }),
      (r) => {
        const t = textOf(r);
        return {
          ok: !r.isError && t.includes('Curator not found:'),
          note: t.slice(0, 80),
        };
      }
    )
  );

  results.push(
    await runOne(
      `get_asset (USDC on Ethereum)`,
      () => createExecuteGetAsset(container)({ assetAddress: USDC_ETH, chainId: 1 }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as {
          assetByAddress?: { symbol: string; decimals: number };
        } | null;
        const sym = body?.assetByAddress?.symbol;
        return {
          ok: sym === 'USDC',
          note: `symbol=${sym}, decimals=${body?.assetByAddress?.decimals}`,
        };
      }
    )
  );

  const yesterday = Math.floor(Date.now() / 1000) - 86_400;
  results.push(
    await runOne(
      `get_historical_state (1 day ago)`,
      () =>
        createExecuteGetHistoricalState(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          timestamp: yesterday,
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as {
          vaultByAddress?: { stateAt?: { pricePerShareUsd?: number; state?: string } };
        } | null;
        const pps = body?.vaultByAddress?.stateAt?.pricePerShareUsd;
        return {
          ok: typeof pps === 'number' && pps > 0,
          note: `PPS USD = ${pps?.toFixed(4)}, state = ${body?.vaultByAddress?.stateAt?.state}`,
        };
      }
    )
  );

  // ---- Modified existing tools (composition / APR / risk paths) ----

  results.push(
    await runOne(
      `get_vault_composition (typed, ${VAULT})`,
      () =>
        createExecuteGetVaultComposition(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          responseFormat: 'summary',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as {
          analysis?: {
            protocolCount: number;
            hhi: number;
            diversificationLevel: string;
            topProtocol?: { protocol: string };
          };
        } | null;
        const a = body?.analysis;
        return {
          ok: !!a && a.protocolCount > 0 && a.hhi > 0,
          note: `${a?.protocolCount} protocols, HHI=${a?.hhi}, level=${a?.diversificationLevel}, top=${a?.topProtocol?.protocol}`,
        };
      }
    )
  );

  results.push(
    await runOne(
      `get_vault_data (extended fragment, ${VAULT})`,
      () => createExecuteGetVaultData(container)({ vaultAddress: VAULT, chainId: CHAIN }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as {
          vaultByAddress?: {
            inception?: number | null;
            state?: {
              version?: string;
              entryRate?: number;
              exitRate?: number;
              haircutRate?: number;
              isPaused?: boolean;
              accessMode?: string | null;
              totalAssetsExpiration?: string;
            };
          };
        } | null;
        const v = body?.vaultByAddress;
        const s = v?.state;
        return {
          ok:
            !!s &&
            typeof s.version === 'string' &&
            typeof s.isPaused === 'boolean' &&
            'entryRate' in s,
          note: `version=${s?.version}, inception=${v?.inception}, accessMode=${s?.accessMode}, isPaused=${s?.isPaused}, entry/exit/haircut bps = ${s?.entryRate}/${s?.exitRate}/${s?.haircutRate}`,
        };
      }
    )
  );

  results.push(
    await runOne(
      `compare_vaults (rankBy=sustainableApr)`,
      () =>
        createExecuteCompareVaults(container)({
          vaultAddresses: [VAULT, VAULT2],
          chainId: CHAIN,
          responseFormat: 'summary',
          rankBy: 'sustainableApr',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const t = textOf(r);
        return {
          ok: t.includes('Vault Comparison Results') || t.includes('Vaults Analyzed'),
          note: t.slice(0, 100),
        };
      }
    )
  );

  results.push(
    await runOne(
      `analyze_risk (operational signals + trading costs, ${VAULT})`,
      () =>
        createExecuteAnalyzeRisk(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          responseFormat: 'detailed',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const t = textOf(r);
        // RockSolid rETH has safeLocked: false → expect a safe_unlocked signal.
        const sawOps = t.includes('Operational Warnings') || t.includes('safe address');
        const sawCosts = t.includes('Trading Costs') || t.includes('entry');
        return {
          ok: t.includes('Risk Analysis'),
          note: `ops=${sawOps}, costs=${sawCosts}, len=${t.length}`,
        };
      }
    )
  );

  results.push(
    await runOne(
      `predict_yield (yieldBreakdown, ${VAULT})`,
      () =>
        createExecutePredictYield(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          timeRange: '30d',
          responseFormat: 'quick',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const t = textOf(r);
        return {
          ok: t.includes('Yield Breakdown') && t.includes('Sustainable APR'),
          note: t.includes('⚠️') ? 'breakdown + warning' : 'breakdown, no warning',
        };
      }
    )
  );

  // ---- Existing tools (regression check — fragment extension shouldn't break them) ----

  results.push(
    await runOne(
      `search_vaults (top 3 by TVL)`,
      () =>
        createExecuteSearchVaults(container)({
          filters: { isVisible_eq: true },
          pagination: { first: 3, skip: 0 },
          orderBy: 'totalAssetsUsd',
          orderDirection: 'desc',
          responseFormat: 'list',
          maxResults: 3,
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        const body = parseJsonPart(r) as { vaults?: { items?: unknown[] } } | null;
        const n = body?.vaults?.items?.length ?? 0;
        return { ok: n === 3, note: `${n} vaults returned` };
      }
    )
  );

  results.push(
    await runOne(
      `get_vault_performance (${VAULT}, 30d)`,
      () =>
        createExecuteGetVaultPerformance(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          timeRange: '30d',
          includeSDKCalculations: false,
          responseFormat: 'summary',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 100, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `get_transactions (${VAULT}, 5 latest)`,
      () =>
        createExecuteGetTransactions(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          pagination: { first: 5, skip: 0 },
          orderBy: 'timestamp',
          orderDirection: 'desc',
          responseFormat: 'list',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 50, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `get_price_history (${VAULT}, 30d)`,
      () =>
        createExecuteGetPriceHistory(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          timeRange: '30d',
          responseFormat: 'summary',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 100, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `get_user_portfolio (sample user, may be empty)`,
      () =>
        createExecuteGetUserPortfolio(container)({
          userAddress: SAMPLE_USER,
          responseFormat: 'list',
        }),
      (r) => {
        const t = textOf(r);
        // Two acceptable outcomes: (a) successful portfolio JSON, (b) the
        // graceful "No portfolio data found" message for a user with no
        // positions. The sample address 0x0...0001 hits (b) — we want to
        // confirm the address is echoed cleanly, NOT stringified as
        // "[object Object]" (the bug fixed in this commit).
        if (t.includes('No portfolio data found for user:')) {
          const ok = t.includes(SAMPLE_USER) && !t.includes('[object Object]');
          return { ok, note: `empty (graceful) — user echo: ${ok ? 'clean' : 'BROKEN'}` };
        }
        if (r.isError) return { ok: false, note: t.slice(0, 120) };
        return { ok: true, note: `${t.length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `analyze_risks (batch)`,
      () =>
        createExecuteAnalyzeRisks(container)({
          vaultAddresses: [VAULT, VAULT2],
          chainId: CHAIN,
          responseFormat: 'score',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 50, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `optimize_portfolio (sample)`,
      () =>
        createExecuteOptimizePortfolio(container)({
          vaultAddresses: [VAULT],
          chainId: CHAIN,
          currentPositions: [{ vaultAddress: VAULT, valueUsd: 10_000 }],
          strategy: 'equal_weight',
          rebalanceThreshold: 5,
          responseFormat: 'quick',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 100, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `simulate_vault (newTotalAssets bump)`,
      () =>
        createExecuteSimulateVault(container)({
          vaultAddress: VAULT,
          chainId: CHAIN,
          newTotalAssets: '10000000000000000000000',
          settleDeposit: false,
          includeAPRCalculations: false,
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 50, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `export_data (vaults JSON)`,
      () =>
        createExecuteExportData(container)({
          vaultAddresses: [VAULT],
          chainId: CHAIN,
          dataType: 'vaults',
          format: 'json',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 100, note: `${textOf(r).length} bytes` };
      }
    )
  );

  results.push(
    await runOne(
      `query_graphql (raw escape hatch)`,
      () =>
        createExecuteQueryGraphQL(container)({
          query: '{ getGlobalTVL }',
        }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).includes('getGlobalTVL'), note: textOf(r).slice(0, 80) };
      }
    )
  );

  results.push(
    await runOne(
      `discover_tools`,
      () => createExecuteDiscoverTools()({ category: 'vault', includeSchema: false }),
      (r) => {
        if (r.isError) return { ok: false, note: textOf(r).slice(0, 120) };
        return { ok: textOf(r).length > 50, note: `${textOf(r).length} bytes` };
      }
    )
  );

  // ---- Print summary ----
  console.log('\n=== Lagoon MCP — live smoke results (api.lagoon.finance/query) ===\n');
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
    console.log(`${icon}  ${r.name.padEnd(56)} ${r.durationMs}ms  · ${r.note}`);
    if (r.status === 'PASS') pass++;
    else if (r.status === 'WARN') warn++;
    else fail++;
  }
  console.log('');
  console.log(`Total: ${results.length}  ·  PASS: ${pass}  ·  WARN: ${warn}  ·  FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Smoke harness crashed:', err);
  process.exit(1);
});
