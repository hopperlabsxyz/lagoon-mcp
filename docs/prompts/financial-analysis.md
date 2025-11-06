# Financial Analysis Framework for Lagoon Protocol

*Comprehensive analytical guidance for DeFi vault analysis, portfolio management, and risk assessment*

---

## Overview

This guide provides structured frameworks and best practices for analyzing DeFi vault data from the Lagoon protocol. It's designed to help analysts, investors, and developers generate accurate, actionable insights from vault performance data, portfolio positions, and yield strategies.

**Target Audience:**
- DeFi analysts conducting vault due diligence
- Portfolio managers optimizing multi-vault positions
- Investors evaluating yield farming opportunities
- Developers building analytics applications

**Prerequisites:**
- Basic understanding of DeFi concepts (APR, TVL, liquidity provision)
- Familiarity with Lagoon protocol vault mechanics
- Access to Lagoon MCP tools (see [/docs/tools/README.md](/docs/tools/README.md))

---

## Available Tools

Complete tool documentation with parameters, return formats, and examples: [`/docs/tools/README.md`](/docs/tools/README.md)

### Quick Tool Reference

**Core Analysis Tools:**
- **Risk Assessment**: [`analyze_risk`](/docs/tools/analyze-risk.md) → 7-factor risk scoring with composite ratings
- **Vault Simulation**: [`simulate_vault`](/docs/tools/simulate-vault.md) → Protocol-accurate deposit/withdrawal modeling
- **Yield Forecasting**: [`predict_yield`](/docs/tools/predict-yield.md) → ML-based predictions with confidence intervals
- **Vault Comparison**: [`compare_vaults`](/docs/tools/compare-vaults.md) → Side-by-side benchmarking and rankings

**Portfolio Management:**
- **User Portfolio**: [`user_portfolio`](/docs/tools/user-portfolio.md) → Multi-chain position aggregation
- **Portfolio Optimization**: *Coming soon* → Rebalancing strategies and allocation optimization

**Discovery & Historical Data:**
- **Search Vaults**: [`search_vaults`](/docs/tools/search-vaults.md) → Advanced filtering with 20+ criteria
- **Vault Performance**: [`vault_performance`](/docs/tools/vault-performance.md) → Historical metrics and trend analysis
- **Price History**: [`price_history`](/docs/tools/price-history.md) → OHLCV time-series data and volatility
- **Transaction History**: [`get_transactions`](/docs/tools/get-transactions.md) → Deposit/withdrawal tracking

**Data Retrieval & Export:**
- **Vault Data**: [`get_vault_data`](/docs/tools/get-vault-data.md) → Complete vault information
- **Export Data**: [`export_data`](/docs/tools/export-data.md) → CSV/JSON export for external analysis
- **GraphQL Queries**: [`query_graphql`](/docs/tools/query-graphql.md) → Custom queries for power users

---

## Analysis Frameworks

### 1. Portfolio Analysis Pattern

**Purpose**: Evaluate multi-vault positions and generate optimization recommendations

**When to Use:**
- Reviewing user portfolio performance across multiple vaults
- Identifying concentration risks and diversification opportunities
- Generating rebalancing recommendations
- Assessing overall portfolio health and risk exposure

**Tool Integration:**
- Use [`user_portfolio`](/docs/tools/user-portfolio.md) for multi-chain position data
- Use [`analyze_risk`](/docs/tools/analyze-risk.md) for individual vault risk assessment
- Use *portfolio optimization tool* (coming soon) for rebalancing recommendations

#### Analysis Steps

**1. Asset Allocation Analysis**
- Group vaults by underlying asset (USDC, WETH, DAI, etc.)
- Calculate percentage allocation: `(vaultValue / totalPortfolioValue) * 100`
- Identify over-concentration (single asset/vault >30%)

**2. Performance Summary**
- Compare returns across vaults using price per share (PPS) growth
- Calculate weighted average return: `Σ(vaultReturn * vaultWeight)`
- Identify best and worst performers
- Note: SDK calculates protocol-accurate PPS with BigInt precision

**3. Risk Assessment**
- **Concentration Risk**:
  - Single vault >30% = HIGH risk
  - Single vault 20-30% = MEDIUM risk
  - Single vault <20% = LOW risk
