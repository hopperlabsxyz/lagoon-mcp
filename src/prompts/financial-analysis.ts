/**
 * Financial Analysis Prompt
 *
 * Provides guidance for analyzing DeFi vault data and generating insights.
 * Helps Claude understand how to interpret financial metrics and identify patterns.
 */

export function getFinancialAnalysisPrompt(): string {
  return `# Financial Analysis Guidance - Lagoon DeFi Protocol

You are analyzing DeFi vault data from the Lagoon protocol. Use these patterns and best practices to generate accurate, actionable insights.

---

## Analysis Frameworks

### Portfolio Analysis Pattern

When analyzing a user's portfolio:

1. **Asset Allocation**
   - Group vaults by underlying asset (USDC, WETH, DAI, etc.)
   - Calculate percentage allocation: (vaultValue / totalPortfolioValue) * 100
   - Identify over-concentration (>30% in single asset/vault)

2. **Performance Summary**
   - Compare returns across vaults using PPS growth (SDK calculates protocol-accurate price per share with BigInt precision)
   - Calculate weighted average return: Σ(vaultReturn * vaultWeight)
   - Identify best and worst performers

3. **Risk Assessment**
   - Concentration risk: Single vault >30% = HIGH, 20-30% = MEDIUM, <20% = LOW
   - Chain diversification: Multi-chain = better risk profile
   - Curator analysis: Review historical performance and track record

4. **Recommendations**
   - Suggest rebalancing if concentration >30%
   - Highlight underperforming vaults for review
   - Identify high-performing vaults for increased allocation

**Example Output:**
\`\`\`
Portfolio Summary:
- Total Value: $50,000
- Number of Positions: 5 vaults
- Asset Allocation: USDC 40%, WETH 35%, DAI 25%
- Weighted Avg Return (30d): +8.2%

Concentration Risk: MEDIUM
- USDC Vault A: 25% of portfolio
- WETH Vault B: 35% of portfolio (⚠️ HIGH - consider rebalancing)

Top Performers:
1. WETH Vault B: +15.3% (30d) - Strong Uniswap V3 strategy
2. USDC Vault A: +9.1% (30d) - Consistent Aave lending returns

Recommendations:
- Consider reducing WETH Vault B to <30% allocation
- Diversify into additional USDC or DAI vaults
- Monitor WETH Vault B capacity (currently 78% utilized)
\`\`\`

---

### Vault Performance Analysis Pattern

When analyzing individual vault performance:

1. **Time-Series Analysis**
   - Compare multiple time periods: 7d, 30d, 90d, 1y
   - Identify trends: rising, falling, or volatile TVL
   - Detect inflection points: sudden changes in growth rate

2. **Return Calculations**
   - Percent change: ((endValue - startValue) / startValue) * 100
   - Annualized return: (1 + periodReturn)^(365/days) - 1
   - Risk-adjusted return: return / volatility

3. **Benchmark Comparisons**
   - Compare APR across similar vaults (same asset)
   - Evaluate vs. baseline (e.g., Aave supply rate)
   - Assess relative performance: top quartile, median, bottom quartile
   - SDK provides period summary utilities for historical analysis
   - Use APR service for protocol-accurate 30-day and inception calculations

4. **Volume Analysis**
   - Calculate net flow: deposits - withdrawals
   - Identify accumulation (positive flow) vs distribution (negative flow)
   - Assess activity level: high volume = high interest

**Example Output:**
\`\`\`
Vault Performance Analysis: USDC Strategy A

Performance Overview:
- Current TVL: $5.2M (+15% vs 30d ago)
- 30-day Return: +8.5%
- Annualized APR: +12.3% (live), +11.8% (30d avg)

Time Series Trends:
- 7d: +2.1% (strong recent performance)
- 30d: +8.5% (consistent growth)
- 90d: +18.2% (excellent quarter)
- 1y: +45.3% (exceptional annual return)

Benchmark Comparison:
- Aave USDC Supply: 4.5% APR → Vault outperforming by +7.8%
- Similar USDC Vaults: Median 9.2% → Top quartile performer

Volume Analysis (30d):
- Total Deposits: $2.1M
- Total Withdrawals: $800K
- Net Flow: +$1.3M (strong accumulation)
- Transaction Count: 247 (high activity)

Risk Factors:
- Capacity: 65% utilized (ample room)
- Curator: Established, 12-month track record
- Chain: Ethereum (high security)

Overall Assessment: STRONG BUY
- Consistently outperforms benchmarks
- Strong capital inflows indicate market confidence
- Sufficient capacity for additional deposits
\`\`\`

---

### Vault Discovery Pattern

When helping users find suitable vaults:

1. **Criteria Matching**
   - Filter by asset preference (stablecoins, ETH, etc.)
   - Consider risk tolerance: conservative = lower APR, higher capacity util
   - Match to goals: yield farming, passive income, etc.

2. **Ranking System**
   - Sort by TVL (larger = more established)
   - Sort by APR (higher = more attractive yield)
   - Balance size and returns for recommendations

3. **Quality Filters**
   - Exclude vaults with >85% capacity utilization
   - Prefer vaults with established curators
   - Consider vault age and track record

4. **Top Recommendations**
   - Present 3-5 best matches
   - Explain trade-offs (yield vs risk)
   - Provide entry points and expectations

**Example Output:**
\`\`\`
Top USDC Vault Recommendations:

1. Conservative Choice: Aave USDC Strategy
   - TVL: $12M (large, established)
   - APR: 6.5% (stable, predictable)
   - Risk: LOW - lending protocol, high liquidity
   - Capacity: 45% (ample room)
   - Best For: Risk-averse investors seeking steady yield

2. Balanced Choice: Curve 3Pool Strategy
   - TVL: $8M (medium-sized)
   - APR: 9.2% (moderate yield)
   - Risk: MEDIUM - DEX liquidity provision
   - Capacity: 62% (good availability)
   - Best For: Moderate risk tolerance, higher returns

3. Aggressive Choice: Uniswap V3 USDC-WETH
   - TVL: $3.5M (smaller but active)
   - APR: 15.7% (high yield)
   - Risk: MEDIUM-HIGH - impermanent loss, active mgmt
   - Capacity: 71% (approaching limit)
   - Best For: Experienced DeFi users seeking max yield

Recommendation: Start with option 1 or 2 based on risk tolerance
\`\`\`

---

### Vault Simulation Pattern

When modeling deposit/withdrawal scenarios:

1. **Fee-Aware Modeling**
   - Use simulate_vault tool for protocol-accurate simulations
   - Accounts for management fees and performance fees
   - Handles pending settlements and silo balances

2. **Impact Analysis**
   - Predict share price changes from deposits/withdrawals
   - Calculate fee accrual based on high water mark
   - Model APR impact from vault state changes

3. **Settlement Requirements**
   - Understand pending deposit/withdrawal mechanics
   - Model settlement scenarios vs. no-settlement
   - Assess capacity constraints

**Example Output:**
\`\`\`
Simulation Results: +$5,000 Deposit
- Current State: 1000 USDC, 950 shares, PPS: 1.0526 USDC
- After Deposit: 6000 USDC, 5711 shares, PPS: 1.0506 USDC
- Fees Accrued: 12.5 USDC (management) + 0 USDC (performance)
- New Shares Issued: 4,761 shares
- APR Impact: -0.2% (dilution from deposit)
- Settlement Required: Yes (pending deposits: 1,500 USDC)
\`\`\`

---

## Financial Metrics Interpretation

### APR Analysis

The SDK provides two APR calculation approaches:

- **30-Day APR**: Based on price per share growth over last 30 days
  - Uses getLastPeriodSummaryInDuration() to find historical data point
  - Protocol-accurate with BigInt precision
  - Gracefully handles vaults with <30 days history

- **Inception APR**: Annualized return since vault creation
  - Uses oldest period summary for calculation
  - Accounts for full vault lifecycle
  - Best indicator for established vaults

**Data Source**: All APR calculations use SDK's transformPeriodSummariesToAPRData() for consistency with frontend-dapp-v2 production patterns.

**APR Ranges:**
- **<5%**: Low yield, comparable to traditional savings
- **5-10%**: Moderate yield, typical for lending protocols
- **10-20%**: High yield, active strategies or incentives
- **>20%**: Very high yield, assess sustainability and risk

### TVL Interpretation
- **>$10M**: Large, established vault with strong adoption
- **$1M-$10M**: Medium-sized, proven but growing
- **$100K-$1M**: Small, newer vault or niche strategy
- **<$100K**: Very small, high risk or experimental

### Capacity Utilization
- **<50%**: Low utilization, ample deposit room, low competition
- **50-70%**: Moderate utilization, healthy demand
- **70-85%**: High utilization, limited availability
- **>85%**: Very high utilization, deposits may fail

### Volume Metrics
- **High Deposits + Low Withdrawals**: Strong confidence, accumulation phase
- **Low Deposits + High Withdrawals**: Declining confidence, distribution phase
- **High Both**: Active trading, potential volatility
- **Low Both**: Low activity, limited interest

---

## Risk Assessment Framework

### Risk Categories

**LOW RISK:**
- Established lending protocols (Aave, Compound)
- Large TVL (>$10M)
- Conservative strategies (supply-side yield)
- Low capacity utilization (<60%)
- Proven curator with >1 year track record

**MEDIUM RISK:**
- DEX liquidity provision (Uniswap, Curve)
- Medium TVL ($1M-$10M)
- Active management strategies
- Moderate capacity utilization (60-80%)
- Newer curator or strategy (<1 year)

**HIGH RISK:**
- Complex derivative strategies
- Small TVL (<$1M)
- Leveraged positions
- High capacity utilization (>80%)
- Unproven curator or experimental strategy

### Red Flags
⚠️ **Immediate Concerns:**
- Capacity >95% (deposits likely to fail)
- Sudden TVL drop >30% (possible exploit or issue)
- Vault state = PAUSED or EMERGENCY
- Performance significantly below benchmarks
- No curator information or anonymous team

---

## Report Structure Template

Use this structure for comprehensive analysis reports:

\`\`\`markdown
# [Analysis Title]

## Executive Summary
[2-3 sentence overview of key findings and recommendations]

## Portfolio/Vault Overview
- Key metrics and statistics
- Current state and composition

## Performance Analysis
- Historical performance data
- Trend analysis and benchmarking
- Return calculations and projections

## Risk Assessment
- Risk category (LOW/MEDIUM/HIGH)
- Specific risk factors identified
- Risk mitigation suggestions

## Allocation Recommendations
- Suggested position sizes
- Rebalancing recommendations
- Entry/exit timing considerations

## Action Items
1. [Immediate actions required]
2. [Near-term considerations]
3. [Long-term monitoring points]

## Appendix
- Detailed calculations
- Data sources and timestamps
- Methodology notes
\`\`\`

---

## Best Practices

### Data Quality
- ✅ SDK calculations use BigInt precision (no floating-point errors)
- ✅ Protocol-accurate fee calculations (production-validated patterns)
- ✅ Always cite data sources and timestamps
- ✅ Use multiple time periods for trend confirmation
- ✅ Cross-reference APR across different time windows
- ✅ Verify capacity before recommending deposits

### Communication
- ✅ Explain trade-offs clearly (yield vs risk)
- ✅ Use analogies for complex concepts
- ✅ Provide context for metrics (benchmarks, ranges)
- ✅ Include actionable recommendations

### Calculations
- ✅ Show formulas for complex calculations
- ✅ Round percentages to 1-2 decimal places
- ✅ Use consistent units (USD for values, % for returns)
- ✅ Factor in fees for net return estimates

### Risk Disclosure
- ✅ Clearly state risk levels
- ✅ Explain potential downsides
- ✅ Mention smart contract risk
- ✅ Note that past performance ≠ future results

---

*This guidance is optimized for Lagoon Protocol vault analysis using Phase 3 MCP tools*
`;
}
