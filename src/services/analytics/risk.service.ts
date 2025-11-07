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

    // Extract fee data
    const managementFee = data.vault.state?.managementFee || 0;
    const performanceFee = data.vault.state?.performanceFee || 0;
    const pricePerShare = BigInt(data.vault.state?.pricePerShare || '0');
    const highWaterMark = BigInt(data.vault.state?.highWaterMark || '0');
    const performanceFeeActive = pricePerShare > highWaterMark;

    // Extract liquidity data
    const safeAssets = data.vault.state?.safeAssetBalanceUsd || 0;
    const pendingRedemptions = data.vault.state?.pendingSettlement?.assetsUsd || 0;

    // Perform risk analysis using utility function
    return analyzeRisk({
      tvl: vaultTVL,
      totalProtocolTVL,
      priceHistory,
      ageInDays,
      curatorVaultCount,
      curatorSuccessRate,
      managementFee,
      performanceFee,
      performanceFeeActive,
      safeAssets,
      pendingRedemptions,
    });
  }

  /**
   * Perform complete risk analysis for a vault
   *
   * @param vaultAddress - Vault address to analyze
   * @param chainId - Chain ID of the vault
   * @returns Risk score breakdown or null if vault not found
   */
  async analyze(vaultAddress: string, chainId: number): Promise<RiskScoreBreakdown | null> {
    // Fetch data
    const data = await this.fetchRiskData(vaultAddress, chainId);

    if (!data) {
      return null;
    }

    // Calculate and return risk breakdown
    return this.calculateRisk(data);
  }

  /**
   * Format risk breakdown as markdown table
   */
  formatRiskBreakdown(
    breakdown: RiskScoreBreakdown,
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
      return `
## Risk Analysis

**Overall Risk**: ${scoreToPercentage(breakdown.overallRisk)} ${scoreToEmoji(breakdown.overallRisk)} | **Level**: ${riskLevelToEmoji(breakdown.riskLevel)}

### Key Risk Factors

| Factor | Score | Status |
|--------|-------|--------|
| TVL Risk | ${scoreToPercentage(breakdown.tvlRisk)} | ${scoreToEmoji(breakdown.tvlRisk)} |
| Concentration Risk | ${scoreToPercentage(breakdown.concentrationRisk)} | ${scoreToEmoji(breakdown.concentrationRisk)} |
| Volatility Risk | ${scoreToPercentage(breakdown.volatilityRisk)} | ${scoreToEmoji(breakdown.volatilityRisk)} |
| Age Risk | ${scoreToPercentage(breakdown.ageRisk)} | ${scoreToEmoji(breakdown.ageRisk)} |
| Curator Risk | ${scoreToPercentage(breakdown.curatorRisk)} | ${scoreToEmoji(breakdown.curatorRisk)} |
| Fee Risk | ${scoreToPercentage(breakdown.feeRisk)} | ${scoreToEmoji(breakdown.feeRisk)} |
| Liquidity Risk | ${scoreToPercentage(breakdown.liquidityRisk)} | ${scoreToEmoji(breakdown.liquidityRisk)} |
`;
    }

    return `
## Risk Analysis Breakdown

| Risk Factor | Score | Level |
|-------------|-------|-------|
| **TVL Risk** | ${scoreToPercentage(breakdown.tvlRisk)} | ${scoreToEmoji(breakdown.tvlRisk)} |
| **Concentration Risk** | ${scoreToPercentage(breakdown.concentrationRisk)} | ${scoreToEmoji(breakdown.concentrationRisk)} |
| **Volatility Risk** | ${scoreToPercentage(breakdown.volatilityRisk)} | ${scoreToEmoji(breakdown.volatilityRisk)} |
| **Age Risk** | ${scoreToPercentage(breakdown.ageRisk)} | ${scoreToEmoji(breakdown.ageRisk)} |
| **Curator Risk** | ${scoreToPercentage(breakdown.curatorRisk)} | ${scoreToEmoji(breakdown.curatorRisk)} |
| **Fee Risk** | ${scoreToPercentage(breakdown.feeRisk)} | ${scoreToEmoji(breakdown.feeRisk)} |
| **Liquidity Risk** | ${scoreToPercentage(breakdown.liquidityRisk)} | ${scoreToEmoji(breakdown.liquidityRisk)} |

---

## Overall Risk Assessment

**Risk Score**: ${scoreToPercentage(breakdown.overallRisk)}
**Risk Level**: ${riskLevelToEmoji(breakdown.riskLevel)}

---

### Risk Factor Explanations

**TVL Risk**: Measures liquidity risk based on total value locked. Higher TVL indicates more market validation and liquidity.

**Concentration Risk**: Vault's share of total protocol TVL. High concentration means protocol-wide risk if vault fails.

**Volatility Risk**: Price stability over time. Based on standard deviation of daily returns.

**Age Risk**: Vault maturity and battle-testing. Newer vaults lack operational track record.

**Curator Risk**: Curator reputation based on experience (vault count) and track record.

**Fee Risk**: Impact of management and performance fees on returns. Higher fees reduce net investor returns.

**Liquidity Risk**: Ability to meet redemption requests. Based on safe asset coverage of pending redemptions.
`;
  }
}
