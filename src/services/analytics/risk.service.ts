/**
 * Risk Analysis Service
 *
 * Encapsulates risk analysis business logic with dependency injection.
 * Demonstrates service layer pattern for complex multi-step operations.
 */

import { BaseService } from '../base.service.js';
import {
  VaultData,
  VaultCompositionFullResponse,
  ProtocolCompositionData,
} from '../../graphql/fragments/index.js';
import {
  RISK_ANALYSIS_QUERY,
  BATCH_RISK_ANALYSIS_QUERY,
  CROSS_CHAIN_VAULTS_QUERY,
  GET_VAULT_COMPOSITION_QUERY,
} from '../../graphql/queries/index.js';
import { analyzeRisk, RiskScoreBreakdown } from '../../utils/risk-scoring.js';
import { basisPointsToPercent } from '../../utils/fee-formatting.js';
import {
  evaluateOperationalSignals,
  operationalSignalFloor,
  riskLevelMax,
  type OperationalSignal,
} from '../../utils/operational-signals.js';

/**
 * Risk analysis input data extracted from GraphQL.
 * `priceHistory` is pre-projected to {timestamp, pricePerShareUsd} pairs and
 * already filtered for null/non-positive values; downstream code can iterate
 * without re-checking. Uses assetByProtocols from Octav API for protocol-based
 * diversification analysis.
 */
export interface RiskAnalysisData {
  vault: VaultData;
  allVaults: { items: Array<{ state: { totalAssetsUsd: number } }> };
  curatorVaults: { items: Array<{ address: string; state: { totalAssetsUsd: number } }> };
  priceHistory: Array<{ timestamp: number; pricePerShareUsd: number }>;
  // Note: Backend API returns full response with assetByProtocols for protocol analysis
  composition: VaultCompositionFullResponse | null;
}

interface RawRiskAnalysisResponse extends Pick<RiskAnalysisData, 'allVaults' | 'curatorVaults'> {
  vault:
    | (VaultData & {
        stateHistory: {
          pricePerShareUsd: Array<{ x: number; y: number | null }>;
        };
      })
    | null;
}

/**
 * Comparative risk context for benchmarking
 */
export interface ComparativeRiskContext {
  percentile: number; // 0-100, where 100 = safest (lower risk than X% of vaults)
  betterThanPercent: number; // Percentage of vaults with higher risk
  medianRisk: number; // Median risk score across all vaults
  isApproximate: boolean; // True when using TVL-based proxy instead of full risk scores
  averageRisk: number; // Average risk score across all vaults
  isOutlier: boolean; // True if in top 5% or bottom 5%
  riskRanking: string; // Description like "Safer than 75% of vaults"
}

/**
 * Cost-of-trade summary surfaced alongside the weighted risk score.
 * Transactional fees (entry/exit/haircut) belong here rather than in
 * `calculateFeeRisk()` because that function models annualized drag, not
 * one-shot deposit/redeem cost.
 *
 * All percentages have already been converted from basis points via
 * `basisPointsToPercent` in `src/utils/fee-formatting.ts`.
 */
export interface TradingCosts {
  entryPct: number;
  exitPct: number;
  /** Applied only on syncRedeem, after the exit fee. Burned shares. */
  haircutPct: number;
  upcomingManagementPct: number | null;
  upcomingPerformancePct: number | null;
  /** Cooldown between rate update and enforcement, in seconds (BigInt string). */
  feeRatesCooldownSeconds: string | null;
  /** Unix timestamp at which the upcoming rates take effect (BigInt string). */
  newRatesActivateAt: string | null;
}

/**
 * Extended risk score breakdown with comparative context, operational
 * signals (v0.6+), and trading-cost summary.
 *
 * `operationalSignals` and `effectiveRiskLevel` do NOT modify
 * `overallRisk` (the numeric weighted score). They can only raise
 * `effectiveRiskLevel` ABOVE `riskLevel` (the bucket derived from the score),
 * never lower it. See `src/utils/operational-signals.ts` for the rules.
 */
export interface ExtendedRiskScoreBreakdown extends RiskScoreBreakdown {
  comparative?: ComparativeRiskContext;
  operationalSignals?: OperationalSignal[];
  effectiveRiskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  tradingCosts?: TradingCosts;
}

/**
 * Batch risk analysis response from GraphQL
 */
export interface BatchRiskAnalysisResponse {
  vaults: { items: VaultData[] };
  allVaults: { items: Array<{ state: { totalAssetsUsd: number } }> };
}

/**
 * Result for a single vault in batch analysis
 */
export interface BatchVaultRiskResult {
  address: string;
  chainId: number;
  name: string;
  riskScore: number;
  riskLevel: string;
  factors: Array<{
    name: string;
    score: number;
    level: string;
  }>;
  breakdown: ExtendedRiskScoreBreakdown;
}

/**
 * Complete batch analysis result
 */
export interface BatchRiskAnalysisResult {
  vaults: BatchVaultRiskResult[];
  summary: {
    lowestRisk: { address: string; score: number } | null;
    highestRisk: { address: string; score: number } | null;
    averageScore: number;
    vaultCount: number;
  };
}

/**
 * Structured risk data for UI block rendering (single vault)
 * Contains pre-formatted fields for direct frontend consumption
 */
export interface StructuredRiskData {
  address: string;
  chainId: number;
  name: string;
  overallRisk: {
    score: number; // 0-1 decimal
    scoreFormatted: string; // "45.2%"
    level: 'low' | 'medium' | 'high' | 'critical';
  };
  topRisks: Array<{
    name: string;
    score: number;
    scoreFormatted: string;
    level: 'low' | 'medium' | 'high' | 'critical';
  }>;
  allFactors: Record<
    string,
    {
      score: number;
      scoreFormatted: string;
      level: 'low' | 'medium' | 'high' | 'critical';
    }
  >;
  comparative?: {
    percentile: number;
    ranking: string;
    isOutlier: boolean;
  };
  dataQuality: 'high' | 'medium' | 'low';
  // v0.6+ additions — see ExtendedRiskScoreBreakdown for semantics.
  operationalSignals?: OperationalSignal[];
  effectiveRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  tradingCosts?: TradingCosts;
}

/**
 * Structured batch risk data for UI block rendering
 * Contains summary and array of vault risk data
 */
export interface StructuredBatchRiskData {
  summary: {
    vaultCount: number;
    averageScore: number;
    averageScoreFormatted: string;
    lowestRisk: { address: string; score: number; scoreFormatted: string } | null;
    highestRisk: { address: string; score: number; scoreFormatted: string } | null;
  };
  vaults: StructuredRiskData[];
}

/**
 * Render the "Operational warnings" markdown section. Returns an empty
 * string when no signals are present so consumers can concatenate safely.
 * Signals are listed in severity order (Critical > High > Medium), with
 * stable secondary order matching the evaluator's encounter order.
 */
function renderOperationalWarnings(signals: OperationalSignal[] | undefined): string {
  if (!signals || signals.length === 0) return '';
  const severityEmoji: Record<'Critical' | 'High' | 'Medium', string> = {
    Critical: '🔴',
    High: '🟠',
    Medium: '🟡',
  };
  const severityRank: Record<'Critical' | 'High' | 'Medium', number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
  };
  const sorted = [...signals].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const lines = sorted.map((s) => `- ${severityEmoji[s.severity]} **${s.severity}**: ${s.message}`);
  return `### ⚠️ Operational Warnings\n\n${lines.join('\n')}\n\n`;
}

