/**
 * get_vault_composition Tool
 *
 * Fetch a vault's DeFi protocol composition with diversification analysis.
 * Backed by the typed `Vault.composition: CompositionData` field — v0.6+
 * replacement for the retired `vaultComposition(walletAddress)` JSONObject
 * query.
 *
 * Use cases:
 * - Understanding vault DeFi protocol exposure
 * - Analyzing diversification levels via HHI score
 * - Identifying concentration risks across protocols
 * - Portfolio composition visualization
 *
 * Migration notes (vs. the deprecated query):
 * - Now requires `chainId` (the deprecated query merged chains silently,
 *   producing wrong totals for the same address on multiple chains).
 * - `repartition` is pre-computed by the backend — no client-side
 *   percentage calculation.
 * - The "Wallet" / `idleAssetsPercent` field is GONE — the typed API doesn't
 *   surface idle assets. See docs/agent-notes.md gotcha #8.
 * - `positionTypes` is GONE — per-chain protocol-position categorization
 *   isn't exposed in the typed shape.
 *
 * Response formats (for token optimization):
 * - summary: Top protocols + analysis (~100 tokens)
 * - protocols: All non-zero protocols + analysis (~200-500 tokens)
 * - full: All data including tokenCompositions (~600-1000 tokens)
 *
 * Cache strategy:
 * - 15-minute TTL aligned with vault data freshness
 * - Cache key: composition:{address}:{chainId}
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetVaultCompositionInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { CompositionData, TokenComposition } from '../graphql/fragments/index.js';
import { GET_VAULT_COMPOSITION_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import {
  calculateHHI,
  getDiversificationLevel,
  type DiversificationLevel,
} from '../utils/composition-metrics.js';

type CompositionResponseFormat = 'summary' | 'protocols' | 'full';

interface VaultCompositionResponse {
  vaultByAddress: {
    address: string;
    composition: CompositionData | null;
  } | null;
}

interface GetVaultCompositionVariables {
  address: string;
  chainId: number;
}

/**
 * One row in the analyst-friendly response shape. Largely just the
 * backend's `ProtocolComposition` re-keyed for clarity.
 */
interface ProtocolSummary {
  protocol: string;
  valueUsd: number;
  /** Percentage of total vault value (0–100). */
  percentage: number;
  logoUrl: string | null;
}

interface CompositionAnalysis {
  /** Total portfolio value in USD (from backend `totalValueInUsd`). 0 when null. */
  totalValueUsd: number;
  /** Number of distinct protocol allocations (including the "Other" bucket). */
  protocolCount: number;
  /** Highest-allocated protocol, or null when composition is empty. */
  topProtocol: ProtocolSummary | null;
  /** Herfindahl-Hirschman Index for protocol concentration (0–1, lower = more diversified). */
  hhi: number;
  /**
   * Diversification level derived from HHI. 'Unknown' is returned when the
   * vault has no composition data yet (HHI=0 here means "no data", NOT
   * "highly diversified" — risk-conscious consumers should treat 'Unknown'
   * accordingly).
   */
  diversificationLevel: DiversificationLevel;
}

interface FullCompositionData {
  vaultAddress: string;
  totalValueInUsd: number;
  protocols: ProtocolSummary[];
  tokenCompositions: TokenComposition[];
  analysis: CompositionAnalysis;
}

interface SummaryResponse {
  vaultAddress: string;
  analysis: CompositionAnalysis;
  topProtocols: ProtocolSummary[];
}

interface ProtocolsResponse {
  vaultAddress: string;
  protocols: ProtocolSummary[];
  analysis: CompositionAnalysis;
}

interface FullResponse {
  vaultAddress: string;
  totalValueInUsd: number;
  protocols: ProtocolSummary[];
  tokenCompositions: TokenComposition[];
  analysis: CompositionAnalysis;
}

type CompositionOutput = SummaryResponse | ProtocolsResponse | FullResponse;

/**
 * Transform the typed `Vault.composition` payload into the analyst-friendly
 * `FullCompositionData` shape. Returns an empty analysis (with
 * `diversificationLevel: 'Unknown'`) when composition is null/empty.
 */