- **Chain Diversification**: Multi-chain positions = better risk profile
- **Curator Analysis**: Review historical performance and track record

**4. Recommendations**
- Suggest rebalancing if concentration exceeds 30%
- Highlight underperforming vaults for review or exit
- Identify high-performing vaults for increased allocation
- Consider correlation between positions

#### Example Output

```markdown
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
```

---

### 2. Vault Performance Analysis Pattern

**Purpose**: Evaluate individual vault historical performance and generate investment recommendations

**When to Use:**
- Conducting due diligence on specific vaults
- Comparing vault performance against benchmarks
- Identifying performance trends and inflection points
- Evaluating risk-adjusted returns

**Tool Integration:**
- Use [`vault_performance`](/docs/tools/vault-performance.md) for historical metrics
- Use [`predict_yield`](/docs/tools/predict-yield.md) for forward-looking forecasts
- Use [`compare_vaults`](/docs/tools/compare-vaults.md) for peer benchmarking
- Use [`price_history`](/docs/tools/price-history.md) for volatility analysis

#### Analysis Steps

**1. Time-Series Analysis**
- Compare multiple time periods: 7d, 30d, 90d, 1y
- Identify trends: rising, falling, or volatile TVL
- Detect inflection points: sudden changes in growth rate
- Use SDK period summary utilities for historical analysis

**2. Return Calculations**
- Percent change: `((endValue - startValue) / startValue) * 100`
- Annualized return: `(1 + periodReturn)^(365/days) - 1`
- Risk-adjusted return: `return / volatility` (Sharpe-like ratio)

**3. Benchmark Comparisons**
- Compare APR across similar vaults (same asset class)
- Evaluate vs. baseline (e.g., Aave supply rate for stablecoins)
- Assess relative performance: top quartile, median, bottom quartile
- Note: SDK provides APR service for protocol-accurate calculations

**4. Volume Analysis**
- Calculate net flow: `deposits - withdrawals`
- Identify accumulation (positive net flow) vs distribution (negative)
- Assess activity level: high volume indicates strong interest
- Use [`get_transactions`](/docs/tools/get-transactions.md) for detailed flow analysis

#### Example Output

```markdown
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
- Capacity: 65% utilized (ample room for deposits)
- Curator: Established, 12-month track record
- Chain: Ethereum (high security baseline)

Overall Assessment: STRONG BUY
- Consistently outperforms benchmarks across all time periods
- Strong capital inflows indicate market confidence
- Sufficient capacity for additional deposits without impact
```

---

### 3. Vault Discovery Pattern

**Purpose**: Help users find suitable investment opportunities based on their criteria

**When to Use:**
- Users seeking new vault opportunities
- Asset-specific yield farming searches
- Risk-tolerance-based recommendations
- Capacity-constrained alternative discovery

**Tool Integration:**
- Use [`search_vaults`](/docs/tools/search-vaults.md) for filtering with 20+ criteria
- Use [`analyze_risk`](/docs/tools/analyze-risk.md) for due diligence
- Use [`compare_vaults`](/docs/tools/compare-vaults.md) for ranking finalists

#### Analysis Steps

**1. Criteria Matching**
- Filter by asset preference (stablecoins, ETH, BTC, etc.)
- Consider risk tolerance:
  - Conservative: lower APR, higher security, established protocols
  - Moderate: balanced APR and risk, proven strategies
  - Aggressive: maximum APR, accept higher risks
- Match to investment goals: passive income, active yield farming, capital preservation

**2. Ranking System**
- Sort by TVL (larger vaults = more established and liquid)
- Sort by APR (higher = more attractive yield, but verify sustainability)
- Balance size and returns for optimal recommendations
- Use [`search_vaults`](/docs/tools/search-vaults.md) pagination for large result sets

**3. Quality Filters**
- Exclude vaults with >85% capacity utilization (deposit risk)
- Prefer vaults with established, vetted curators
- Consider vault age and historical track record
- Filter out paused or emergency-state vaults

**4. Top Recommendations**
- Present 3-5 best matches across risk spectrum
- Explain trade-offs clearly (yield vs. risk vs. liquidity)
- Provide entry points and realistic expectations
- Note capacity constraints and timing considerations

#### Example Output

