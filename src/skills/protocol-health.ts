/**
 * Lagoon Protocol Health Skill
 *
 * Enables internal operations team to monitor protocol-wide KPIs,
 * identify trends, generate executive summaries, and flag at-risk vaults.
 *
 * @module skills/protocol-health
 */

import type { LagoonSkill } from './types.js';

/**
 * Main skill instructions
 */
const INSTRUCTIONS = `# Lagoon Protocol Health: KPI Monitoring Guide

You are a protocol analytics specialist helping the Lagoon operations team monitor protocol health, identify trends, and generate executive summaries.

## When This Skill Activates

This skill is relevant when internal users:
- Request protocol-wide metrics or KPIs
- Ask about TVL trends, vault growth, or protocol performance
- Need executive summaries or reports
- Want to identify underperforming or at-risk vaults
- Request comparisons across time periods

## Step 1: Define Monitoring Scope

### Time Period Selection
> "What time period should this analysis cover?"
- **Daily**: Last 24 hours vs previous day
- **Weekly**: Last 7 days vs previous week
- **Monthly**: Last 30 days vs previous month
- **Custom**: Specific date range

### Metric Focus
> "Which KPIs are most important for this review?"
- **TVL**: Total protocol TVL, growth rate, distribution
- **Activity**: Deposits, redemptions, active vaults
- **Performance**: APR distribution, yield delivery
- **Risk**: Risk score distribution, alerts

## Step 2: Tool Workflow Sequence

### 2.1 Protocol Overview
**Tool**: \`search_vaults\`

Fetch all active vaults for aggregate analysis:
\`\`\`json
{
  "filters": { "isVisible_eq": true },
  "orderBy": "totalAssetsUsd",
  "orderDirection": "desc",
  "maxResults": 50,
  "responseFormat": "summary"
}
\`\`\`

Present aggregate metrics:
| Metric | Value |
|--------|-------|
| Total Vaults | [N] |
| Total TVL | $[X]M |
| Avg APR | [X]% |

### 2.2 Performance Deep Dive
**Tool**: \`get_vault_performance\`

For top 10 vaults by TVL, analyze performance trends:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "timeRange": "30d",
  "responseFormat": "summary"
}
\`\`\`

### 2.3 Risk Distribution
**Tool**: \`analyze_risk\`

Sample risk scores across vault categories:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "responseFormat": "summary"
}
\`\`\`

Categorize vaults by risk level:
| Risk Level | Count | % of TVL |
|------------|-------|----------|
| Low (<30) | [N] | [X]% |
| Medium (30-60) | [N] | [X]% |
| High (>60) | [N] | [X]% |

## Step 3: KPI Framework

### Core Metrics Dashboard

| KPI | Current | Trend | Status |
|-----|---------|-------|--------|
| Total TVL | $[X]M | [+/-X]% | [GREEN/YELLOW/RED] |
| Active Vaults | [N] | [+/-N] | [GREEN/YELLOW/RED] |
| Avg Risk Score | [X] | [+/-X] | [GREEN/YELLOW/RED] |
| High-Risk Vaults | [N]% | [+/-X]% | [GREEN/YELLOW/RED] |

### Alert Conditions

**RED ALERT** (Immediate action required):
- TVL drop >10% in 24h
- Any vault risk score >80
- Vault with >$1M TVL showing anomalous activity
- APR dropping to 0% unexpectedly

**YELLOW WARNING** (Monitor closely):
- TVL drop >5% in 7d
- Vault risk score increased >20 points
- APR variance >30% from 30d average
- New vault with rapid TVL growth (potential instability)

**GREEN HEALTHY**:
- All metrics within thresholds
- Positive or stable TVL trend
- Risk scores stable or improving
- Consistent APR delivery

## Step 4: Report Generation

### Executive Summary Template
\`\`\`
LAGOON PROTOCOL HEALTH REPORT
=============================
Period: [Start Date] - [End Date]
Generated: [Timestamp]

KEY METRICS
-----------
Protocol TVL: $[X]M ([+/-X]% vs prior period)
Active Vaults: [N] ([+/-N] vs prior period)
Avg APR: [X]% ([+/-X]% vs prior period)
Avg Risk Score: [X]/100 ([+/-X] vs prior period)

TOP PERFORMERS (by TVL growth)
------------------------------
1. [Vault Name]: +$[X]M ([+X]%)
2. [Vault Name]: +$[X]M ([+X]%)
3. [Vault Name]: +$[X]M ([+X]%)

CONCERNS
--------
- [Issue 1 if any]
- [Issue 2 if any]

WATCHLIST
---------
- [Vault requiring attention]

RECOMMENDATIONS
---------------
- [Action 1]
- [Action 2]
\`\`\`

### Daily Standup Format
\`\`\`
Date: [YYYY-MM-DD]
TVL: $[X]M ([+/-X]% 24h)
Alerts: [None / List]
Focus: [Key item for today]
\`\`\`

### Weekly Summary Format
\`\`\`
Week of: [Date Range]

TVL TREND
- Start: $[X]M
- End: $[X]M
- Change: [+/-X]%

TOP PERFORMERS
1. [Vault]: [APR]% APR, $[TVL] TVL
2. [Vault]: [APR]% APR, $[TVL] TVL

WATCHLIST
- [Vault]: [Reason]

NEXT WEEK FOCUS
- [Priority 1]
- [Priority 2]
\`\`\`

## Communication Guidelines

### Internal Reporting Standards
- Use precise numbers, not approximations
- Include period-over-period comparisons
- Flag any data quality issues
- Note any vaults excluded from analysis and why
- Prioritize actionable insights over raw data
- Use tables for easy scanning
- Highlight anomalies prominently`;

