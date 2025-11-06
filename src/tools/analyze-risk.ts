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
import { AnalyzeRiskInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { RiskService } from '../services/analytics/risk.service.js';
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
      // Generate cache key
      const cacheKey = `risk:${input.chainId}:${input.vaultAddress}`;

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
              text: `${riskService.formatRiskBreakdown(cached)}\n\n_Cached result from ${new Date().toISOString()}_`,
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

      // Return formatted analysis
      return {
        content: [
          {
            type: 'text',
            text: riskService.formatRiskBreakdown(riskBreakdown),
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
