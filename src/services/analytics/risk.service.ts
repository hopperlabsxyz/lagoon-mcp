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

/**
 * Risk analysis input data extracted from GraphQL
 * Uses assetByProtocols from Octav API for protocol-based diversification analysis
 */
export interface RiskAnalysisData {
  vault: VaultData;
  allVaults: { items: Array<{ state: { totalAssetsUsd: number } }> };
  curatorVaults: { items: Array<{ address: string; state: { totalAssetsUsd: number } }> };
  priceHistory: {
    items: Array<{
      timestamp: string;
      data: {
        totalAssets: string;
        totalAssetsUsd: number;
        totalSupply: string;
      };
    }>;
  };
  // Note: Backend API returns full response with assetByProtocols for protocol analysis
  composition: VaultCompositionFullResponse | null;
}

/**
 * Comparative risk context for benchmarking
 */
export interface ComparativeRiskContext {
  percentile: number; // 0-100, where 100 = safest (lower risk than X% of vaults)
  betterThanPercent: number; // Percentage of vaults with higher risk
  medianRisk: number; // Median risk score across all vaults
  averageRisk: number; // Average risk score across all vaults
  isOutlier: boolean; // True if in top 5% or bottom 5%
  riskRanking: string; // Description like "Safer than 75% of vaults"
}

/**
 * Extended risk score breakdown with comparative context
 */
export interface ExtendedRiskScoreBreakdown extends RiskScoreBreakdown {
  comparative?: ComparativeRiskContext;
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
 * Risk analysis service for vault risk assessment
 */
export class RiskService extends BaseService {
  /**
   * Fetch risk analysis data from GraphQL
   * Composition is fetched separately using correct addresses from bundles.octav
   */
  async fetchRiskData(vaultAddress: string, chainId: number): Promise<RiskAnalysisData | null> {
    // Fetch main risk data (without composition - it's fetched separately)
    const data = await this.client.request<Omit<RiskAnalysisData, 'composition'>>(
      RISK_ANALYSIS_QUERY,
      {
        vaultAddress,
        chainId,
        curatorId: '', // Will be extracted from vault.curators after fetch
        where: {
          vault_in: [vaultAddress],
          type_in: ['TotalAssetsUpdated'],
        },
        orderBy: 'timestamp',
        orderDirection: 'asc',
      }
    );

    if (!data.vault) return null;

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

    // Extract price history and calculate price per share
    // Filter out items with missing or zero totalSupply to avoid artificial volatility
    const priceHistory = data.priceHistory.items
      .filter((item) => {
        // Filter out items with missing or zero totalSupply
        const totalSupply = item.data?.totalSupply;
        return totalSupply && parseFloat(totalSupply) > 0 && item.data?.totalAssetsUsd > 0;
      })
      .map((item) => {
        // Calculate price per share from totalAssetsUsd / totalSupply
        const totalSupply = parseFloat(item.data.totalSupply) / 1e18; // Convert from wei
        return item.data.totalAssetsUsd / totalSupply;
      });

    // Calculate vault age in days from first transaction
    const now = Math.floor(Date.now() / 1000);
    const firstTransaction = data.priceHistory.items[0];
    const createdAtTimestamp = firstTransaction
      ? parseInt(firstTransaction.timestamp, 10)
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

    // Extract fee data
    const managementFee = data.vault.state?.managementFee || 0;
    const performanceFee = data.vault.state?.performanceFee || 0;
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
    // Calculate risk scores for all vaults (simplified - using TVL as proxy)
    // In production, this would calculate full risk scores, but that's expensive
    // So we'll use a simplified approach based on TVL tiers as a proxy
    const vaultRisks = allVaultsData.items
      .map((v) => {
        const tvl = v.state?.totalAssetsUsd || 0;
        // Simplified risk estimation based on TVL (inverse relationship)
        if (tvl >= 10_000_000) return 0.15;
        if (tvl >= 1_000_000) return 0.25;
        if (tvl >= 100_000) return 0.45;
        if (tvl >= 10_000) return 0.65;
        return 0.85;
      })
      .sort((a, b) => a - b); // Sort ascending (lower risk first)

    if (vaultRisks.length === 0) {
      return {
        percentile: 50,
        betterThanPercent: 50,
        medianRisk: vaultRisk,
        averageRisk: vaultRisk,
        isOutlier: false,
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

    // Generate ranking description
    let riskRanking: string;
    if (percentile >= 95) {
      riskRanking = `Exceptionally safe - Top 5% lowest risk`;
    } else if (percentile >= 75) {
      riskRanking = `Safer than ${Math.round(betterThanPercent)}% of vaults`;
    } else if (percentile >= 50) {
      riskRanking = `Above average safety - Safer than ${Math.round(betterThanPercent)}% of vaults`;
    } else if (percentile >= 25) {
      riskRanking = `Below average safety - Riskier than ${Math.round(percentile)}% of vaults`;
    } else if (percentile >= 5) {
      riskRanking = `Riskier than ${Math.round(percentile)}% of vaults`;
    } else {
      riskRanking = `High risk - Bottom 5% (riskier than ${Math.round(percentile)}% of vaults)`;
    }

    return {
      percentile,
      betterThanPercent,
      medianRisk,
      averageRisk,
      isOutlier,
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

    // Calculate risk breakdown
    const riskBreakdown = this.calculateRisk(data);

    // Add comparative context if requested
    if (includeComparative && data.allVaults.items.length > 0) {
      const comparative = this.calculateComparativeContext(
        riskBreakdown.overallRisk,
        data.allVaults
      );
      return {
        ...riskBreakdown,
        comparative,
      };
    }

    return riskBreakdown;
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

    // Score format: Just the overall risk score (~30 tokens)
    if (responseFormat === 'score') {
      return `# Risk Score: ${scoreToPercentage(breakdown.overallRisk)} | ${riskLevelToEmoji(breakdown.riskLevel)}`;
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

      return `
## Risk Analysis Dashboard

**Overall Risk**: ${scoreToPercentage(breakdown.overallRisk)} ${scoreToEmoji(breakdown.overallRisk)} | **Level**: ${riskLevelToEmoji(breakdown.riskLevel)}
${comparativeSection}
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
| Settlement Time | ${scoreToPercentage(breakdown.settlementRisk)} | ${scoreToEmoji(breakdown.settlementRisk)} |
| Age | ${scoreToPercentage(breakdown.ageRisk)} | ${scoreToEmoji(breakdown.ageRisk)} |
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

    return `
${comparativeDetailedSection}## Risk Analysis Breakdown

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
| **Settlement Time** | ${scoreToPercentage(breakdown.settlementRisk)} | ${scoreToEmoji(breakdown.settlementRisk)} |
| **Integration Complexity** | ${scoreToPercentage(breakdown.integrationComplexityRisk)} | ${scoreToEmoji(breakdown.integrationComplexityRisk)} |
| **Capacity Utilization** | ${scoreToPercentage(breakdown.capacityUtilizationRisk)} | ${scoreToEmoji(breakdown.capacityUtilizationRisk)} |

### Qualitative Risk
| Risk Factor | Score | Level |
|-------------|-------|-------|
| **Age** | ${scoreToPercentage(breakdown.ageRisk)} | ${scoreToEmoji(breakdown.ageRisk)} |
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
   * @param vaultAddresses - Array of vault addresses (2-10)
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
      priceHistory: { items: [] }, // Skip price history for batch efficiency
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
}
