# Financial Analysis: Core Concepts

**Purpose**: High-level analytical frameworks for DeFi vault analysis

**For detailed methodologies**: See [`/src/prompts/financial-analysis.ts`](../src/prompts/financial-analysis.ts)

**For tool capabilities**: See [`/docs/tools/README.md`](/docs/tools/README.md)

---

## Overview

This guide provides essential concepts for analyzing DeFi vaults. It focuses on **what to analyze** and **how to interpret metrics**, not implementation details.

**Target Audience:**
- DeFi analysts conducting vault due diligence
- Portfolio managers evaluating investments  
- Users learning about yield farming analysis

---

## Core Analysis Patterns

**For complete methodologies and step-by-step guides**: See runtime prompt [`/src/prompts/financial-analysis.ts`](../src/prompts/financial-analysis.ts)

### 1. Portfolio Analysis

**Purpose**: Evaluate multi-vault positions and identify optimization opportunities

**Key Concepts:**
- **Concentration Risk**: Single vault >30% = HIGH risk
- **Weighted Returns**: Performance across positions
- **Diversification**: Chain, asset, and curator diversity
- **Rebalancing Triggers**: When allocation drifts from targets

**Primary Tools**: [`user_portfolio`](/docs/tools/user-portfolio.md), [`analyze_risk`](/docs/tools/analyze-risk.md)

---

### 2. Vault Performance Analysis

**Purpose**: Evaluate individual vault performance vs. benchmarks

**Key Concepts:**
- **Time-Series Trends**: Compare 7d, 30d, 90d, 1y performance
- **Benchmark Comparison**: Relative to similar vaults and baseline rates
- **Risk-Adjusted Returns**: Return per unit of volatility
- **Volume Patterns**: Net flow indicates market sentiment

**Primary Tools**: [`vault_performance`](/docs/tools/vault-performance.md), [`compare_vaults`](/docs/tools/compare-vaults.md)

---

### 3. Vault Discovery

**Purpose**: Find suitable investment opportunities matching user criteria

**Key Concepts:**
- **Criteria Matching**: Asset class, risk tolerance, investment goals
- **Quality Filters**: TVL size, capacity utilization, curator reputation
- **Risk Spectrum**: Conservative → Moderate → Aggressive options
- **Trade-off Analysis**: Yield vs. risk vs. liquidity

**Primary Tools**: [`search_vaults`](/docs/tools/search-vaults.md), [`analyze_risk`](/docs/tools/analyze-risk.md)

---

### 4. Vault Simulation

**Purpose**: Model deposit/withdrawal scenarios before execution

**Key Concepts:**
- **Fee Impact Analysis**: Management, performance, entry/exit fees
- **Share Price Changes**: How transactions affect vault state
- **Settlement Requirements**: Pending deposit/withdrawal mechanics
- **Timing Optimization**: Best execution based on vault state

**Primary Tool**: [`simulate_vault`](/docs/tools/simulate-vault.md)

**For complete simulation methodology**: See [tool documentation](/docs/tools/simulate-vault.md)

---

## Metric Interpretation Guide

### APR (Annual Percentage Rate)

**Key Points:**
- Protocol-accurate calculations using BigInt precision
- Compare across similar asset classes only
- Higher APR typically = higher risk
- Verify historical consistency (not just current snapshot)
- Factor in all fees (reduces net APR)

**Interpretation Ranges:**

| APR Range | Typical Strategy | Risk Level |
|-----------|-----------------|------------|
| <5% | Conservative lending, stablecoin supply | LOW |
| 5-10% | Established protocol lending, basic LP | LOW-MEDIUM |
| 10-20% | Optimized LP, leveraged lending | MEDIUM |
| >20% | Complex strategies, new incentives | MEDIUM-HIGH |
| Negative | Strategy failure, investigate immediately | HIGH |

**For detailed APR methodology**: See [`/docs/tools/vault-performance.md`](/docs/tools/vault-performance.md)

---

### TVL (Total Value Locked)

**Significance**: Indicates vault size, liquidity, and market confidence

| TVL Range | Interpretation | Liquidity |
|-----------|----------------|-----------|
| >$10M | Large, established, proven | HIGH |
| $1M-$10M | Medium-sized, growing | MEDIUM |
| $100K-$1M | Small, newer | LOW |
| <$100K | Very small, experimental | VERY LOW |

**What to Monitor:**
- TVL trends over time (growth vs. decline)
- TVL relative to capacity (utilization %)
- Sudden drops >30% (investigate immediately)

---

### Capacity Utilization

**Significance**: Vault fill rate and deposit availability

| Utilization | Status | Action |
|-------------|--------|--------|
| <50% | Ample capacity | Safe to deposit |
| 50-70% | Healthy demand | Good balance |
| 70-85% | Limited availability | Monitor before large deposits |
| >85% | High risk of failure | Deposits may fail |
| >95% | Critical | Wait for redemptions |

