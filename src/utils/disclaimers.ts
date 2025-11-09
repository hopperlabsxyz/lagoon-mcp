/**
 * Legal Disclaimers for Financial Analysis Tools
 *
 * Provides legally protective disclaimer text for all financial analysis outputs.
 * Compliant with SEC/FINRA guidelines for financial information disclosure.
 *
 * @module disclaimers
 */

export type DisclaimerMode = 'full' | 'compact' | 'minimal';

export interface DisclaimerConfig {
  mode: DisclaimerMode;
  toolName: string;
  includeTimestamp?: boolean;
}

/**
 * Full disclaimer for high-risk financial analysis tools
 * Use for: analyze_risk, predict_yield, optimize_portfolio, compare_vaults
 *
 * Includes:
 * - Not financial advice statement
 * - Risk warnings
 * - Liability limitation
 * - Professional consultation recommendation
 * - Data accuracy limitations
 *
 * @param toolName - Name of the tool generating the output
 * @returns Full legal disclaimer text
 */
export function getFullFinancialDisclaimer(toolName: string): string {
  const timestamp = new Date().toISOString();

  return `

---

⚠️ **IMPORTANT DISCLAIMER - NOT FINANCIAL ADVICE**

This analysis is provided for **informational and educational purposes only** and does NOT constitute financial, investment, legal, or tax advice. The information presented by the ${toolName} tool:

- Is based on historical data and algorithmic analysis that may contain errors or inaccuracies
- Should NOT be relied upon as the sole basis for any investment decision
- Does NOT consider your individual financial situation, risk tolerance, or investment objectives
- Is NOT a recommendation to buy, sell, hold, or trade any digital asset or financial instrument

**Cryptocurrency and DeFi investments carry substantial risk**, including but not limited to:
- Complete loss of invested capital
- Smart contract vulnerabilities and exploits
- Market volatility and illiquidity
- Regulatory changes and enforcement actions
- Platform failures and operational risks

**BEFORE MAKING ANY INVESTMENT DECISIONS**:
1. Conduct your own thorough due diligence and research
2. Consult with qualified financial, legal, and tax professionals
3. Only invest capital you can afford to lose completely
4. Understand the specific risks associated with each vault and protocol

**NO LIABILITY**: We accept no liability whatsoever for any loss, damage, or adverse outcome arising from your use of this information. Past performance does not guarantee future results.

**Data Currency**: Analysis generated at ${timestamp}. Market conditions change rapidly.

---
`;
}

/**
 * Compact disclaimer for medium-risk tools
 * Use for: search_vaults, vault_performance, get_price_history, get_transactions
 *
 * Provides essential legal protection while maintaining readability for data-focused tools.
 *
 * @param toolName - Name of the tool generating the output
 * @returns Compact legal disclaimer text
 */
export function getCompactFinancialDisclaimer(toolName: string): string {
  return `

---

⚠️ **DISCLAIMER**: This ${toolName} output is for informational purposes only and is NOT financial advice. Cryptocurrency investments carry substantial risk including complete loss of capital. Conduct your own research and consult qualified professionals before making investment decisions. We accept no liability for losses arising from use of this information.

---
`;
}

/**
 * Minimal disclaimer for data retrieval tools
 * Use for: get_vault_data, user_portfolio, export_data, query_graphql, simulate_vault
 *
 * Provides basic legal protection for pure data retrieval operations.
 *
 * @param toolName - Name of the tool generating the output
 * @returns Minimal legal disclaimer text
 */
export function getMinimalFinancialDisclaimer(_toolName: string): string {
  return `

*Disclaimer: For informational purposes only. Not financial advice. DYOR and consult professionals before investing.*
`;
}

/**
 * High-risk financial analysis tools requiring full disclaimers
 */
const HIGH_RISK_TOOLS = ['analyze_risk', 'predict_yield', 'optimize_portfolio', 'compare_vaults'];

/**
 * Medium-risk tools requiring compact disclaimers
 */
const MEDIUM_RISK_TOOLS = [
  'search_vaults',
  'vault_performance',
  'price_history',
  'get_transactions',
];

/**
 * Low-risk data retrieval tools requiring minimal disclaimers
 */
const LOW_RISK_TOOLS = [
  'vault_data',
  'user_portfolio',
  'export_data',
  'query_graphql',
  'simulate_vault',
];

/**
 * Get appropriate disclaimer based on tool risk level
 *
 * Automatically determines the appropriate disclaimer level based on tool name
 * if mode is not explicitly specified.
 *
 * @param toolName - Name of the tool (snake_case)
 * @param mode - Optional override for disclaimer mode
 * @returns Appropriate disclaimer text for the tool
 *
 * @example
 * ```typescript
 * const disclaimer = getToolDisclaimer('analyze_risk');
 * // Returns full disclaimer
 *
 * const customDisclaimer = getToolDisclaimer('search_vaults', 'minimal');
 * // Returns minimal disclaimer (overriding auto-detection)
 * ```
 */
export function getToolDisclaimer(toolName: string, mode?: DisclaimerMode): string {
  // Auto-determine mode based on tool name if not specified
  let disclaimerMode = mode;

  if (!disclaimerMode) {
    if (HIGH_RISK_TOOLS.includes(toolName)) {
      disclaimerMode = 'full';
    } else if (MEDIUM_RISK_TOOLS.includes(toolName)) {
      disclaimerMode = 'compact';
    } else if (LOW_RISK_TOOLS.includes(toolName)) {
      disclaimerMode = 'minimal';
    } else {
      // Default to compact for unknown tools
      disclaimerMode = 'compact';
    }
  }

  switch (disclaimerMode) {
    case 'full':
      return getFullFinancialDisclaimer(toolName);
    case 'compact':
      return getCompactFinancialDisclaimer(toolName);
    case 'minimal':
      return getMinimalFinancialDisclaimer(toolName);
  }
}