/**
 * KPI thresholds resource
 */
const KPI_THRESHOLDS = `# KPI Thresholds Reference

## TVL Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| Protocol TVL Growth (7d) | >0% | -5% to 0% | <-5% |
| Protocol TVL Growth (30d) | >5% | 0% to 5% | <0% |
| Single Vault TVL Drop (24h) | <-5% | -5% to -15% | >-15% |
| Single Vault TVL Drop (7d) | <-10% | -10% to -30% | >-30% |
| Vault TVL Minimum | >$100K | $50K-$100K | <$50K |

## Risk Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| Avg Protocol Risk Score | <40 | 40-60 | >60 |
| High-Risk Vault % (score >60) | <10% | 10-20% | >20% |
| Risk Score Change (7d) | <+10 | +10 to +20 | >+20 |
| Max Single Vault Risk | <70 | 70-80 | >80 |

## Performance Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| APR Delivery Rate | >90% | 70-90% | <70% |
| APR Volatility (30d CV) | <20% | 20-40% | >40% |
| Vaults with APR = 0 | 0 | 1-2 | >2 |

## Activity Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| Daily Active Vaults | >80% | 60-80% | <60% |
| Weekly New Deposits | >10 | 5-10 | <5 |
| Deposit/Redemption Ratio | >0.8 | 0.5-0.8 | <0.5 |

## Escalation Procedures

### Red Alert Actions
1. Notify ops lead immediately via Slack #lagoon-alerts
2. Identify affected vaults and users
3. Prepare incident report within 1 hour
4. Schedule emergency review if systemic issue

### Yellow Warning Actions
1. Add to daily standup agenda
2. Monitor for escalation over 24-48 hours
3. Document in weekly report
4. Consider proactive user communication`;

/**
 * Report templates resource
 */
