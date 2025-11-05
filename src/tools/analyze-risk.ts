/**
 * analyze_risk Tool
 *
 * Multi-factor risk analysis for vault investment decisions.
 * Analyzes TVL, concentration, volatility, age, and curator reputation.
 *
 * Use cases:
 * - Investment risk assessment before deposit
 * - Portfolio risk monitoring and rebalancing
 * - Comparative risk analysis across vaults
 * - Due diligence for large deposits
 * - Performance: ~400-600 tokens per analysis
 *
 * Cache strategy:
 * - 15-minute TTL (risk factors can change with market conditions)
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { AnalyzeRiskInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { VaultData } from '../graphql/fragments/index.js';
import { RISK_ANALYSIS_QUERY } from '../graphql/queries/index.js';
import { analyzeRisk, RiskScoreBreakdown } from '../utils/risk-scoring.js';
import { cache, cacheTTL } from '../cache/index.js';

// Query now imported from ../graphql/queries/index.js

/**
 * Format risk breakdown as markdown table
 */
function formatRiskBreakdown(breakdown: RiskScoreBreakdown): string {
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

/**
 * Analyze vault risk with multi-factor scoring
 *
 * @param input - Risk analysis configuration (vault address, chain ID; pre-validated by createToolHandler)
 * @returns Risk analysis with breakdown and recommendations
 */
export async function executeAnalyzeRisk(input: AnalyzeRiskInput): Promise<CallToolResult> {
  try {
    // Generate cache key (input already validated by createToolHandler)
    const cacheKey = `risk:${input.chainId}:${input.vaultAddress}`;
    const cached = cache.get<RiskScoreBreakdown>(cacheKey);

    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: `${formatRiskBreakdown(cached)}\n\n_Cached result from ${new Date().toISOString()}_`,
          },
        ],
        isError: false,
      };
    }

    // Fetch vault data
    const data = await graphqlClient.request<{
      vault: VaultData & { createdAt: string; curatorId: string };
      allVaults: Array<{ state: { totalAssetsUsd: number } }>;
      curatorVaults: Array<{ address: string; state: { totalAssetsUsd: number } }>;
      priceHistory: {
        items: Array<{
          timestamp: string;
          data: { pricePerShareUsd: number };
        }>;
      };
    }>(RISK_ANALYSIS_QUERY, {
      vaultAddress: input.vaultAddress,
      chainId: input.chainId,
      curatorId: '', // Will be filled in second query if needed
    });

    if (!data.vault) {
      return {
        content: [
          {
            type: 'text',
            text: `No vault found at address ${input.vaultAddress} on chain ${input.chainId}`,
          },
        ],
        isError: false,
      };
    }

    // Calculate TVL
    const vaultTVL = data.vault.state?.totalAssetsUsd || 0;

    // Calculate total protocol TVL
    const totalProtocolTVL = data.allVaults.reduce(
      (sum, v) => sum + (v.state?.totalAssetsUsd || 0),
      0
    );

    // Extract price history
    const priceHistory = data.priceHistory.items.map((item) => item.data.pricePerShareUsd);

    // Calculate vault age in days
    const createdAtTimestamp = parseInt(data.vault.createdAt, 10);
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const ageInDays = Math.floor((nowTimestamp - createdAtTimestamp) / (24 * 60 * 60));

    // Get curator vault count
    const curatorVaultCount = data.curatorVaults.length;

    // Calculate curator success rate (vaults with TVL > $10K)
    const successfulVaults = data.curatorVaults.filter(
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

    // Perform risk analysis
    const riskBreakdown = analyzeRisk({
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

    // Cache the result
    cache.set(cacheKey, riskBreakdown, cacheTTL.riskAnalysis);

    // Return formatted analysis
    return {
      content: [
        {
          type: 'text',
          text: formatRiskBreakdown(riskBreakdown),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return handleToolError(error, 'analyze_risk');
  }
}