```markdown
Top USDC Vault Recommendations:

1. Conservative Choice: Aave USDC Lending Strategy
   - TVL: $12M (large, established, high liquidity)
   - APR: 6.5% (stable, predictable returns)
   - Risk: LOW - Blue-chip lending protocol, battle-tested
   - Capacity: 45% utilized (ample room for deposits)
   - Best For: Risk-averse investors seeking steady, reliable yield
   - Entry: Any time, no timing concerns

2. Balanced Choice: Curve 3Pool LP Strategy
   - TVL: $8M (medium-sized, proven strategy)
   - APR: 9.2% (moderate yield with stability)
   - Risk: MEDIUM - DEX liquidity provision, impermanent loss exposure
   - Capacity: 62% utilized (good availability)
   - Best For: Moderate risk tolerance, higher returns than lending
   - Entry: Monitor pool imbalance for optimal entry

3. Aggressive Choice: Uniswap V3 USDC-WETH Concentrated
   - TVL: $3.5M (smaller but actively managed)
   - APR: 15.7% (high yield from concentrated liquidity)
   - Risk: MEDIUM-HIGH - IL risk, active range management required
   - Capacity: 71% utilized (approaching capacity limit)
   - Best For: Experienced DeFi users seeking maximum yield
   - Entry: Consider capacity - may need to wait for redemptions

Recommendation: Start with option 1 or 2 based on risk profile.
New DeFi users should begin conservatively and scale up gradually.
```

---

### 4. Vault Simulation Pattern

**Purpose**: Model deposit/withdrawal scenarios before execution to optimize timing and minimize fees

**When to Use:**
- Pre-transaction planning and fee impact analysis
- Large deposit/withdrawal scenario modeling
- Settlement requirement calculations
- "What-if" analysis for strategy decisions

**Tool Integration:**
- Use [`simulate_vault`](/docs/tools/simulate-vault.md) for protocol-accurate modeling
- Complete simulation methodology available in tool documentation

#### Key Capabilities

**Fee-Aware Modeling:**
- Protocol-accurate simulation accounting for all fee types
- Management fee accrual calculations
- Performance fee modeling with high water mark
- Entry/exit fee impact analysis

**Impact Analysis:**
- Predict share price changes from deposits/withdrawals
- Calculate fee accrual based on current vault state
- Model APR impact from vault state changes
- Assess dilution or concentration effects

**Settlement Requirements:**
- Understand pending deposit/withdrawal mechanics
- Model settlement scenarios vs. no-settlement paths
- Assess capacity constraints and deposit success probability
- Timing optimization for best execution

#### Quick Example

```json
Simulation Input:
{
  "vaultAddress": "0x...",
  "scenario": {
    "type": "deposit",
    "amount": "5000"
  }
}

Simulation Output:
- Current State: 1,000 USDC, 950 shares, PPS: 1.0526
- After Deposit: 6,000 USDC, 5,711 shares, PPS: 1.0506
- Fees Accrued: 12.5 USDC (mgmt) + 0 USDC (perf)
- New Shares Issued: 4,761 shares
- APR Impact: -0.2% (temporary dilution from deposit)
- Settlement Required: Yes (pending deposits: 1,500 USDC)
```

**For complete simulation methodology, parameters, and detailed examples:**
📖 See [`/docs/tools/simulate-vault.md`](/docs/tools/simulate-vault.md)

---

## Financial Metrics Interpretation

### APR (Annual Percentage Rate)

**Data Source:** The SDK provides protocol-accurate APR calculations using BigInt precision to avoid floating-point errors.

**Calculation Approaches:**

1. **30-Day APR** (Short-term indicator)
   - Based on price per share growth over last 30 days
   - Uses `getLastPeriodSummaryInDuration()` to find historical snapshot
   - Gracefully handles vaults with <30 days history
   - Best for: Identifying recent performance trends

2. **Inception APR** (Long-term indicator)
   - Annualized return since vault creation
   - Uses oldest period summary for calculation
   - Accounts for full vault lifecycle including early ramp-up
   - Best for: Evaluating established vault performance

**Note**: All APR calculations use SDK's `transformPeriodSummariesToAPRData()` for consistency with production patterns.

**For detailed methodology:**
📖 See [`/docs/tools/vault-performance.md`](/docs/tools/vault-performance.md)

#### Interpretation Guidelines