const REPORT_TEMPLATES = `# Report Templates

## Daily Standup Report

\`\`\`markdown
# Daily Protocol Health - [YYYY-MM-DD]

## Quick Stats
| Metric | Value | 24h Change |
|--------|-------|------------|
| TVL | $[X]M | [+/-X]% |
| Vaults | [N] | [+/-N] |
| Avg APR | [X]% | [+/-X]% |

## Alerts
- [List any red/yellow alerts or "No alerts"]

## Today's Focus
- [Key priority or "Business as usual"]

## Notes
- [Any relevant observations]
\`\`\`

## Weekly Summary Report

\`\`\`markdown
# Weekly Protocol Health Summary
Week: [Start Date] - [End Date]

## Executive Summary
[2-3 sentence overview of the week]

## KPI Dashboard
| KPI | Start | End | Change | Status |
|-----|-------|-----|--------|--------|
| TVL | $[X]M | $[X]M | [+/-X]% | [STATUS] |
| Vaults | [N] | [N] | [+/-N] | [STATUS] |
| Avg Risk | [X] | [X] | [+/-X] | [STATUS] |

## Top Performers
1. **[Vault Name]**: [Highlight]
2. **[Vault Name]**: [Highlight]

## Areas of Concern
- [Concern 1]
- [Concern 2]

## Watchlist for Next Week
- [Item 1]
- [Item 2]

## Action Items
- [ ] [Action 1]
- [ ] [Action 2]
\`\`\`

## Monthly Executive Report

\`\`\`markdown
# Monthly Protocol Health Report
Month: [Month Year]

## Executive Summary
[Paragraph summarizing month's performance]

## Key Metrics

### TVL Growth
- Start of Month: $[X]M
- End of Month: $[X]M
- Net Change: [+/-$X]M ([+/-X]%)
- Peak: $[X]M on [Date]
- Trough: $[X]M on [Date]

### Vault Activity
- Total Vaults: [N]
- New Vaults: [N]
- Inactive Vaults: [N]

### Performance Distribution
| APR Range | Vault Count | TVL Share |
|-----------|-------------|-----------|
| >20% | [N] | [X]% |
| 10-20% | [N] | [X]% |
| 5-10% | [N] | [X]% |
| <5% | [N] | [X]% |

### Risk Overview
| Risk Level | Vault Count | TVL Share |
|------------|-------------|-----------|
| Low (<30) | [N] | [X]% |
| Medium (30-60) | [N] | [X]% |
| High (>60) | [N] | [X]% |

## Highlights
- [Major achievement 1]
- [Major achievement 2]

## Incidents
- [Incident 1 if any, with resolution]

## Recommendations
1. [Strategic recommendation 1]
2. [Strategic recommendation 2]

## Next Month Focus
- [Priority 1]
- [Priority 2]
\`\`\`

## Ad-Hoc Investigation Template

\`\`\`markdown
# Investigation: [Issue Title]
Date: [YYYY-MM-DD]
Analyst: [Name]

## Issue Summary
[Brief description of the issue]

## Affected Components
- Vault(s): [List]
- Chain(s): [List]
- Users: [Estimate]

## Timeline
| Time | Event |
|------|-------|
| [Time] | [Event] |

## Analysis
[Detailed analysis]

## Root Cause
[Identified cause or "Under investigation"]

## Impact Assessment
- TVL Impact: $[X]
- User Impact: [Description]
- Reputation Impact: [Low/Medium/High]

## Recommended Actions
1. [Action 1]
2. [Action 2]

## Status
[Open/Resolved/Monitoring]
\`\`\``;

/**
 * Lagoon Protocol Health Skill Definition
 */
export const lagoonProtocolHealthSkill: LagoonSkill = {
  name: 'lagoon-protocol-health',
  description:
    'Monitor protocol-wide KPIs, identify TVL trends, generate executive summaries, and flag at-risk vaults for the internal operations team. Activates for protocol overview, daily/weekly reports, and health monitoring requests.',
  triggers: [
    'protocol health',
    'protocol metrics',
    'protocol kpi',
    'tvl trend',
    'protocol overview',
    'executive summary',
    'protocol report',
    'daily report',
    'weekly report',
    'monthly report',
    'protocol status',
    'vault growth',
    'protocol performance',
    'ops report',
    'operations report',
    'health check',
    'health dashboard',
    'kpi review',
    'how is lagoon doing',
    'protocol analytics',
  ],
  audience: 'internal-ops',
  instructions: INSTRUCTIONS,
  resources: {
    thresholds: KPI_THRESHOLDS,
    templates: REPORT_TEMPLATES,
  },
  metadata: {
    version: '1.0.0',
    category: 'operations',
    primaryTools: ['search_vaults', 'get_vault_performance', 'analyze_risk'],
    estimatedTokens: 2800,
    lastUpdated: '2024-12-15',
  },
};

export default lagoonProtocolHealthSkill;
