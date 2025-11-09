/**
 * Universal legal disclaimers and risk notices for Lagoon MCP prompts
 *
 * These disclaimers MUST be included in all prompts that provide financial analysis,
 * investment guidance, or DeFi-related recommendations.
 *
 * @module disclaimers
 */

/**
 * Universal disclaimer covering legal protections, risk acknowledgment,
 * and user responsibilities. Required in ALL runtime prompts.
 */
export const UNIVERSAL_DISCLAIMER = `
⚠️ **CRITICAL LEGAL DISCLAIMERS**

**NOT FINANCIAL ADVICE**:
This analysis is for informational and educational purposes ONLY. It does NOT
constitute financial, investment, legal, or tax advice. No content provided
should be relied upon as the basis for any investment decision.

**PROFESSIONAL CONSULTATION REQUIRED**:
Before making ANY investment decisions, you MUST consult:
- Licensed financial advisors for investment guidance
- Legal counsel for regulatory compliance
- Tax professionals for tax implications
- Other qualified professionals as appropriate for your situation

**CRYPTOCURRENCY & DEFI RISKS**:
Cryptocurrency and DeFi investments carry SUBSTANTIAL risk including:
- Complete loss of capital (you may lose 100% of your investment)
- Extreme price volatility and market fluctuations
- Smart contract vulnerabilities and exploits
- Regulatory uncertainty and potential legal changes
- Lack of investor protections (not FDIC insured)
- Technology risks (bugs, hacks, network failures)
- Liquidity risks (inability to exit positions)

**NO WARRANTIES OR GUARANTEES**:
All data, analysis, and recommendations are provided "AS IS" without warranty
of any kind, express or implied. We make no guarantees about:
- Accuracy, completeness, or timeliness of information
- Suitability for your particular investment objectives
- Future performance or results
- Availability or reliability of services

**PAST PERFORMANCE**:
Past performance does NOT guarantee or predict future results. Historical
returns, yields, or APRs are NOT indicative of future performance.

**NO LIABILITY**:
We accept NO liability for:
- Investment losses or financial damages
- Decisions made based on this information
- Consequences of using this service
- Errors, omissions, or inaccuracies in data
- Third-party actions or service interruptions

**USER RESPONSIBILITY**:
You are solely responsible for:
- Conducting independent research and due diligence
- Verifying all information from official sources
- Understanding risks before investing
- Complying with laws and regulations in your jurisdiction
- Managing your own security and private keys
- Evaluating your own risk tolerance and financial situation

**REGULATORY NOTICE**:
This service may not be available in all jurisdictions. Users are responsible
for determining legality and compliance with local laws and regulations.
`;

/**
 * DeFi-specific risk disclosures covering technical and operational risks
 * unique to decentralized finance. Required for all DeFi analysis prompts.
 */
export const DEFI_SPECIFIC_RISKS = `
**DEFI-SPECIFIC RISKS**:

**Smart Contract Risk**:
Even audited smart contracts may contain undiscovered vulnerabilities, bugs,
or exploits. Code audits do NOT guarantee safety. Smart contract failures
can result in total loss of funds with no recourse.

**Gas Cost Volatility**:
Ethereum network transaction costs (gas fees) can spike unexpectedly during
network congestion, making transactions prohibitively expensive or causing
failed transactions with lost gas fees.

**Impermanent Loss**:
Liquidity provider (LP) positions expose users to impermanent loss when
token prices diverge. You may receive less value when withdrawing than if
you had simply held the tokens.

**MEV (Maximal Extractable Value)**:
Your transactions may be front-run, sandwiched, or reordered by MEV bots
and validators, resulting in worse execution prices or failed transactions.

**Flash Loan Attacks**:
DeFi protocols may be vulnerable to flash loan attacks that can drain
liquidity pools or manipulate prices, causing losses for users.

**Oracle Manipulation**:
Price feeds and oracles can be manipulated, especially during low liquidity
periods or through flash loan attacks, leading to incorrect valuations and
potential liquidations.

**Governance Risk**:
Protocol parameters, fee structures, and security controls can be changed
through governance votes, potentially affecting your positions adversely.

**Composability Risk**:
DeFi protocols are interconnected. Failures in one protocol can cascade
through the ecosystem, affecting other protocols you're using.

**Regulatory Risk**:
DeFi regulatory status is uncertain and evolving. Regulatory actions could
restrict access, freeze assets, or impose penalties without warning.

**Systemic Risks**:
DeFi-wide events (regulatory crackdowns, mass liquidations, stablecoin
depegs, bridge exploits) can trigger cascading failures across protocols.
`;

