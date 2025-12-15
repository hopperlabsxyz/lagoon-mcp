/**
 * Shared Utilities for Lagoon Skills
 *
 * Common text blocks, triggers, and helpers to reduce duplication
 * across skill implementations.
 *
 * @module skills/shared
 */

/**
 * Standard disclaimers for customer-facing skills
 */
export const COMMON_DISCLAIMERS = {
  /**
   * Not financial advice disclaimer
   */
  notFinancialAdvice: `**NOT FINANCIAL ADVICE**: This analysis is for informational and educational purposes ONLY. It does NOT constitute financial, investment, legal, or tax advice.`,

  /**
   * Total loss risk disclaimer
   */
  totalLossRisk: `**TOTAL LOSS RISK**: Users can lose 100% of their investment. Only amounts they can afford to lose completely should be invested.`,

  /**
   * No guarantees disclaimer
   */
  noGuarantees: `**NO GUARANTEES**: Past performance does NOT predict future results. Historical APRs are NOT indicative of future performance.`,

  /**
   * Full disclaimer block combining all three - use in customer-facing skills
   */
  full: `## Critical Disclaimers

**NOT FINANCIAL ADVICE**: This analysis is for informational and educational purposes ONLY. It does NOT constitute financial, investment, legal, or tax advice.

**TOTAL LOSS RISK**: Users can lose 100% of their investment. Only amounts they can afford to lose completely should be invested.

**NO GUARANTEES**: Past performance does NOT predict future results. Historical APRs are NOT indicative of future performance.`,
} as const;

/**
 * Communication guidelines for skills - language standards for customer interactions
 */
export const COMMUNICATION_GUIDELINES = `### Language Standards

**NEVER use**:
- "I recommend you invest..."
- "You should buy/deposit..."
- "This is a good investment..."
- "Best choice for you..."

**ALWAYS use**:
- "Historical data shows..."
- "For educational purposes, consider..."
- "This vault's characteristics include..."
- "One approach is..."

### Tone
- **Encouraging**: Build confidence, not fear
- **Educational**: Explain "why" behind each analysis step
- **Practical**: Focus on actionable next steps
- **Honest**: Don't oversell or hide risks`;

/**
 * Common trigger phrases that can be combined across skills
 */
export const COMMON_TRIGGERS = {
  /**
   * Risk-related triggers
   */
  riskAnalysis: [
    'risk',
    'risk analysis',
    'how risky',
    'risk score',
    'risk assessment',
    'risk level',
  ],

  /**
   * Portfolio-related triggers
   */
  portfolioRelated: ['portfolio', 'my vaults', 'my positions', 'my holdings', 'my investments'],

  /**
   * Performance-related triggers
   */
  performanceRelated: ['performance', 'returns', 'apr', 'yield', 'how is it doing', 'track record'],

  /**
   * Support-related triggers
   */
  supportRelated: ['help', 'issue', 'problem', 'not working', 'stuck', 'question'],
} as const;

/**
 * Risk score visual scale - use in skills that display risk scores
 */
export const RISK_SCORE_SCALE = `## Risk Score Scale
\`\`\`
0    20    40    60    80    100
|-----|-----|-----|-----|-----|
 Very  Low   Med  High  Very
 Low               High
\`\`\`

**Interpretation**:
- **0-20 (Very Low)**: Minimal risk factors identified
- **21-40 (Low)**: Conservative profile suitable
- **41-60 (Medium)**: Moderate risk, requires awareness
- **61-80 (High)**: Elevated risk, for experienced users
- **81-100 (Very High)**: Maximum risk exposure`;

/**
 * Helper to combine trigger arrays without duplicates
 *
 * @param triggerArrays - Arrays of trigger strings to combine
 * @returns Combined array with lowercase, deduplicated triggers
 *
 * @example
 * ```typescript
 * const triggers = combineTriggers(
 *   COMMON_TRIGGERS.riskAnalysis,
 *   ['deep risk', 'comprehensive risk']
 * );
 * ```
 */
export function combineTriggers(...triggerArrays: string[][]): string[] {
  const combined = new Set<string>();
  for (const arr of triggerArrays) {
    for (const trigger of arr) {
      combined.add(trigger.toLowerCase().trim());
    }
  }
  return Array.from(combined);
}

/**
 * Estimate token count for content
 * Uses 3.5 chars/token ratio (accurate for Lagoon's dense technical content)
 *
 * @param content - String content to estimate
 * @returns Estimated token count
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 3.5);
}