/**
 * Render the "Trading costs" markdown one-liner. Returns empty string when
 * no costs are configured (all zero / null).
 */
function renderTradingCosts(costs: TradingCosts | undefined): string {
  if (!costs) return '';
  const hasAnyFee = costs.entryPct > 0 || costs.exitPct > 0 || costs.haircutPct > 0;
  const hasUpcoming = costs.upcomingManagementPct !== null || costs.upcomingPerformancePct !== null;
  if (!hasAnyFee && !hasUpcoming) return '';

  const parts: string[] = [];
  if (costs.entryPct > 0) parts.push(`entry ${costs.entryPct.toFixed(2)}%`);
  if (costs.exitPct > 0) parts.push(`exit ${costs.exitPct.toFixed(2)}%`);
  if (costs.haircutPct > 0)
    parts.push(`haircut ${costs.haircutPct.toFixed(2)}% (sync redeems only)`);

  let md = '';
  if (parts.length > 0) {
    md += `### 💸 Trading Costs (v0.6+ transactional fees)\n\n- ${parts.join(' · ')}\n\n`;
  }
  if (hasUpcoming) {
    const u: string[] = [];
    if (costs.upcomingManagementPct !== null)
      u.push(`management → ${costs.upcomingManagementPct.toFixed(2)}%`);
    if (costs.upcomingPerformancePct !== null)
      u.push(`performance → ${costs.upcomingPerformancePct.toFixed(2)}%`);
    const activateAt = costs.newRatesActivateAt ? ` at unix ${costs.newRatesActivateAt}` : '';
    md += `- **Upcoming rates**: ${u.join(' · ')}${activateAt}\n\n`;
  }
  return md;
}

/**
 * Build the v0.6+ trading-cost summary from a vault. All percentages are
 * converted from basis points via `basisPointsToPercent` — never re-inline
 * `/ 100` here. Returns nullable fields for staged rates that aren't set.
 */
function buildTradingCosts(vault: VaultData): TradingCosts {
  const state = vault.state;
  const upcomingMgmt = state?.upcomingManagementFee;
  const upcomingPerf = state?.upcomingPerformanceFee;
  return {
    entryPct: basisPointsToPercent(state?.entryRate),
    exitPct: basisPointsToPercent(state?.exitRate),
    haircutPct: basisPointsToPercent(state?.haircutRate),
    upcomingManagementPct:
      typeof upcomingMgmt === 'number' ? basisPointsToPercent(upcomingMgmt) : null,
    upcomingPerformancePct:
      typeof upcomingPerf === 'number' ? basisPointsToPercent(upcomingPerf) : null,
    feeRatesCooldownSeconds: state?.feeRatesCooldown ?? null,
    newRatesActivateAt: state?.newRatesTimestamp ?? null,
  };
}

/**
 * Risk analysis service for vault risk assessment
 */
export class RiskService extends BaseService {
  /**
   * Fetch risk analysis data from GraphQL
   * Composition is fetched separately using correct addresses from bundles.octav
   */
  async fetchRiskData(vaultAddress: string, chainId: number): Promise<RiskAnalysisData | null> {
    // Fetch main risk data (without composition - it's fetched separately)
    const raw = await this.client.request<RawRiskAnalysisResponse>(RISK_ANALYSIS_QUERY, {
      vaultAddress,
      chainId,
      curatorId: '', // Will be extracted from vault.curators after fetch
    });

    if (!raw.vault) return null;

    const { stateHistory, ...vault } = raw.vault;
    const priceHistory = stateHistory.pricePerShareUsd
      .filter((p): p is { x: number; y: number } => p.y !== null && p.y > 0)
      .map((p) => ({ timestamp: p.x, pricePerShareUsd: p.y }));

    const data: Omit<RiskAnalysisData, 'composition'> = {
      vault,
      allVaults: raw.allVaults,
      curatorVaults: raw.curatorVaults,
      priceHistory,
    };

    // Fetch composition separately using correct addresses from bundles.octav
    // This uses graceful degradation - if composition fails, we continue without it
    const composition = await this.fetchCompositionForVault(data.vault);

    return { ...data, composition };
  }