/**
 * Regulatory and compliance notices covering legal requirements,
 * tax obligations, and jurisdictional restrictions.
 */
export const REGULATORY_COMPLIANCE_NOTICE = `
## 📋 Regulatory & Compliance Notices

**Investment Advisor Disclosure**:
This service is NOT provided by registered investment advisors, broker-dealers,
or financial institutions. We do not provide personalized investment
recommendations or portfolio management services.

**Securities Law Notice**:
Some digital assets may be classified as securities under applicable laws
(including the U.S. Securities Act of 1933, the Howey Test, or equivalent
regulations in other jurisdictions). Users are solely responsible for
determining the regulatory classification of assets and compliance with
securities laws in their jurisdiction.

**Tax Obligations**:
Cryptocurrency transactions may constitute taxable events in your jurisdiction,
including but not limited to:
- Trading, swapping, or exchanging cryptocurrencies
- Earning yield, rewards, or staking income
- Receiving airdrops or governance tokens
- Providing liquidity to pools

You are responsible for tracking all transactions and reporting to tax
authorities. Consult qualified tax professionals for guidance on your specific
tax obligations.

**KYC/AML Compliance**:
Some jurisdictions require Know Your Customer (KYC) and Anti-Money Laundering
(AML) compliance for cryptocurrency services. Users are responsible for
complying with applicable KYC/AML requirements.

**Geographic Restrictions**:
This service may not be available or may be restricted in certain jurisdictions,
including but not limited to: countries subject to international sanctions,
jurisdictions where cryptocurrency activities are prohibited, or regions with
specific regulatory restrictions.

Users are responsible for determining whether their use of this service
complies with local laws and regulations.

**Accredited Investor Status**:
Some investment opportunities may be restricted to accredited investors as
defined by applicable securities regulations. Non-accredited investors may
face investment limits or restrictions.

**Cross-Border Compliance**:
International users must comply with:
- Local cryptocurrency and financial regulations
- Cross-border payment and money transmission laws
- Foreign exchange and capital control regulations
- International tax reporting requirements (FATCA, CRS, etc.)

**Data Protection**:
Use of this service is subject to applicable data protection regulations
including GDPR (EU), CCPA (California), and other privacy laws. Refer to
the privacy policy for details on data handling.
`;

/**
 * Data quality and analysis limitation disclaimers covering data sources,
 * freshness, accuracy, and analytical constraints.
 */