function transformTypedComposition(
  composition: CompositionData | null,
  vaultAddress: string
): FullCompositionData {
  if (!composition || composition.compositions.length === 0) {
    return {
      vaultAddress,
      totalValueInUsd: composition?.totalValueInUsd ?? 0,
      protocols: [],
      tokenCompositions: composition?.tokenCompositions ?? [],
      analysis: {
        totalValueUsd: composition?.totalValueInUsd ?? 0,
        protocolCount: 0,
        topProtocol: null,
        hhi: 0,
        diversificationLevel: 'Unknown',
      },
    };
  }

  // Backend returns entries sorted by repartition desc — preserve that order.
  const protocols: ProtocolSummary[] = composition.compositions.map((p) => ({
    protocol: p.protocol,
    valueUsd: p.valueInUsd,
    percentage: p.repartition,
    logoUrl: p.logoUrl ?? null,
  }));

  const hhi = calculateHHI(composition.compositions.map((p) => p.repartition));

  return {
    vaultAddress,
    totalValueInUsd: composition.totalValueInUsd ?? 0,
    protocols,
    tokenCompositions: composition.tokenCompositions,
    analysis: {
      totalValueUsd: composition.totalValueInUsd ?? 0,
      protocolCount: protocols.length,
      topProtocol: protocols[0] ?? null,
      hhi,
      diversificationLevel: getDiversificationLevel(hhi),
    },
  };
}

function filterByFormat(
  data: FullCompositionData,
  format: CompositionResponseFormat
): CompositionOutput {
  switch (format) {
    case 'summary':
      return {
        vaultAddress: data.vaultAddress,
        analysis: data.analysis,
        topProtocols: data.protocols.slice(0, 5),
      };
    case 'protocols':
      return {
        vaultAddress: data.vaultAddress,
        protocols: data.protocols,
        analysis: data.analysis,
      };
    case 'full':
    default:
      return {
        vaultAddress: data.vaultAddress,
        totalValueInUsd: data.totalValueInUsd,
        protocols: data.protocols,
        tokenCompositions: data.tokenCompositions,
        analysis: data.analysis,
      };
  }
}

export function createExecuteGetVaultComposition(
  container: ServiceContainer
): (input: GetVaultCompositionInput) => Promise<CallToolResult> {
  return async (input: GetVaultCompositionInput): Promise<CallToolResult> => {
    const responseFormat = (input.responseFormat ?? 'summary') as CompositionResponseFormat;
    const vaultAddress = input.vaultAddress;
    const chainId = input.chainId;

    const fragmentCacheKey = cacheKeys.composition(vaultAddress, chainId);
    const cachedComposition = container.cache.get<FullCompositionData>(fragmentCacheKey);

    if (cachedComposition) {
      const filtered = filterByFormat(cachedComposition, responseFormat);
      return createSuccessResponse(filtered);
    }

    const executor = executeToolWithCache<
      GetVaultCompositionInput,
      VaultCompositionResponse,
      GetVaultCompositionVariables,
      FullCompositionData
    >({
      container,
      cacheKey: () => fragmentCacheKey,
      cacheTTL: cacheTTL.composition,
      query: GET_VAULT_COMPOSITION_QUERY,
      variables: () => ({ address: vaultAddress, chainId }),
      validateResult: (data) => {
        if (!data.vaultByAddress) {
          return {
            valid: false,
            message: `Vault not found at ${vaultAddress} on chain ${chainId}`,
            isError: false,
          };
        }
        return {
          valid: true,
          message: data.vaultByAddress.composition
            ? undefined
            : 'No composition data available for this vault (Octav has not been queried yet)',
        };
      },
      transformResult: (data) =>
        transformTypedComposition(data.vaultByAddress?.composition ?? null, vaultAddress),
      toolName: 'get_vault_composition',
    });

    container.cacheInvalidator.register(fragmentCacheKey, [CacheTag.VAULT]);

    const result = await executor(input);

    if (!result.isError && result.content[0]?.type === 'text') {
      try {
        const fullData = JSON.parse(result.content[0].text) as FullCompositionData;
        const filtered = filterByFormat(fullData, responseFormat);
        result.content[0].text = JSON.stringify(filtered, null, 2);
      } catch {
        // If parsing fails (e.g., "not found" message), leave the response
        // text as-is so the user still sees the validation message.
      }

      result.content[0].text = result.content[0].text + getToolDisclaimer('vault_composition');
    }

    return result;
  };
}