  /**
   * Calculate risk breakdown from fetched data
   */
  calculateRisk(data: RiskAnalysisData): RiskScoreBreakdown {
    // Calculate TVL
    const vaultTVL = data.vault.state?.totalAssetsUsd || 0;

    // Calculate total protocol TVL
    const totalProtocolTVL = data.allVaults.items.reduce(
      (sum, v) => sum + (v.state?.totalAssetsUsd || 0),
      0
    );

    const priceHistory = data.priceHistory.map((p) => p.pricePerShareUsd);

    // Falls back to first state-history point, then a 1-year default. The
    // fallbacks exist so fixtures without `creationDate` and brand-new vaults
    // (no history yet) still produce a usable age signal for the risk model.
    const now = Math.floor(Date.now() / 1000);
    const creationDate = data.vault.creationDate;
    const firstPoint = data.priceHistory[0];
    const createdAtTimestamp =
      typeof creationDate === 'number' && creationDate > 0
        ? creationDate
        : firstPoint
          ? firstPoint.timestamp
          : now - 365 * 24 * 60 * 60;
    const ageInDays = Math.floor((now - createdAtTimestamp) / (24 * 60 * 60));

    // Get curator vault count
    const curatorVaultCount = data.curatorVaults.items.length;

    // Calculate curator success rate (vaults with TVL > $10K)
    const successfulVaults = data.curatorVaults.items.filter(
      (v) => (v.state?.totalAssetsUsd || 0) > 10_000
    ).length;
    const curatorSuccessRate = curatorVaultCount > 0 ? successfulVaults / curatorVaultCount : 0.5;

    // Extract curator professional signals
    const curators = data.vault.curators || [];
    const professionalSignals = {
      hasWebsite: curators.some((c) => c.url && c.url.trim() !== ''),
      hasDescription: curators.some((c) => c.aboutDescription && c.aboutDescription.trim() !== ''),
      multipleCurators: curators.length > 1,
      curatorCount: curators.length,
    };

    // Extract fee data. GraphQL returns fees as uint16 basis points
    // (10000 = 100%); convert to percent for calculateFeeRisk's bucket thresholds.
    const managementFee = (data.vault.state?.managementFee || 0) / 100;
    const performanceFee = (data.vault.state?.performanceFee || 0) / 100;
    const pricePerShare = BigInt(data.vault.state?.pricePerShare || '0');
    const highWaterMark = BigInt(data.vault.state?.highWaterMark || '0');
    const performanceFeeActive = pricePerShare > highWaterMark;

    // Extract liquidity data
    const safeAssets = data.vault.state?.safeAssetBalanceUsd || 0;
    const pendingRedemptions = data.vault.state?.pendingSettlement?.assetsUsd || 0;

    // Extract APR data for consistency analysis
    const aprData = {
      weeklyApr: data.vault.state?.weeklyApr?.linearNetApr,
      monthlyApr: data.vault.state?.monthlyApr?.linearNetApr,
      yearlyApr: data.vault.state?.yearlyApr?.linearNetApr,
      inceptionApr: data.vault.state?.inceptionApr?.linearNetApr,
    };

    // Extract yield composition data
    const weeklyApr = data.vault.state?.weeklyApr;
    const yieldComposition = weeklyApr
      ? {
          totalApr: weeklyApr.linearNetApr || 0,
          nativeYieldsApr: weeklyApr.nativeYields?.reduce((sum, ny) => sum + (ny.apr || 0), 0) || 0,
          airdropsApr: weeklyApr.airdrops?.reduce((sum, ad) => sum + (ad.apr || 0), 0) || 0,
          incentivesApr: weeklyApr.incentives?.reduce((sum, inc) => sum + (inc.apr || 0), 0) || 0,
        }
      : undefined;

    // Extract settlement data
    const averageSettlement = data.vault.averageSettlement || 0;
    const pendingOperationsRatio = safeAssets > 0 ? pendingRedemptions / safeAssets : 0;
    const settlementData = {
      averageSettlementDays: averageSettlement,
      pendingOperationsRatio,
    };

    // Extract integration complexity data
    const integrationCount = data.vault.defiIntegrations?.length || 0;

    // Extract capacity utilization data
    const totalAssets = parseFloat(data.vault.state?.totalAssets || '0');
    const maxCapacity = data.vault.maxCapacity ? parseFloat(data.vault.maxCapacity) : null;
    const capacityData = {
      totalAssets,
      maxCapacity,
    };

    // Extract composition data for protocol diversification risk
    // Uses assetByProtocols from VaultCompositionFullResponse for DeFi protocol analysis
    // "wallet" protocol (idle assets) is excluded from diversification calculation
    let compositionData:
      | { compositions: Array<{ repartition: number }>; topProtocolPercent: number | null }
      | undefined;
    if (
      data.composition &&
      data.composition.assetByProtocols &&
      Object.keys(data.composition.assetByProtocols).length > 0
    ) {
      // Filter active protocols (value > 0) and transform to risk format
      const allProtocols = Object.entries(data.composition.assetByProtocols)
        .filter(([, protocol]: [string, ProtocolCompositionData]) => {
          const value = parseFloat(protocol.value);
          return !isNaN(value) && value > 0;
        })
        .map(([key, protocol]: [string, ProtocolCompositionData]) => ({
          key,
          value: parseFloat(protocol.value),
          repartition: 0, // Will calculate after total
        }));

      // Calculate total value (including wallet)
      const totalValue = allProtocols.reduce((sum, p) => sum + p.value, 0);

      // Calculate repartition (percentage) for each protocol
      allProtocols.forEach((p) => {
        p.repartition = totalValue > 0 ? (p.value / totalValue) * 100 : 0;
      });

      // Exclude wallet (idle assets) from diversification analysis
      // Wallet represents undeployed capital, not DeFi protocol concentration
      const defiProtocols = allProtocols.filter((p) => p.key !== 'wallet');

      // Recalculate percentages for DeFi-only (for HHI calculation)
      const defiTotalValue = defiProtocols.reduce((sum, p) => sum + p.value, 0);
      defiProtocols.forEach((p) => {
        p.repartition = defiTotalValue > 0 ? (p.value / defiTotalValue) * 100 : 0;
      });

      // Sort by value descending to get top protocol
      defiProtocols.sort((a, b) => b.value - a.value);

      const topProtocolPercent = defiProtocols[0]?.repartition ?? null;

      compositionData = {
        compositions: defiProtocols.map((p) => ({ repartition: p.repartition })),
        topProtocolPercent,
      };
    }

    // Perform risk analysis using utility function
    return analyzeRisk({
      tvl: vaultTVL,
      totalProtocolTVL,
      priceHistory,
      ageInDays,
      curatorVaultCount,
      curatorSuccessRate,
      curatorProfessionalSignals: professionalSignals,
      managementFee,
      performanceFee,
      performanceFeeActive,
      safeAssets,
      pendingRedemptions,
      aprData,
      yieldComposition,
      settlementData,
      integrationCount,
      capacityData,
      compositionData,
    });
  }