export const DATA_DISCLAIMER = `
## 📊 Data & Analysis Limitations

**Data Sources**:
Analysis is based on data aggregated from multiple sources including:
- Lagoon Protocol backend systems
- Public blockchain data
- Third-party data providers
- Community-provided information

We do NOT independently verify all data and cannot guarantee accuracy,
completeness, or reliability.

**Data Freshness & Caching**:
Data is cached to improve performance with the following refresh intervals:
- Portfolio data: Cached up to 5 minutes
- Vault data: Cached up to 15 minutes
- Price data: Cached up to 5 minutes
- APR predictions: Cached up to 60 minutes

During periods of high volatility or rapid changes, cached data may not
reflect current market conditions. For time-sensitive decisions, verify
current data on-chain or from official sources.

**Analysis Limitations**:
All quantitative analysis is subject to limitations:
- **Historical Bias**: Based on historical data which may not predict future
  performance, especially in unprecedented market conditions
- **Model Assumptions**: Statistical models assume certain market behaviors
  (e.g., normal return distributions) that may not hold in cryptocurrency markets
- **Incomplete Information**: Analysis cannot account for all factors affecting
  performance including future protocol changes, regulatory actions, or black
  swan events
- **Generalized Approach**: Does not account for your specific circumstances,
  goals, constraints, or risk tolerance

**Third-Party Data**:
Competitor data, benchmark information, and market statistics from third-party
sources may be:
- Unverified or incomplete
- Subject to different calculation methodologies
- Outdated or no longer accurate
- Affected by conflicts of interest

**Calculation Methodology**:
APR, risk scores, performance metrics, and other calculations use standardized
methodologies that may differ from those used by protocols or other platforms.
Different calculation methods can produce different results for the same
underlying data.

**No Real-Time Guarantees**:
While we strive to provide timely information, we cannot guarantee real-time
data updates. During network congestion, high volatility, or system maintenance,
data may be delayed or unavailable.

**Independent Verification Required**:
Users must independently verify all critical information including:
- Smart contract addresses and protocol details
- APR rates and fee structures
- TVL and liquidity metrics
- Security audit reports and status
- Governance proposals and parameter changes
`;

/**
 * Beginner-specific warnings for users new to DeFi and cryptocurrency.
 * Required for onboarding flows and first-time user experiences.
 */
export const BEGINNER_WARNINGS = `
## 🚨 CRITICAL WARNINGS FOR BEGINNERS

**BEFORE YOUR FIRST DEFI INVESTMENT**:

1. **TOTAL LOSS RISK**: You can lose 100% of your investment. Only invest
   amounts you can afford to lose completely without affecting your financial
   security or well-being.

2. **START SMALL**: Begin with minimal amounts to learn how DeFi works. Test
   all workflows (deposit, withdrawal, claiming rewards) with small amounts
   before committing significant capital.

3. **NOT FDIC INSURED**: Unlike traditional bank accounts, cryptocurrency
   holdings are NOT protected by government insurance programs (FDIC, SIPC, etc.).
   There is no deposit insurance or investor protection.

4. **SELF-CUSTODY RESPONSIBILITY**: You are solely responsible for securing
   your private keys and wallet access. Lost keys = lost funds permanently.
   There is no customer service to recover lost passwords or keys.

5. **IRREVERSIBLE TRANSACTIONS**: Blockchain transactions are irreversible.
   Sending funds to wrong addresses or interacting with malicious contracts
   can result in permanent loss.

6. **TAX OBLIGATIONS**: In most jurisdictions, cryptocurrency transactions
   are taxable events. You are responsible for tracking all transactions and
   reporting to tax authorities. Penalties for non-compliance can be severe.

7. **REGULATORY STATUS**: Check if cryptocurrency and DeFi activities are
   legal in your jurisdiction. Some countries prohibit or heavily restrict
   cryptocurrency use.

8. **SCAM PREVALENCE**: The cryptocurrency space has widespread scams, phishing
   attacks, and fraudulent projects. Be extremely cautious about:
   - Unsolicited investment opportunities
   - Promises of guaranteed returns
   - Projects without audits or transparent teams
   - Pressure to invest quickly

9. **TECHNICAL COMPLEXITY**: DeFi requires understanding of:
   - Wallet management and private key security
   - Gas fees and transaction mechanics
   - Smart contract interactions and approvals
   - Risk assessment and due diligence

10. **NO GUARANTEES**: There are no guaranteed returns in DeFi. High APRs
    often indicate high risk. Be skeptical of yields that seem too good to
    be true.

**EDUCATIONAL RESOURCES**:
Before investing, educate yourself about:
- How blockchain and smart contracts work
- Different types of DeFi protocols (lending, DEXs, yield aggregators)
- Common risks and how to mitigate them
- How to assess project legitimacy and security
- Proper wallet security practices

**WHEN IN DOUBT**: If you don't fully understand how a DeFi protocol works,
do NOT invest. Take time to learn, ask questions, and start with educational
resources before risking capital.
`;

