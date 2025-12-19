/**
 * Risk Analysis Service
 *
 * Encapsulates risk analysis business logic with dependency injection.
 * Demonstrates service layer pattern for complex multi-step operations.
 */

import { BaseService } from '../base.service.js';
import { VaultData } from '../../graphql/fragments/index.js';
import { RISK_ANALYSIS_QUERY } from '../../graphql/queries/index.js';
import { analyzeRisk, RiskScoreBreakdown } from '../../utils/risk-scoring.js';

/**
 * Risk analysis input data extracted from GraphQL
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
  composition: {
    compositions: Array<{ protocol: string; repartition: number; valueInUsd: number }>;
    tokenCompositions: Array<{ symbol: string; repartition: number; valueInUsd: number }>;
  } | null;
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
 * Risk analysis service for vault risk assessment
 */
export class RiskService extends BaseService {
  /**
   * Fetch risk analysis data from GraphQL
   */
  async fetchRiskData(vaultAddress: string, chainId: number): Promise<RiskAnalysisData | null> {
    const data = await this.client.request<RiskAnalysisData>(RISK_ANALYSIS_QUERY, {
      vaultAddress,
      chainId,
      curatorId: '', // Will be extracted from vault.curators after fetch
      where: {
        vault_in: [vaultAddress],
        type_in: ['TotalAssetsUpdated'],
      },
      orderBy: 'timestamp',
      orderDirection: 'asc',
    });

    return data.vault ? data : null;
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
    const priceHistory = data.priceHistory.items.map((item) => {
      // Calculate price per share from totalAssetsUsd / totalSupply
      const totalSupply = parseFloat(item.data.totalSupply) / 1e18; // Convert from wei
      return totalSupply > 0 ? item.data.totalAssetsUsd / totalSupply : 0;
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
    const compositions = data.composition?.compositions;
    const topProtocol = compositions?.[0];
    const topProtocolPercent = topProtocol?.repartition ?? null;
    const compositionData = compositions
      ? {
          compositions: compositions.map((c) => ({ repartition: c.repartition })),
          topProtocolPercent,
        }
      : undefined;

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
`;
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
`;
  }
}