  /**
   * Extract addresses from Octav bundle URL
   * Example: https://pro.octav.fi/?addresses=0x123,0x456
   */
  private extractAddressesFromOctavUrl(url: string): string[] {
    try {
      const urlObj = new URL(url);
      const addresses = urlObj.searchParams.get('addresses');
      if (!addresses) return [];
      return addresses
        .split(',')
        .map((addr) => addr.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Fetch composition for a single address
   */
  private async fetchSingleComposition(
    address: string
  ): Promise<VaultCompositionFullResponse | null> {
    try {
      const result = await this.client.request<{
        vaultComposition: VaultCompositionFullResponse | null;
      }>(GET_VAULT_COMPOSITION_QUERY, { walletAddress: address });
      return result.vaultComposition;
    } catch (error) {
      // Graceful degradation - log warning and continue without composition
      console.warn(`Failed to fetch composition for ${address}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Fetch composition using correct addresses from bundles.octav URL
   * - Parses octav URL to get addresses
   * - Fetches composition for each address
   * - Merges if multiple addresses (bundle)
   */
  private async fetchCompositionForVault(
    vault: VaultData
  ): Promise<VaultCompositionFullResponse | null> {
    // Get addresses from bundles.octav URL if available
    let addresses: string[] = [];
    if (vault.bundles?.octav) {
      addresses = this.extractAddressesFromOctavUrl(vault.bundles.octav);
    }

    // Fallback to vault address if no bundle addresses
    if (addresses.length === 0) {
      addresses = [vault.address];
    }

    // Single address - direct fetch
    if (addresses.length === 1) {
      return this.fetchSingleComposition(addresses[0]);
    }

    // Multiple addresses (bundle) - fetch all and merge
    const compositions = await Promise.all(
      addresses.map((addr) => this.fetchSingleComposition(addr))
    );

    // Filter out nulls and merge
    const validCompositions = compositions.filter(
      (c): c is VaultCompositionFullResponse => c !== null
    );
    if (validCompositions.length === 0) return null;
    if (validCompositions.length === 1) return validCompositions[0];

    return this.mergeCompositions(validCompositions);
  }

  /**
   * Merge multiple compositions (for bundle vaults)
   * Aggregates assetByProtocols values across all compositions
   */
  private mergeCompositions(
    compositions: VaultCompositionFullResponse[]
  ): VaultCompositionFullResponse {
    // Aggregate assetByProtocols values
    const protocolMap = new Map<string, ProtocolCompositionData>();
    let totalNetworth = 0;

    for (const comp of compositions) {
      totalNetworth += parseFloat(comp.networth || '0');
      for (const [key, protocol] of Object.entries(comp.assetByProtocols || {})) {
        const existing = protocolMap.get(key);
        if (existing) {
          // Add values together
          existing.value = String(parseFloat(existing.value) + parseFloat(protocol.value));
        } else {
          // Clone the protocol data
          protocolMap.set(key, { ...protocol });
        }
      }
    }

    return {
      address: compositions[0].address,
      networth: String(totalNetworth),
      assetByProtocols: Object.fromEntries(protocolMap),
      chains: compositions[0].chains, // Use first composition's chains as base
    };
  }

  /**
   * Calculate comparative risk context by benchmarking against all vaults
   *
   * @param vaultRisk - Risk score for the target vault
   * @param allVaultsData - Data for all vaults on the chain
   * @returns Comparative risk context with percentile rankings
   */
  calculateComparativeContext(
    vaultRisk: number,
    allVaultsData: RiskAnalysisData['allVaults']
  ): ComparativeRiskContext {
    // TVL-based proxy ranking (full multi-factor scoring for all vaults is too expensive)
    // This provides approximate positioning, not precise risk comparison
    const vaultRisks = allVaultsData.items
      .map((v) => {
        const tvl = v.state?.totalAssetsUsd || 0;
        if (tvl >= 10_000_000) return 0.15;
        if (tvl >= 1_000_000) return 0.25;
        if (tvl >= 100_000) return 0.45;
        if (tvl >= 10_000) return 0.65;
        return 0.85;
      })
      .sort((a, b) => a - b);

    if (vaultRisks.length === 0) {
      return {
        percentile: 50,
        betterThanPercent: 50,
        medianRisk: vaultRisk,
        averageRisk: vaultRisk,
        isOutlier: false,
        isApproximate: true,
        riskRanking: 'No comparative data available',
      };
    }

    // Calculate percentile (what % of vaults have lower risk)
    const lowerRiskCount = vaultRisks.filter((r) => r < vaultRisk).length;
    const percentile = (lowerRiskCount / vaultRisks.length) * 100;
    const betterThanPercent = 100 - percentile;

    // Calculate median
    const midIndex = Math.floor(vaultRisks.length / 2);
    const medianRisk =
      vaultRisks.length % 2 === 0
        ? (vaultRisks[midIndex - 1] + vaultRisks[midIndex]) / 2
        : vaultRisks[midIndex];

    // Calculate average
    const averageRisk = vaultRisks.reduce((sum, r) => sum + r, 0) / vaultRisks.length;

    // Check if outlier (top/bottom 5%)
    const isOutlier = percentile < 5 || percentile > 95;

    // Generate ranking description (note: TVL-based approximation)
    const approxNote = ' (TVL-based approximate ranking)';
    let riskRanking: string;
    if (percentile >= 95) {
      riskRanking = `Exceptionally safe - Top 5% lowest risk${approxNote}`;
    } else if (percentile >= 75) {
      riskRanking = `Safer than ${Math.round(betterThanPercent)}% of vaults${approxNote}`;
    } else if (percentile >= 50) {
      riskRanking = `Above average safety - Safer than ${Math.round(betterThanPercent)}% of vaults${approxNote}`;
    } else if (percentile >= 25) {
      riskRanking = `Below average safety - Riskier than ${Math.round(percentile)}% of vaults${approxNote}`;
    } else if (percentile >= 5) {
      riskRanking = `Riskier than ${Math.round(percentile)}% of vaults${approxNote}`;
    } else {
      riskRanking = `High risk - Bottom 5% (riskier than ${Math.round(percentile)}% of vaults)${approxNote}`;
    }

    return {
      percentile,
      betterThanPercent,
      medianRisk,
      averageRisk,
      isOutlier,
      isApproximate: true,
      riskRanking,
    };
  }

  /**
   * Perform complete risk analysis for a vault
   *
   * @param vaultAddress - Vault address to analyze
   * @param chainId - Chain ID of the vault
   * @param includeComparative - Whether to include comparative benchmarking
   * @returns Risk score breakdown or null if vault not found
   */
  async analyze(
    vaultAddress: string,
    chainId: number,
    includeComparative: boolean = true
  ): Promise<ExtendedRiskScoreBreakdown | null> {
    // Fetch data
    const data = await this.fetchRiskData(vaultAddress, chainId);

    if (!data) {
      return null;
    }

    // Calculate weighted risk breakdown (numeric scores + bucket level).
    const riskBreakdown = this.calculateRisk(data);

    // Evaluate operational signals on every call — they derive from
    // already-cached vault state (cheap) and have their own freshness
    // semantics (e.g. stale_total_assets must not be cached past expiry).
    const operationalSignals = evaluateOperationalSignals(
      data.vault.state,
      Math.floor(Date.now() / 1000)
    );
    const floor = operationalSignalFloor(operationalSignals);
    const effectiveRiskLevel = riskLevelMax(riskBreakdown.riskLevel, floor);

    // Compute v0.6+ cost-of-trade summary (transactional fees, not drag).
    const tradingCosts = buildTradingCosts(data.vault);

    // Add comparative context if requested
    if (includeComparative && data.allVaults.items.length > 0) {
      const comparative = this.calculateComparativeContext(
        riskBreakdown.overallRisk,
        data.allVaults
      );
      return {
        ...riskBreakdown,
        comparative,
        operationalSignals,
        effectiveRiskLevel,
        tradingCosts,
      };
    }

    return {
      ...riskBreakdown,
      operationalSignals,
      effectiveRiskLevel,
      tradingCosts,
    };
  }

  /**
   * Format risk breakdown as markdown table
   */
  formatRiskBreakdown(
    breakdown: ExtendedRiskScoreBreakdown,
    responseFormat: 'score' | 'summary' | 'detailed' = 'summary'
  ): string {
    const scoreToEmoji = (score: number): string => {
      if (score < 0.3) return '🟢';
      if (score < 0.6) return '🟡';
      if (score < 0.8) return '🟠';
      return '🔴';
    };

    const scoreToPercentage = (score: number): string => {
      return `${(score * 100).toFixed(1)}%`;
    };

    const riskLevelToEmoji = (level: string): string => {
      switch (level) {
        case 'Low':
          return '🟢 Low';
        case 'Medium':
          return '🟡 Medium';
        case 'High':
          return '🟠 High';
        case 'Critical':
          return '🔴 Critical';
        default:
          return level;
      }
    };

    const operationalWarnings = renderOperationalWarnings(breakdown.operationalSignals);
    const effectiveLevelLine =
      breakdown.effectiveRiskLevel && breakdown.effectiveRiskLevel !== breakdown.riskLevel
        ? `**Effective level (after operational signals)**: ${riskLevelToEmoji(breakdown.effectiveRiskLevel)}\n\n`
        : '';

    // Score format: Just the overall risk score (~30 tokens)
    if (responseFormat === 'score') {
      const baseLine = `# Risk Score: ${scoreToPercentage(breakdown.overallRisk)} | ${riskLevelToEmoji(breakdown.riskLevel)}`;
      if (effectiveLevelLine) {
        return `${baseLine}\n\n${effectiveLevelLine}${operationalWarnings}`.trimEnd();
      }
      return operationalWarnings ? `${baseLine}\n\n${operationalWarnings}`.trimEnd() : baseLine;
    }

    // Summary format: Risk score with key metrics (~200 tokens)
    if (responseFormat === 'summary') {
      // Identify top 3 risk factors
      const riskFactors = [
        { name: 'APR Consistency', score: breakdown.aprConsistencyRisk },
        { name: 'Volatility', score: breakdown.volatilityRisk },
        { name: 'TVL', score: breakdown.tvlRisk },
        { name: 'Concentration', score: breakdown.concentrationRisk },
        { name: 'Yield Sustainability', score: breakdown.yieldSustainabilityRisk },
        { name: 'Age', score: breakdown.ageRisk },
        { name: 'Curator', score: breakdown.curatorRisk },
        { name: 'Fee', score: breakdown.feeRisk },
        { name: 'Liquidity', score: breakdown.liquidityRisk },
        { name: 'Settlement', score: breakdown.settlementRisk },
        { name: 'Integration Complexity', score: breakdown.integrationComplexityRisk },
        { name: 'Capacity Utilization', score: breakdown.capacityUtilizationRisk },
        { name: 'Protocol Diversification', score: breakdown.protocolDiversificationRisk },
        { name: 'Top Protocol Concentration', score: breakdown.topProtocolConcentrationRisk },
      ];

      const topRisks = riskFactors.sort((a, b) => b.score - a.score).slice(0, 3);

      let comparativeSection = '';
      if (breakdown.comparative) {
        const { percentile, riskRanking, isOutlier } = breakdown.comparative;
        const outlierIndicator = isOutlier ? ' 🌟' : '';
        comparativeSection = `
### 📊 Comparative Context${outlierIndicator}

**${riskRanking}** (Percentile: ${percentile.toFixed(1)}%)
`;
      }

      // Data quality section - extracted for TypeScript compatibility
      const dataQualitySection =
        breakdown.dataQuality !== 'high'
          ? `
### ⚠️ Data Quality: ${breakdown.dataQuality === 'medium' ? 'Medium' : 'Low'}

${breakdown.dataQualityNotes.map((note: string) => `- ${note}`).join('\n')}
`
          : '';

      const tradingCostsBlock = renderTradingCosts(breakdown.tradingCosts);
      return `
## Risk Analysis Dashboard

**Overall Risk**: ${scoreToPercentage(breakdown.overallRisk)} ${scoreToEmoji(breakdown.overallRisk)} | **Level**: ${riskLevelToEmoji(breakdown.riskLevel)}

${effectiveLevelLine}${operationalWarnings}${tradingCostsBlock}${comparativeSection}
### 🎯 Top Risk Concerns

| Factor | Score | Status |
|--------|-------|--------|
| ${topRisks[0].name} | ${scoreToPercentage(topRisks[0].score)} | ${scoreToEmoji(topRisks[0].score)} |
| ${topRisks[1].name} | ${scoreToPercentage(topRisks[1].score)} | ${scoreToEmoji(topRisks[1].score)} |
| ${topRisks[2].name} | ${scoreToPercentage(topRisks[2].score)} | ${scoreToEmoji(topRisks[2].score)} |

### All Risk Factors

| Factor | Score | Status |
|--------|-------|--------|
| APR Consistency | ${scoreToPercentage(breakdown.aprConsistencyRisk)} | ${scoreToEmoji(breakdown.aprConsistencyRisk)} |
| Volatility | ${scoreToPercentage(breakdown.volatilityRisk)} | ${scoreToEmoji(breakdown.volatilityRisk)} |
| Yield Sustainability | ${scoreToPercentage(breakdown.yieldSustainabilityRisk)} | ${scoreToEmoji(breakdown.yieldSustainabilityRisk)} |
| TVL | ${scoreToPercentage(breakdown.tvlRisk)} | ${scoreToEmoji(breakdown.tvlRisk)} |
| Concentration | ${scoreToPercentage(breakdown.concentrationRisk)} | ${scoreToEmoji(breakdown.concentrationRisk)} |
| Liquidity | ${scoreToPercentage(breakdown.liquidityRisk)} | ${scoreToEmoji(breakdown.liquidityRisk)} |
| Settlement Time${breakdown.averageSettlementDays !== undefined ? ` (${breakdown.averageSettlementDays}d avg)` : ''} | ${scoreToPercentage(breakdown.settlementRisk)} | ${scoreToEmoji(breakdown.settlementRisk)} |
| Age${breakdown.ageInDays !== undefined ? ` (${breakdown.ageInDays} days)` : ''} | ${scoreToPercentage(breakdown.ageRisk)} | ${scoreToEmoji(breakdown.ageRisk)} |
| Curator | ${scoreToPercentage(breakdown.curatorRisk)} | ${scoreToEmoji(breakdown.curatorRisk)} |
| Fees | ${scoreToPercentage(breakdown.feeRisk)} | ${scoreToEmoji(breakdown.feeRisk)} |
| Integration Complexity | ${scoreToPercentage(breakdown.integrationComplexityRisk)} | ${scoreToEmoji(breakdown.integrationComplexityRisk)} |
| Capacity Utilization | ${scoreToPercentage(breakdown.capacityUtilizationRisk)} | ${scoreToEmoji(breakdown.capacityUtilizationRisk)} |
| Protocol Diversification | ${scoreToPercentage(breakdown.protocolDiversificationRisk)} | ${scoreToEmoji(breakdown.protocolDiversificationRisk)} |
| Top Protocol Concentration | ${scoreToPercentage(breakdown.topProtocolConcentrationRisk)} | ${scoreToEmoji(breakdown.topProtocolConcentrationRisk)} |
${dataQualitySection}`;
    }

    // Detailed format: Full breakdown with explanations
    let comparativeDetailedSection = '';
    if (breakdown.comparative) {
      const { percentile, betterThanPercent, medianRisk, averageRisk, riskRanking, isOutlier } =
        breakdown.comparative;
      const outlierNote = isOutlier
        ? `
**Note**: This vault is a statistical outlier (top/bottom 5%)`
        : '';
      comparativeDetailedSection = `
## 📊 Comparative Risk Benchmarking

**Vault Position**: ${riskRanking}

| Metric | Value |
|--------|-------|
| **Percentile Rank** | ${percentile.toFixed(1)}% ${percentile >= 75 ? '🟢' : percentile >= 50 ? '🟡' : percentile >= 25 ? '🟠' : '🔴'} |
| **Better Than** | ${betterThanPercent.toFixed(1)}% of vaults |
| **Chain Median Risk** | ${scoreToPercentage(medianRisk)} |
| **Chain Average Risk** | ${scoreToPercentage(averageRisk)} |
| **This Vault Risk** | ${scoreToPercentage(breakdown.overallRisk)} |
${outlierNote}

---

`;
    }

    // Data quality section for detailed format
    const detailedDataQualitySection =
      breakdown.dataQuality !== 'high'
        ? `
---

## ⚠️ Data Quality Notice

**Quality Level**: ${breakdown.dataQuality === 'medium' ? 'Medium' : 'Low'}

The following data limitations affected this analysis:

${breakdown.dataQualityNotes.map((note: string) => `- ${note}`).join('\n')}

*Risk scores for factors with limited data default to 50% (medium risk) to indicate uncertainty.*
`
        : '';

    const detailedTradingCosts = renderTradingCosts(breakdown.tradingCosts);
    return `
${comparativeDetailedSection}${effectiveLevelLine}${operationalWarnings}${detailedTradingCosts}## Risk Analysis Breakdown

### Performance & Returns Risk
| Risk Factor | Score | Level |
|-------------|-------|-------|
| **APR Consistency** | ${scoreToPercentage(breakdown.aprConsistencyRisk)} | ${scoreToEmoji(breakdown.aprConsistencyRisk)} |
| **Volatility** | ${scoreToPercentage(breakdown.volatilityRisk)} | ${scoreToEmoji(breakdown.volatilityRisk)} |
| **Yield Sustainability** | ${scoreToPercentage(breakdown.yieldSustainabilityRisk)} | ${scoreToEmoji(breakdown.yieldSustainabilityRisk)} |

### Market & Liquidity Risk
| Risk Factor | Score | Level |
|-------------|-------|-------|
| **TVL** | ${scoreToPercentage(breakdown.tvlRisk)} | ${scoreToEmoji(breakdown.tvlRisk)} |
| **Concentration** | ${scoreToPercentage(breakdown.concentrationRisk)} | ${scoreToEmoji(breakdown.concentrationRisk)} |
| **Liquidity** | ${scoreToPercentage(breakdown.liquidityRisk)} | ${scoreToEmoji(breakdown.liquidityRisk)} |

### Composition Risk
| Risk Factor | Score | Level |
|-------------|-------|-------|
| **Protocol Diversification** | ${scoreToPercentage(breakdown.protocolDiversificationRisk)} | ${scoreToEmoji(breakdown.protocolDiversificationRisk)} |
| **Top Protocol Concentration** | ${scoreToPercentage(breakdown.topProtocolConcentrationRisk)} | ${scoreToEmoji(breakdown.topProtocolConcentrationRisk)} |

### Operational Risk
| Risk Factor | Score | Level |
|-------------|-------|-------|
| **Settlement Time**${breakdown.averageSettlementDays !== undefined ? ` (${breakdown.averageSettlementDays}d avg)` : ''} | ${scoreToPercentage(breakdown.settlementRisk)} | ${scoreToEmoji(breakdown.settlementRisk)} |
| **Integration Complexity** | ${scoreToPercentage(breakdown.integrationComplexityRisk)} | ${scoreToEmoji(breakdown.integrationComplexityRisk)} |
| **Capacity Utilization** | ${scoreToPercentage(breakdown.capacityUtilizationRisk)} | ${scoreToEmoji(breakdown.capacityUtilizationRisk)} |

### Qualitative Risk
| Risk Factor | Score | Level |
|-------------|-------|-------|
| **Age**${breakdown.ageInDays !== undefined ? ` (${breakdown.ageInDays} days operational)` : ''} | ${scoreToPercentage(breakdown.ageRisk)} | ${scoreToEmoji(breakdown.ageRisk)} |
| **Curator** | ${scoreToPercentage(breakdown.curatorRisk)} | ${scoreToEmoji(breakdown.curatorRisk)} |
| **Fees** | ${scoreToPercentage(breakdown.feeRisk)} | ${scoreToEmoji(breakdown.feeRisk)} |

---

## Overall Risk Assessment

**Risk Score**: ${scoreToPercentage(breakdown.overallRisk)}
**Risk Level**: ${riskLevelToEmoji(breakdown.riskLevel)}

---

### Risk Factor Explanations

#### Performance & Returns
**APR Consistency**: Measures return stability across time periods. High variation indicates unreliable strategy performance.

**Volatility**: Price stability over time. Based on standard deviation of daily returns. High volatility increases uncertainty.

**Yield Sustainability**: Composition of APR sources. Native yields are sustainable; temporary airdrops/incentives are not.

#### Market & Liquidity
**TVL**: Measures liquidity risk based on total value locked. Higher TVL indicates more market validation and liquidity.

**Concentration**: Vault's share of total protocol TVL. High concentration means protocol-wide risk if vault fails.

**Liquidity**: Ability to meet redemption requests. Based on safe asset coverage of pending redemptions.

#### Composition
**Protocol Diversification**: Measures how well the vault's funds are distributed across DeFi protocols using HHI (Herfindahl-Hirschman Index). Lower concentration = better diversification.

**Top Protocol Concentration**: Evaluates risk from having too much exposure to a single protocol. A top protocol exceeding 50% of allocation signals elevated concentration risk.

#### Operational
**Settlement Time**: Average time to process redemptions plus pending operations burden. Longer delays increase exit risk.

**Integration Complexity**: Number of DeFi protocol integrations. More integrations = larger attack surface and failure cascades.

**Capacity Utilization**: Deposit headroom vs max capacity. Near-capacity vaults may reject deposits; under-utilized signals low demand.

#### Qualitative
**Age**: Vault maturity and battle-testing. Newer vaults lack operational track record and stress-test history.

**Curator**: Curator reputation based on experience (vault count), track record, and professional presence.

**Fees**: Impact of management and performance fees on returns. Higher fees reduce net investor returns.
${detailedDataQualitySection}`;
  }

  /**
   * Analyze multiple vaults in a single batch operation
   *
   * Supports both same-chain (single chainId) and cross-chain (chainIds array) analysis.
   * For cross-chain, chainIds array must have same length as vaultAddresses (positional mapping).
   *
   * @param vaultAddresses - Array of vault addresses (2-20)
   * @param chainId - Single chain ID (when all vaults are on same chain)
   * @param chainIds - Array of chain IDs (for cross-chain, positional mapping with vaultAddresses)
   * @returns Batch analysis result with all vaults and summary
   */
  async analyzeBatch(
    vaultAddresses: string[],
    chainId?: number,
    chainIds?: number[]
  ): Promise<BatchRiskAnalysisResult> {
    // Determine if this is same-chain or cross-chain analysis
    const isCrossChain = chainIds && chainIds.length > 0;

    const vaultResults: BatchVaultRiskResult[] = [];
    let allVaultsContext: { items: Array<{ state: { totalAssetsUsd: number } }> } = { items: [] };

    if (isCrossChain) {
      // Cross-chain: Group vaults by chainId and fetch each chain separately
      const vaultsByChain = new Map<number, string[]>();
      chainIds.forEach((cId, index) => {
        const addr = vaultAddresses[index];
        if (!vaultsByChain.has(cId)) {
          vaultsByChain.set(cId, []);
        }
        vaultsByChain.get(cId)!.push(addr);
      });

      // Fetch all chains in parallel
      const chainPromises = Array.from(vaultsByChain.entries()).map(async ([cId, addresses]) => {
        const response = await this.client.request<BatchRiskAnalysisResponse>(
          CROSS_CHAIN_VAULTS_QUERY,
          {
            vaultAddresses: addresses,
            chainId: cId,
          }
        );
        return { chainId: cId, response };
      });

      const chainResults = await Promise.all(chainPromises);

      // Merge allVaults context from all chains
      chainResults.forEach(({ response }) => {
        allVaultsContext.items.push(...response.allVaults.items);
      });

      // Collect all vaults with their chainIds for composition fetching
      const allVaultsWithChain: Array<{ vault: VaultData; chainId: number }> = [];
      for (const { chainId: cId, response } of chainResults) {
        for (const vault of response.vaults.items) {
          allVaultsWithChain.push({ vault, chainId: cId });
        }
      }

      // Fetch compositions for all vaults in parallel (with graceful degradation)
      const compositions = await Promise.all(
        allVaultsWithChain.map(({ vault }) => this.fetchCompositionForVault(vault))
      );

      // Process each vault with its composition
      for (let i = 0; i < allVaultsWithChain.length; i++) {
        const { vault, chainId: cId } = allVaultsWithChain[i];
        const composition = compositions[i];
        const result = this.processVaultForBatch(vault, cId, allVaultsContext, composition);
        if (result) {
          vaultResults.push(result);
        }
      }
    } else {
      // Same-chain: Single batch query
      const response = await this.client.request<BatchRiskAnalysisResponse>(
        BATCH_RISK_ANALYSIS_QUERY,
        {
          vaultAddresses,
          chainId: chainId!,
        }
      );

      allVaultsContext = response.allVaults;

      // Fetch compositions for all vaults in parallel (with graceful degradation)
      const compositions = await Promise.all(
        response.vaults.items.map((vault) => this.fetchCompositionForVault(vault))
      );

      // Process each vault with its composition
      for (let i = 0; i < response.vaults.items.length; i++) {
        const vault = response.vaults.items[i];
        const composition = compositions[i];
        const result = this.processVaultForBatch(vault, chainId!, allVaultsContext, composition);
        if (result) {
          vaultResults.push(result);
        }
      }
    }

    // Sort by input order (preserve user's vault order)
    const addressOrder = new Map(vaultAddresses.map((addr, idx) => [addr.toLowerCase(), idx]));
    vaultResults.sort((a, b) => {
      const orderA = addressOrder.get(a.address.toLowerCase()) ?? 999;
      const orderB = addressOrder.get(b.address.toLowerCase()) ?? 999;
      return orderA - orderB;
    });

    // Early return if no vaults were found/processed
    if (vaultResults.length === 0) {
      return {
        vaults: [],
        summary: {
          lowestRisk: null,
          highestRisk: null,
          averageScore: 0,
          vaultCount: 0,
        },
      };
    }

    // Calculate summary statistics
    const scores = vaultResults.map((v) => v.riskScore);
    const lowestRiskVault = vaultResults.reduce(
      (min, v) => (v.riskScore < min.riskScore ? v : min),
      vaultResults[0]
    );
    const highestRiskVault = vaultResults.reduce(
      (max, v) => (v.riskScore > max.riskScore ? v : max),
      vaultResults[0]
    );
    const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    return {
      vaults: vaultResults,
      summary: {
        lowestRisk: { address: lowestRiskVault.address, score: lowestRiskVault.riskScore },
        highestRisk: { address: highestRiskVault.address, score: highestRiskVault.riskScore },
        averageScore,
        vaultCount: vaultResults.length,
      },
    };
  }

  /**
   * Process a single vault for batch analysis
   * Creates minimal RiskAnalysisData structure from vault data
   * Now includes composition data when available
   */
  private processVaultForBatch(
    vault: VaultData,
    chainId: number,
    allVaultsContext: { items: Array<{ state: { totalAssetsUsd: number } }> },
    composition: VaultCompositionFullResponse | null = null
  ): BatchVaultRiskResult | null {
    // Build minimal RiskAnalysisData for calculation
    // For batch, we skip per-vault curator/price queries for efficiency
    // Risk calculation will use available data with fallbacks
    const minimalData: RiskAnalysisData = {
      vault,
      allVaults: allVaultsContext,
      curatorVaults: { items: [] }, // Skip curator vaults for batch efficiency
      priceHistory: [], // Skip price history for batch efficiency
      composition, // Include composition for protocol diversification risk
    };

    // Calculate risk breakdown
    const breakdown = this.calculateRisk(minimalData);

    // Add comparative context
    const comparative = this.calculateComparativeContext(breakdown.overallRisk, allVaultsContext);

    const extendedBreakdown: ExtendedRiskScoreBreakdown = {
      ...breakdown,
      comparative,
    };

    // Extract top 5 risk factors
    const riskFactors = [
      { name: 'APR Consistency', score: breakdown.aprConsistencyRisk },
      { name: 'Volatility', score: breakdown.volatilityRisk },
      { name: 'TVL', score: breakdown.tvlRisk },
      { name: 'Concentration', score: breakdown.concentrationRisk },
      { name: 'Yield Sustainability', score: breakdown.yieldSustainabilityRisk },
      { name: 'Age', score: breakdown.ageRisk },
      { name: 'Curator', score: breakdown.curatorRisk },
      { name: 'Fee', score: breakdown.feeRisk },
      { name: 'Liquidity', score: breakdown.liquidityRisk },
    ];

    const topFactors = riskFactors
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((f) => ({
        name: f.name,
        score: f.score,
        level: this.scoreToLevel(f.score),
      }));

    return {
      address: vault.address,
      chainId,
      name: vault.name || vault.symbol || 'Unknown',
      riskScore: breakdown.overallRisk,
      riskLevel: breakdown.riskLevel,
      factors: topFactors,
      breakdown: extendedBreakdown,
    };
  }

  /**
   * Convert numeric score to risk level string
   */
  private scoreToLevel(score: number): string {
    if (score < 0.3) return 'Low';
    if (score < 0.6) return 'Medium';
    if (score < 0.8) return 'High';
    return 'Critical';
  }

  /**
   * Format batch risk analysis as markdown
   */
  formatBatchRiskBreakdown(
    result: BatchRiskAnalysisResult,
    responseFormat: 'score' | 'summary' | 'detailed' = 'summary'
  ): string {
    // Handle empty results gracefully
    if (result.vaults.length === 0 || !result.summary.lowestRisk || !result.summary.highestRisk) {
      return `# Batch Risk Analysis

**No vaults found for the provided addresses on the specified chain(s).**

Please verify:
- Vault addresses are correct (must be valid 0x... format)
- Chain IDs match the vaults' deployment chains
- For cross-chain portfolios, use \`chainIds\` array (not single \`chainId\`)

*Disclaimer: For informational purposes only. Not financial advice.*`;
    }

    const scoreToEmoji = (score: number): string => {
      if (score < 0.3) return '🟢';
      if (score < 0.6) return '🟡';
      if (score < 0.8) return '🟠';
      return '🔴';
    };

    const scoreToPercentage = (score: number): string => {
      return `${(score * 100).toFixed(1)}%`;
    };

    // Score format: Just scores (~50 tokens)
    if (responseFormat === 'score') {
      const lines = result.vaults.map(
        (v) =>
          `| ${v.name} | ${scoreToPercentage(v.riskScore)} | ${scoreToEmoji(v.riskScore)} ${v.riskLevel} |`
      );
      return `# Batch Risk Scores

| Vault | Risk | Level |
|-------|------|-------|
${lines.join('\n')}

**Average**: ${scoreToPercentage(result.summary.averageScore)}`;
    }

    // Summary format (~300 tokens)
    if (responseFormat === 'summary') {
      const vaultRows = result.vaults.map((v) => {
        const topFactor = v.factors[0];
        return `| ${v.name} | ${scoreToPercentage(v.riskScore)} ${scoreToEmoji(v.riskScore)} | ${v.riskLevel} | ${topFactor.name} (${scoreToPercentage(topFactor.score)}) |`;
      });

      return `# Batch Risk Analysis

## Summary
- **Vaults Analyzed**: ${result.summary.vaultCount}
- **Average Risk**: ${scoreToPercentage(result.summary.averageScore)}
- **Lowest Risk**: ${result.summary.lowestRisk.address.slice(0, 10)}... (${scoreToPercentage(result.summary.lowestRisk.score)})
- **Highest Risk**: ${result.summary.highestRisk.address.slice(0, 10)}... (${scoreToPercentage(result.summary.highestRisk.score)})

## Vault Comparison

| Vault | Risk Score | Level | Top Risk Factor |
|-------|------------|-------|-----------------|
${vaultRows.join('\n')}`;
    }

    // Detailed format (~600-1000 tokens)
    const vaultDetails = result.vaults.map((v) => {
      const factorRows = v.factors.map(
        (f) => `| ${f.name} | ${scoreToPercentage(f.score)} | ${scoreToEmoji(f.score)} ${f.level} |`
      );

      const comparative = v.breakdown.comparative;
      const comparativeInfo = comparative
        ? `\n**Percentile**: ${comparative.percentile.toFixed(1)}% (${comparative.riskRanking})`
        : '';

      return `### ${v.name}
**Address**: \`${v.address}\` | **Chain**: ${v.chainId}
**Overall Risk**: ${scoreToPercentage(v.riskScore)} ${scoreToEmoji(v.riskScore)} | **Level**: ${v.riskLevel}${comparativeInfo}

| Factor | Score | Level |
|--------|-------|-------|
${factorRows.join('\n')}
`;
    });

    return `# Batch Risk Analysis (Detailed)

## Summary Dashboard
| Metric | Value |
|--------|-------|
| **Vaults Analyzed** | ${result.summary.vaultCount} |
| **Average Risk** | ${scoreToPercentage(result.summary.averageScore)} |
| **Lowest Risk** | ${result.summary.lowestRisk.address.slice(0, 10)}... (${scoreToPercentage(result.summary.lowestRisk.score)}) 🟢 |
| **Highest Risk** | ${result.summary.highestRisk.address.slice(0, 10)}... (${scoreToPercentage(result.summary.highestRisk.score)}) 🔴 |

---

${vaultDetails.join('\n---\n\n')}`;
  }

  /**
   * Convert risk breakdown to structured data for UI block rendering
   * @param breakdown - Risk analysis breakdown
   * @param vaultAddress - Vault address
   * @param chainId - Chain ID
   * @param vaultName - Vault name (optional)
   * @returns Structured risk data for frontend
   */
  toStructuredRiskData(
    breakdown: ExtendedRiskScoreBreakdown,
    vaultAddress: string,
    chainId: number,
    vaultName?: string
  ): StructuredRiskData {
    const scoreToLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
      if (score < 0.3) return 'low';
      if (score < 0.6) return 'medium';
      if (score < 0.8) return 'high';
      return 'critical';
    };

    const formatScore = (score: number): string => `${(score * 100).toFixed(1)}%`;

    // All risk factors with their scores
    const factorMap: Record<string, number> = {
      aprConsistency: breakdown.aprConsistencyRisk,
      volatility: breakdown.volatilityRisk,
      tvl: breakdown.tvlRisk,
      concentration: breakdown.concentrationRisk,
      yieldSustainability: breakdown.yieldSustainabilityRisk,
      age: breakdown.ageRisk,
      curator: breakdown.curatorRisk,
      fee: breakdown.feeRisk,
      liquidity: breakdown.liquidityRisk,
      settlement: breakdown.settlementRisk,
      integrationComplexity: breakdown.integrationComplexityRisk,
      capacityUtilization: breakdown.capacityUtilizationRisk,
      protocolDiversification: breakdown.protocolDiversificationRisk,
      topProtocolConcentration: breakdown.topProtocolConcentrationRisk,
    };

    // Build allFactors with formatted values
    const allFactors: StructuredRiskData['allFactors'] = {};
    for (const [key, score] of Object.entries(factorMap)) {
      allFactors[key] = {
        score,
        scoreFormatted: formatScore(score),
        level: scoreToLevel(score),
      };
    }

    // Get top 3 risk factors sorted by score (highest first)
    const sortedFactors = Object.entries(factorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, score]) => ({
        name: this.formatFactorName(name),
        score,
        scoreFormatted: formatScore(score),
        level: scoreToLevel(score),
      }));

    return {
      address: vaultAddress,
      chainId,
      name: vaultName || 'Unknown Vault',
      overallRisk: {
        score: breakdown.overallRisk,
        scoreFormatted: formatScore(breakdown.overallRisk),
        level: scoreToLevel(breakdown.overallRisk),
      },
      topRisks: sortedFactors,
      allFactors,
      comparative: breakdown.comparative
        ? {
            percentile: breakdown.comparative.percentile,
            ranking: breakdown.comparative.riskRanking,
            isOutlier: breakdown.comparative.isOutlier,
          }
        : undefined,
      dataQuality: breakdown.dataQuality,
      operationalSignals: breakdown.operationalSignals,
      effectiveRiskLevel: breakdown.effectiveRiskLevel
        ? (breakdown.effectiveRiskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical')
        : undefined,
      tradingCosts: breakdown.tradingCosts,
    };
  }

  /**
   * Convert camelCase factor name to human-readable format
   */
  private formatFactorName(name: string): string {
    const nameMap: Record<string, string> = {
      aprConsistency: 'APR Consistency',
      volatility: 'Volatility',
      tvl: 'TVL',
      concentration: 'Concentration',
      yieldSustainability: 'Yield Sustainability',
      age: 'Age',
      curator: 'Curator',
      fee: 'Fees',
      liquidity: 'Liquidity',
      settlement: 'Settlement Time',
      integrationComplexity: 'Integration Complexity',
      capacityUtilization: 'Capacity Utilization',
      protocolDiversification: 'Protocol Diversification',
      topProtocolConcentration: 'Top Protocol Concentration',
    };
    return nameMap[name] || name;
  }

  /**
   * Convert batch risk result to structured data for UI block rendering
   * @param result - Batch risk analysis result
   * @returns Structured batch risk data for frontend
   */
  toStructuredBatchRiskData(result: BatchRiskAnalysisResult): StructuredBatchRiskData {
    const formatScore = (score: number): string => `${(score * 100).toFixed(1)}%`;

    return {
      summary: {
        vaultCount: result.summary.vaultCount,
        averageScore: result.summary.averageScore,
        averageScoreFormatted: formatScore(result.summary.averageScore),
        lowestRisk: result.summary.lowestRisk
          ? {
              address: result.summary.lowestRisk.address,
              score: result.summary.lowestRisk.score,
              scoreFormatted: formatScore(result.summary.lowestRisk.score),
            }
          : null,
        highestRisk: result.summary.highestRisk
          ? {
              address: result.summary.highestRisk.address,
              score: result.summary.highestRisk.score,
              scoreFormatted: formatScore(result.summary.highestRisk.score),
            }
          : null,
      },
      vaults: result.vaults.map((v) =>
        this.toStructuredRiskData(v.breakdown, v.address, v.chainId, v.name)
      ),
    };
  }
}