/**
 * Portfolio-specific disclaimers for optimization and rebalancing advice.
 * Required for any prompts providing portfolio allocation guidance.
 */
export const PORTFOLIO_DISCLAIMER = `
## 💼 Portfolio Analysis Disclaimers

**THIS IS QUANTITATIVE ANALYSIS, NOT INVESTMENT ADVICE**:
Portfolio optimization analysis is a quantitative tool that analyzes historical
data patterns. It is NOT personalized investment advice and does NOT constitute
a recommendation to buy, sell, or hold any assets.

**Limitations of Portfolio Optimization**:
- **Historical Data**: Based on past performance which may NOT predict future
  results, especially in volatile cryptocurrency markets
- **Assumption Violations**: Assumes normal return distributions and rational
  markets, which often do not hold in cryptocurrency
- **Missing Context**: Cannot account for your specific:
  - Tax situation and optimization strategies
  - Investment goals and time horizons
  - Risk tolerance and liquidity needs
  - Regulatory constraints in your jurisdiction
  - Personal circumstances and preferences

**Rebalancing Considerations**:
- **Tax Implications**: Rebalancing triggers taxable events. Consult tax
  professionals BEFORE executing rebalancing recommendations.
- **Transaction Costs**: Gas fees and slippage can significantly impact
  small portfolios. Calculate costs before rebalancing.
- **Market Impact**: Large rebalancing operations may experience price slippage
  or limited liquidity.
- **Timing Risk**: Market conditions can change between analysis and execution.

**Professional Consultation Recommended**:
For portfolios valued at >$10,000 or representing a significant portion of your
net worth, STRONGLY consider consulting licensed financial advisors before
making allocation changes.

**Risk Metrics Limitations**:
- Volatility and risk metrics are backward-looking and may not capture:
  - Tail risks and black swan events
  - Correlation breakdowns during crises
  - New risks from protocol changes or exploits
- Value at Risk (VaR) and similar metrics assume normal distributions which
  rarely hold in cryptocurrency markets

**Diversification Note**:
Diversification across cryptocurrency assets does NOT eliminate risk. All
cryptocurrencies may decline together during market downturns or regulatory
actions. True diversification requires exposure to uncorrelated asset classes.
`;

/**
 * Helper function to combine disclaimers based on prompt type
 */
export function getDisclaimers(options: {
  universal: boolean;
  defi: boolean;
  regulatory: boolean;
  data: boolean;
  beginner: boolean;
  portfolio: boolean;
}): string {
  const disclaimers: string[] = [];

  if (options.universal) disclaimers.push(UNIVERSAL_DISCLAIMER);
  if (options.defi) disclaimers.push(DEFI_SPECIFIC_RISKS);
  if (options.regulatory) disclaimers.push(REGULATORY_COMPLIANCE_NOTICE);
  if (options.data) disclaimers.push(DATA_DISCLAIMER);
  if (options.beginner) disclaimers.push(BEGINNER_WARNINGS);
  if (options.portfolio) disclaimers.push(PORTFOLIO_DISCLAIMER);

  return disclaimers.join('\n\n');
}

/**
 * Report footer disclaimer for all user-facing analysis outputs
 */
export const REPORT_FOOTER_DISCLAIMER = `
---
⚠️ **DISCLAIMER**: This analysis is for informational and educational purposes
only and is NOT financial, investment, legal, or tax advice. Cryptocurrency
and DeFi investments carry substantial risk including potential total loss of
capital. Past performance does not guarantee future results. Consult qualified
professionals before making investment decisions. See full disclaimers in
documentation.
---
`;