---

### Volume & Transaction Patterns

**Significance**: Market sentiment and vault health

| Pattern | Signal | Interpretation |
|---------|--------|----------------|
| High deposits + low withdrawals | Bullish | Strong confidence |
| Low deposits + high withdrawals | Bearish | Declining confidence |
| High both | Uncertain | Active trading |
| Low both | Stagnant | Limited interest |

**Analysis**: Track net flow (deposits - withdrawals) over time

---

## Risk Assessment Framework

### Risk Categories

**For automated 7-factor scoring**: Use [`analyze_risk`](/docs/tools/analyze-risk.md)

#### LOW RISK
- Established protocols (Aave, Compound, Maker)
- Large TVL (>$10M) with consistent growth
- Conservative strategies (lending, blue-chip LP)
- Proven curator (>1 year track record)
- Expected APR: 3-10%

#### MEDIUM RISK
- DEX liquidity provision (Uniswap, Curve)
- Medium TVL ($1M-$10M)
- Active management strategies
- Moderate leverage or complexity
- Expected APR: 8-20%

#### HIGH RISK
- Complex derivatives or novel protocols
- Small/unstable TVL (<$1M)
- High leverage or exotic positions
- Unproven curator or experimental strategy
- Expected APR: >15% (varies widely)

---

### Red Flags ⚠️

**Immediate Concerns** (Investigate before depositing):

**Operational:**
- Capacity >95% (deposits likely to fail)
- Vault state = PAUSED or EMERGENCY
- TVL drop >30% in 24 hours

**Performance:**
- APR significantly below benchmarks
- Negative APR sustained >7 days
- Extreme volatility in returns

**Security:**
- No curator information
- Recent security incidents
- Unaudited smart contracts
- Unusual fees (>5% management, >30% performance)

**Liquidity:**
- Very low volume (<10 tx in 30d)
- Extreme concentration (single depositor >50%)

---

## Best Practices

### Data Quality

✅ **Always:**
- Cite data sources and timestamps
- Use multiple time periods for trends
- Cross-reference metrics across tools
- Verify capacity before deposit recommendations
- Compare to benchmarks for context

✅ **Note:**
- SDK uses BigInt precision (no rounding errors)
- Data cache TTLs: 5min (portfolio) to 60min (predictions)

---

### Communication

✅ **Required:**
- Explain trade-offs clearly (yield vs. risk vs. liquidity)
- State risk levels using consistent framework
- Include "past performance ≠ future results"
- Acknowledge smart contract risk for all DeFi
- Frame as analysis, NOT investment advice

❌ **Prohibited:**
- "I recommend you invest..."
- "You should buy/sell..."
- "This is a good investment..."
- "Guaranteed returns..."

**For legal compliance**: See [`DISCLAIMER_STANDARDS.md`](./DISCLAIMER_STANDARDS.md)

---

### Calculations

✅ **Standards:**
- Show formulas for complex calculations
- Document all assumptions
- Round percentages to 1-2 decimal places
- Use consistent units (USD, %, basis points)
- Factor in all fees and gas costs

---

## Tool Selection Quick Guide

**Single Vault (1-5 vaults)**:
- [`get_vault_data`](/docs/tools/get-vault-data.md) - Basic vault info
- [`vault_performance`](/docs/tools/vault-performance.md) - Historical trends
- [`simulate_vault`](/docs/tools/simulate-vault.md) - Transaction modeling

**Discovery (20+ vaults)**:
- [`search_vaults`](/docs/tools/search-vaults.md) - Filtering with 20+ criteria
- [`compare_vaults`](/docs/tools/compare-vaults.md) - Side-by-side comparison

**Portfolio Management**:
- [`user_portfolio`](/docs/tools/user-portfolio.md) - Multi-chain positions
- [`analyze_risk`](/docs/tools/analyze-risk.md) - Risk scoring

**Advanced/Custom**:
- [`query_graphql`](/docs/tools/query-graphql.md) - Custom queries

**For complete guide**: [`/docs/tools/README.md#tool-selection-guide`](/docs/tools/README.md#tool-selection-guide)

---

## Related Documentation

- **Detailed Methodologies**: [`/src/prompts/financial-analysis.ts`](../src/prompts/financial-analysis.ts)
- **Tool Capabilities**: [`/docs/tools/README.md`](/docs/tools/README.md)
- **Legal Compliance**: [`DISCLAIMER_STANDARDS.md`](./DISCLAIMER_STANDARDS.md)

---

*This framework provides high-level concepts. For step-by-step analysis procedures, see the runtime prompt.*

*Last updated: 2025-11-09*