| APR Range | Interpretation | Typical Strategies |
|-----------|----------------|-------------------|
| **<5%** | Low yield, comparable to traditional savings | Conservative lending, stablecoin supply |
| **5-10%** | Moderate yield, typical for established protocols | Aave/Compound lending, basic LP |
| **10-20%** | High yield, active strategies or incentives | Optimized LP, leveraged lending |
| **>20%** | Very high yield, assess sustainability carefully | Complex strategies, new protocol incentives |
| **Negative** | Loss-making period, investigate immediately | Strategy failure, market conditions, exploit |

**Key Considerations:**
- Compare APR across similar asset classes (don't compare ETH vs. stablecoin directly)
- Higher APR typically correlates with higher risk
- Verify APR sustainability: check historical consistency, not just current snapshot
- Factor in fees: entry, exit, management, and performance fees reduce net APR

---

### TVL (Total Value Locked)

TVL indicates vault size, liquidity, and market confidence.

| TVL Range | Interpretation | Risk Implications |
|-----------|----------------|-------------------|
| **>$10M** | Large, established vault with strong adoption | Lower risk, high liquidity, proven strategy |
| **$1M-$10M** | Medium-sized, proven but still growing | Moderate risk, good liquidity |
| **$100K-$1M** | Small, newer vault or niche strategy | Higher risk, limited liquidity |
| **<$100K** | Very small, high risk or experimental | Very high risk, may have liquidity issues |

**Analysis Tips:**
- Track TVL trends over time (growing vs. declining)
- Compare TVL to vault capacity (utilization percentage)
- Consider TVL relative to similar vaults (market share)
- Sudden TVL drops >30% may indicate issues (investigate immediately)

---

### Capacity Utilization

Capacity utilization indicates vault fill rate and deposit availability.

| Utilization | Interpretation | Action Implications |
|-------------|----------------|---------------------|
| **<50%** | Low utilization, ample deposit capacity | Safe to deposit, low competition |
| **50-70%** | Moderate utilization, healthy demand | Good balance of availability and demand |
| **70-85%** | High utilization, limited availability | Monitor capacity before large deposits |
| **>85%** | Very high utilization, deposits may fail | High risk of transaction failure |
| **>95%** | Critical capacity, deposits likely to fail | Wait for redemptions before attempting deposits |

**Strategic Considerations:**
- High capacity vaults may offer better entry/exit liquidity
- Near-capacity vaults may have better performance (efficient capital deployment)
- Plan large deposits when utilization <70% for safety
- Monitor capacity trends: rapid filling indicates strong demand

---

### Volume Metrics

Transaction volume patterns indicate market sentiment and vault health.

| Pattern | Interpretation | Signal |
|---------|----------------|--------|
| **High Deposits + Low Withdrawals** | Strong confidence, accumulation phase | Bullish sentiment, growing trust |
| **Low Deposits + High Withdrawals** | Declining confidence, distribution | Bearish sentiment, investigate concerns |
| **High Both** | Active trading, potential volatility | High interest but uncertain direction |
| **Low Both** | Low activity, limited interest | Stagnant vault, may lack competitive advantage |

**Analysis with [`get_transactions`](/docs/tools/get-transactions.md):**
- Track net flow (deposits - withdrawals) over time
- Identify large transactions that may impact vault state
- Monitor transaction frequency as activity indicator
- Compare volume to TVL (high ratio = active management)

---

## Risk Assessment Framework

### Risk Categories

Use these categories as baseline assessments. Combine with [`analyze_risk`](/docs/tools/analyze-risk.md) for comprehensive 7-factor scoring.

#### LOW RISK

**Characteristics:**
- Established lending protocols (Aave, Compound, Maker)
- Large TVL (>$10M) with consistent growth
- Conservative strategies (supply-side yield, blue-chip assets)
- Low capacity utilization (<60%)
- Proven curator with >1 year track record
- Deployed on secure, established chains (Ethereum mainnet)

**Typical Strategies:**
- Stablecoin lending to overcollateralized protocols
- Major DEX liquidity provision (Curve, Uniswap)
- Simple yield aggregation

**Expected APR Range:** 3-10%

---

#### MEDIUM RISK

**Characteristics:**
- DEX liquidity provision (Uniswap, Curve, Balancer)
- Medium TVL ($1M-$10M)
- Active management strategies requiring curator expertise
- Moderate capacity utilization (60-80%)
- Established curator or strategy (<1 year)
- L2 or alternative L1 chains

**Typical Strategies:**
- Concentrated liquidity provision
- Multi-protocol yield optimization
- Stablecoin farming with moderate leverage

**Expected APR Range:** 8-20%

---

#### HIGH RISK

**Characteristics:**
- Complex derivative strategies or novel protocols
- Small TVL (<$1M) or unstable TVL
- Leveraged or exotic positions
- High capacity utilization (>80%)
- Unproven curator or experimental strategy
- New or less secure chains

**Typical Strategies:**
- Leveraged yield farming
- Options strategies
- New protocol incentive farming
- Exotic derivative positions

**Expected APR Range:** >15% (varies widely)

---

### Red Flags

⚠️ **Immediate Concerns** (Investigate before depositing):

**Capacity & Operational:**
- Capacity >95% (deposits highly likely to fail)
- Vault state = PAUSED or EMERGENCY (operations halted)
- Sudden TVL drop >30% in 24 hours (possible exploit or mass exit)

**Performance:**
- APR significantly below benchmarks (underperformance)
- Negative APR sustained >7 days (strategy failure)
- Extreme volatility in returns (unstable strategy)

**Governance & Security:**
- No curator information or anonymous team (accountability risk)
- Recent security incidents or exploits
- Unaudited smart contracts or new code
- Unusual fee structures (>5% management, >30% performance)

**Market & Liquidity:**
- Very low transaction volume (<10 transactions in 30d)
- Extreme concentration (single depositor >50% of TVL)
- Rapid capacity filling (>50% in 24h without explanation)

**For comprehensive automated risk analysis:**
📖 Use [`analyze_risk`](/docs/tools/analyze-risk.md) for 7-factor scoring

---

## Report Structure Template

Use this structure for comprehensive analysis reports to ensure consistency and completeness.

```markdown
# [Analysis Title]

## Executive Summary
[2-3 sentence overview of key findings and primary recommendation]

**Quick Stats:**
- Metric 1: [value]
- Metric 2: [value]
- Overall Rating: [LOW/MEDIUM/HIGH RISK] or [STRONG BUY/BUY/HOLD/SELL]

---

## Portfolio/Vault Overview

**Current State:**
- Key metrics and statistics
- Current composition and allocation
- Recent changes and trends

**Background:**
- Strategy description
- Curator/protocol information
- Historical context

---

## Performance Analysis

**Historical Performance:**
- 7d, 30d, 90d, 1y returns
- Trend analysis (rising/falling/stable)
- Comparison to benchmarks

**Risk-Adjusted Returns:**
- Sharpe-like ratios where applicable
- Volatility assessment
- Maximum drawdown analysis

**Projections:**
- Forward-looking yield estimates
- Confidence intervals and assumptions
- Scenario analysis results

---

## Risk Assessment

**Risk Category:** [LOW/MEDIUM/HIGH]

**Risk Factors Identified:**
1. [Primary risk factor with impact assessment]
2. [Secondary risk factor]
3. [Additional factors...]

**Risk Mitigation:**
- Current risk controls in place
- Suggested additional safeguards
- Monitoring recommendations

---

## Allocation Recommendations

**Suggested Position Sizes:**
- Conservative allocation: [X]%
- Moderate allocation: [Y]%
- Aggressive allocation: [Z]%

**Rebalancing Guidance:**
- Current vs. optimal allocation
- Timing considerations
- Tax and fee implications

**Entry/Exit Strategy:**
- Optimal entry points (capacity, timing)
- Exit triggers (performance, risk events)
- Monitoring frequency

---

## Action Items

**Immediate Actions (0-7 days):**
1. [Urgent action required]
2. [Time-sensitive opportunity]

**Near-Term Considerations (7-30 days):**
1. [Strategic moves to plan]
2. [Monitoring checkpoints]

**Long-Term Monitoring:**
1. [Ongoing tracking points]
2. [Review schedule recommendations]

---

## Appendix

**Detailed Calculations:**
- [Show formulas and inputs for key metrics]
- [Include any complex derivations]

**Data Sources:**
- Tool: [tool name and parameters used]
- Timestamp: [when data was retrieved]
- Chain: [which blockchain]

**Methodology Notes:**
- Assumptions made in analysis
- Limitations of data or approach
- Alternative interpretations considered

**References:**
- [Related tool documentation]
- [External sources if any]
```

---

## Best Practices

### Data Quality Standards

✅ **Protocol Accuracy:**
- SDK calculations use BigInt precision (no floating-point rounding errors)
- Fee calculations are protocol-accurate and validated against production
- APR calculations match frontend-dapp-v2 production patterns

✅ **Data Verification:**
- Always cite data sources and exact timestamps
- Use multiple time periods for trend confirmation (don't rely on single snapshot)
- Cross-reference APR across different time windows (7d, 30d, inception)
- Verify capacity before recommending deposits (check recent utilization)
- Compare metrics to benchmarks and peer vaults (contextualize performance)

✅ **Freshness:**
- Note data cache TTLs: 5min (portfolio) to 60min (predictions)
- Refresh critical data before major recommendations
- Timestamp all analyses clearly

---

### Communication Standards

✅ **Clarity & Accessibility:**
- Explain trade-offs clearly and explicitly (yield vs. risk vs. liquidity)
- Use analogies for complex DeFi concepts when appropriate
- Provide context for all metrics (benchmarks, typical ranges, peer comparison)
- Include actionable recommendations, not just observations

✅ **Risk Disclosure:**
- Clearly state risk levels using consistent framework (LOW/MEDIUM/HIGH)
- Explain potential downsides and failure scenarios
- Mention smart contract risk as baseline for all DeFi protocols
- Explicitly note: "Past performance does not guarantee future results"

✅ **Professional Tone:**
- Avoid hype or emotional language
- Present balanced analysis with pros and cons
- Acknowledge uncertainties and limitations
- Be honest about data quality or analysis constraints

---

### Calculation Standards

✅ **Transparency:**
- Show formulas for complex calculations
- Document all assumptions clearly
- Provide calculation examples where helpful

✅ **Precision:**
- Round percentages to 1-2 decimal places for readability
- Use consistent units throughout (USD for values, % for returns, basis points for fees)
- Maintain higher precision in intermediate calculations, round only for display

✅ **Completeness:**
- Factor in all fees: entry, exit, management, performance
- Account for gas costs for small transactions
- Consider slippage for large deposits/withdrawals
- Include settlement delays in timing projections

---

### Tool Selection Guidance

**Single Vault Analysis (1-5 vaults):**
- Use [`get_vault_data`](/docs/tools/get-vault-data.md) with caching for efficiency
- Use [`simulate_vault`](/docs/tools/simulate-vault.md) for "what-if" scenarios
- Use [`get_vault_performance`](/docs/tools/vault-performance.md) for historical trends

**Discovery & Search (20+ vaults):**
- Use [`search_vaults`](/docs/tools/search-vaults.md) with filters for large-scale discovery
- Use pagination for result sets >50 vaults
- Use [`compare_vaults`](/docs/tools/compare-vaults.md) for final shortlist ranking

**Portfolio Management:**
- Use [`user_portfolio`](/docs/tools/user-portfolio.md) for multi-chain position aggregation
- Apply [`analyze_risk`](/docs/tools/analyze-risk.md) to each significant position
- Use comparison tools for rebalancing decisions

**Power Users:**
- Use [`query_graphql`](/docs/tools/query-graphql.md) for custom queries beyond standard tools
- Best for: complex filtering, bulk operations, custom aggregations
- Trade-off: No caching, requires GraphQL knowledge

**For complete tool selection guide:**
📖 See [`/docs/tools/README.md`](/docs/tools/README.md#tool-selection-guide)

---

## Related Documentation

**Tool Reference:**
- Complete tool catalog: [`/docs/tools/README.md`](/docs/tools/README.md)
- Individual tool docs: [`/docs/tools/`](/docs/tools/)

**Advanced Topics:**
- Advanced analysis patterns: [`/docs/prompts/analysis-patterns.md`](./analysis-patterns.md) *(coming soon)*

**Runtime Prompts:**
- TypeScript implementation: [`/src/prompts/financial-analysis.ts`](/src/prompts/financial-analysis.ts)

---

*This framework is optimized for Lagoon Protocol vault analysis using Phase 3 MCP tools.*

*Last updated: 2025*
