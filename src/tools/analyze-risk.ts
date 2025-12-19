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
 * - Cache tags: [CacheTag.RISK, CacheTag.ANALYTICS, CacheTag.VAULT]
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AnalyzeRiskInput, AnalyzeRisksInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { RiskService, BatchRiskAnalysisResult } from '../services/analytics/risk.service.js';
import { cacheTTL } from '../cache/index.js';

/**
 * Create the executeAnalyzeRisk function with DI container
 *
 * This factory function demonstrates the service layer pattern:
 * 1. Business logic encapsulated in RiskService
 * 2. Complex multi-step operations cleanly organized
 * 3. Service handles GraphQL queries and data processing
 * 4. Tool focuses on caching and response formatting
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteAnalyzeRisk(
  container: ServiceContainer
): (input: AnalyzeRiskInput) => Promise<CallToolResult> {
  const riskService = new RiskService('risk-analysis', container);

  return async (input: AnalyzeRiskInput): Promise<CallToolResult> => {
    try {
      // Generate cache key including responseFormat
      const responseFormat = (input.responseFormat ?? 'detailed') as
        | 'score'
        | 'summary'
        | 'detailed';
      const cacheKey = `risk:${input.chainId}:${input.vaultAddress}:${responseFormat}`;

      // Register cache tags for invalidation
      container.cacheInvalidator.register(cacheKey, [
        CacheTag.RISK,
        CacheTag.ANALYTICS,
        CacheTag.VAULT,
      ]);

      // Check cache
      const cached = container.cache.get<ReturnType<typeof riskService.calculateRisk>>(cacheKey);
      if (cached) {
        return {
          content: [
            {
              type: 'text',
              text: `${riskService.formatRiskBreakdown(cached, responseFormat)}\n\n_Cached result from ${new Date().toISOString()}_`,
            },
          ],
          isError: false,
        };
      }

      // Perform analysis using service
      const riskBreakdown = await riskService.analyze(input.vaultAddress, input.chainId);

      if (!riskBreakdown) {
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

      // Cache the result
      container.cache.set(cacheKey, riskBreakdown, cacheTTL.riskAnalysis);

      // Return formatted analysis with legal disclaimer
      return {
        content: [
          {
            type: 'text',
            text:
              riskService.formatRiskBreakdown(riskBreakdown, responseFormat) +
              getToolDisclaimer('analyze_risk'),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing risk: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Create the executeAnalyzeRisks function for batch risk analysis
 *
 * Analyzes 2-10 vaults in a single operation, significantly reducing
 * API calls and token usage compared to individual analyze_risk calls.
 *
 * Supports both same-chain and cross-chain analysis:
 * - Same-chain: Provide single chainId for all vaults
 * - Cross-chain: Provide chainIds array (positional mapping with vaultAddresses)
 *
 * @param container - Service container with dependencies
 * @returns Configured batch tool executor function
 */
export function createExecuteAnalyzeRisks(
  container: ServiceContainer
): (input: AnalyzeRisksInput) => Promise<CallToolResult> {
  const riskService = new RiskService('batch-risk-analysis', container);

  return async (input: AnalyzeRisksInput): Promise<CallToolResult> => {
    try {
      const responseFormat = (input.responseFormat ?? 'summary') as
        | 'score'
        | 'summary'
        | 'detailed';

      // Determine chain configuration
      const isCrossChain = input.chainIds && input.chainIds.length > 0;
      const chainKey = isCrossChain ? input.chainIds!.join('-') : String(input.chainId);

      // Generate cache key for batch
      const addressKey = input.vaultAddresses
        .map((a) => a.toLowerCase().slice(0, 10))
        .sort()
        .join('_');
      const cacheKey = `risks:${chainKey}:${addressKey}:${responseFormat}`;

      // Register cache tags for invalidation
      container.cacheInvalidator.register(cacheKey, [
        CacheTag.RISK,
        CacheTag.ANALYTICS,
        CacheTag.VAULT,
      ]);

      // Check cache
      const cached = container.cache.get<BatchRiskAnalysisResult>(cacheKey);
      if (cached) {
        return {
          content: [
            {
              type: 'text',
              text: `${riskService.formatBatchRiskBreakdown(cached, responseFormat)}\n\n_Cached result from ${new Date().toISOString()}_`,
            },
          ],
          isError: false,
        };
      }

      // Perform batch analysis
      const batchResult = await riskService.analyzeBatch(
        input.vaultAddresses,
        input.chainId,
        input.chainIds
      );

      if (batchResult.vaults.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No vaults found for the provided addresses on chain(s) ${chainKey}`,
            },
          ],
          isError: false,
        };
      }

      // Cache the result
      container.cache.set(cacheKey, batchResult, cacheTTL.riskAnalysis);

      // Return formatted analysis with legal disclaimer
      return {
        content: [
          {
            type: 'text',
            text:
              riskService.formatBatchRiskBreakdown(batchResult, responseFormat) +
              getToolDisclaimer('analyze_risks'),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing risks: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };
}
