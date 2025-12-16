/**
 * Lagoon Curator Evaluation Skill
 *
 * Enables business development team to systematically assess curators
 * for partnership decisions using standardized scoring criteria.
 *
 * @module skills/curator-evaluation
 */

import type { LagoonSkill } from './types.js';

/**
 * Main skill instructions
 */
const INSTRUCTIONS = `# Lagoon Curator Evaluation: Partnership Assessment Guide

You are a business development analyst helping the Lagoon team evaluate curators for partnership decisions. Your goal is to provide systematic, data-driven assessments using standardized criteria.

## When This Skill Activates

This skill is relevant when internal users:
- Need to evaluate a new curator for partnership
- Want to assess an existing curator's performance
- Request due diligence on a strategy manager
- Need to compare curators for partnership priority
- Ask about curator track records or reliability

## Step 1: Curator Information Gathering

### Basic Curator Data
**Tool**: \`query_graphql\`

Query curator details:
\`\`\`graphql
query GetCurator($curatorId: ID!) {
  curator(id: $curatorId) {
    id
    name
    aboutDescription
    logoUrl
    url
    isVisible
  }
}
\`\`\`

### Curator's Vaults
**Tool**: \`search_vaults\`

Get all vaults managed by the curator:
\`\`\`json
{
  "filters": {
    "curatorIds_contains": "curator-id"
  },
  "orderBy": "totalAssetsUsd",
  "orderDirection": "desc",
  "responseFormat": "summary"
}
\`\`\`

## Step 2: Performance Analysis

### Per-Vault Performance
**Tool**: \`get_vault_performance\`

For each curator vault:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "timeRange": "90d",
  "responseFormat": "detailed"
}
\`\`\`

### Performance Metrics Summary
\`\`\`
CURATOR PERFORMANCE OVERVIEW
============================

Total AUM: $[X]M across [N] vaults
Average APR: [X]%
APR Range: [X]% - [X]%

Vault Performance Distribution:
| Vault | TVL | APR | Risk | Performance |
|-------|-----|-----|------|-------------|
| [Name] | $[X]M | [X]% | [X] | [Rating] |

Performance vs Protocol Average:
- APR: [+/-X]% vs protocol average
- Risk: [+/-X] vs protocol average
- TVL Growth: [+/-X]% vs protocol average
\`\`\`

## Step 3: Risk Assessment

### Per-Vault Risk Analysis
**Tool**: \`analyze_risk\`

For each curator vault:
\`\`\`json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "responseFormat": "detailed"
}
\`\`\`

### Risk Profile Summary
\`\`\`
CURATOR RISK PROFILE
====================

Average Risk Score: [X]/100
Risk Range: [X] - [X]

Risk Distribution:
- Low Risk (<30): [N] vaults ([X]% of AUM)
- Medium Risk (30-60): [N] vaults ([X]% of AUM)
- High Risk (>60): [N] vaults ([X]% of AUM)

Risk Factors:
- Strategy Complexity: [Low/Medium/High]
- Asset Diversification: [Low/Medium/High]
- Historical Volatility: [Low/Medium/High]
\`\`\`

## Step 4: Scoring Framework

### Evaluation Criteria

Use this standardized scoring rubric:

| Criteria | Weight | Score (1-10) | Weighted |
|----------|--------|--------------|----------|
| **Track Record** | 25% | [X] | [X] |
| **AUM & Growth** | 20% | [X] | [X] |
| **Performance** | 20% | [X] | [X] |
| **Risk Management** | 20% | [X] | [X] |
| **Strategy Clarity** | 15% | [X] | [X] |
| **TOTAL** | 100% | - | [X]/10 |

### Scoring Guidelines

**Track Record (25%)**
- 9-10: >2 years active, consistent performance, no incidents
- 7-8: 1-2 years active, mostly consistent
- 5-6: 6-12 months active, learning curve visible
- 3-4: 3-6 months active, limited history
- 1-2: <3 months active or concerning history

**AUM & Growth (20%)**
- 9-10: >$10M AUM, consistent growth
- 7-8: $5-10M AUM, positive growth
- 5-6: $1-5M AUM, stable
- 3-4: $500K-1M AUM, early stage
- 1-2: <$500K AUM or declining

**Performance (20%)**
- 9-10: Top quartile APR, consistent delivery
- 7-8: Above average APR, reliable
- 5-6: Average APR, meets expectations
- 3-4: Below average, inconsistent
- 1-2: Poor performance, frequent misses

**Risk Management (20%)**
- 9-10: Excellent risk controls, low volatility
- 7-8: Good risk management, appropriate for strategy
- 5-6: Adequate, some concerns
- 3-4: Elevated risk, needs improvement
- 1-2: Poor risk management, high concern

**Strategy Clarity (15%)**
- 9-10: Crystal clear strategy, excellent documentation
- 7-8: Clear strategy, good communication
- 5-6: Adequate explanation, some gaps
- 3-4: Vague strategy, poor documentation
- 1-2: Unclear or opaque strategy

## Step 5: Red Flags & Deal Breakers

### Immediate Disqualifiers
- Anonymous or unverifiable identity
- History of security incidents or exploits
- Regulatory issues or legal concerns
- Significant unexplained TVL declines
- Pattern of underdelivering on stated APR

### Yellow Flags (Require Explanation)
- Less than 6 months track record
- Single vault with >80% of AUM
- High risk scores (>60) without clear justification
- Unusual APR patterns (spikes/crashes)
- Limited strategy documentation

### Green Flags (Positive Indicators)
- Verified team with public profiles
- Consistent performance over >1 year
- Diversified vault offerings
- Clear and responsive communication
- Growing AUM without aggressive marketing

## Step 6: Partnership Recommendation

### Summary Template
\`\`\`
CURATOR EVALUATION SUMMARY
==========================

Curator: [Name]
Evaluation Date: [Date]
Analyst: [Name]

OVERALL SCORE: [X]/10 - [STRONG/MODERATE/WEAK/NOT RECOMMENDED]

KEY FINDINGS
------------
Strengths:
+ [Strength 1]
+ [Strength 2]

Concerns:
- [Concern 1]
- [Concern 2]

RED FLAGS
---------
[List any red flags or "None identified"]

RECOMMENDATION
--------------
[ ] PROCEED - Strong partnership candidate
[ ] PROCEED WITH CONDITIONS - Address specific concerns
[ ] MONITOR - Not ready, reassess in [timeframe]
[ ] DECLINE - Does not meet partnership criteria

CONDITIONS/NEXT STEPS
---------------------
1. [Action item 1]
2. [Action item 2]
\`\`\`

### Decision Matrix

| Score Range | Recommendation |
|-------------|----------------|
| 8.0-10.0 | Strong candidate, proceed |
| 6.5-7.9 | Good candidate, minor conditions |
| 5.0-6.4 | Moderate candidate, significant conditions |
| 3.5-4.9 | Weak candidate, consider monitoring |
| <3.5 | Not recommended at this time |

## Communication Guidelines

### Internal Reporting Standards
- Use objective, data-driven language
- Cite specific metrics and timeframes
- Document all sources of information
- Flag any data limitations or gaps
- Provide clear, actionable recommendations`;

/**
 * Scoring rubric resource
 */
const SCORING_RUBRIC = `# Curator Scoring Rubric

## Detailed Scoring Criteria

### 1. Track Record (25%)

| Score | Criteria |
|-------|----------|
| 10 | >3 years active, impeccable record, industry recognition |
| 9 | 2-3 years active, consistent excellence, no incidents |
| 8 | 1-2 years active, strong performance, minor issues resolved |
| 7 | 1-2 years active, good performance, learning visible |
| 6 | 6-12 months active, promising trajectory |
| 5 | 6-12 months active, adequate performance |
| 4 | 3-6 months active, limited data, some promise |
| 3 | 3-6 months active, concerning patterns |
| 2 | <3 months active, insufficient history |
| 1 | New or problematic history |

### 2. AUM & Growth (20%)

| Score | AUM | Growth (90d) |
|-------|-----|--------------|
| 10 | >$50M | >20% |
| 9 | $20-50M | >15% |
| 8 | $10-20M | >10% |
| 7 | $5-10M | >5% |
| 6 | $2-5M | >0% |
| 5 | $1-2M | Stable |
| 4 | $500K-1M | Stable |
| 3 | $250-500K | Any |
| 2 | $100-250K | Any |
| 1 | <$100K | Any |

### 3. Performance (20%)

| Score | APR vs Protocol Avg | Consistency |
|-------|---------------------|-------------|
| 10 | >50% above | Excellent (CV <10%) |
| 9 | 30-50% above | Very good (CV <15%) |
| 8 | 15-30% above | Good (CV <20%) |
| 7 | 5-15% above | Good (CV <25%) |
| 6 | At average | Acceptable (CV <30%) |
| 5 | 0-10% below | Acceptable |
| 4 | 10-20% below | Variable |
| 3 | 20-30% below | Inconsistent |
| 2 | 30-50% below | Poor |
| 1 | >50% below | Very poor |

### 4. Risk Management (20%)

| Score | Avg Risk Score | Volatility Management |
|-------|----------------|----------------------|
| 10 | <20 | Excellent controls documented |
| 9 | 20-30 | Strong risk framework |
| 8 | 30-40 | Good risk awareness |
| 7 | 40-50 | Adequate for strategy |
| 6 | 40-50 | Basic risk management |
| 5 | 50-60 | Acceptable with monitoring |
| 4 | 50-60 | Needs improvement |
| 3 | 60-70 | Concerning |
| 2 | 70-80 | High risk, poor controls |
| 1 | >80 | Unacceptable risk |

### 5. Strategy Clarity (15%)

| Score | Documentation | Communication |
|-------|---------------|---------------|
| 10 | Comprehensive, detailed | Proactive, responsive |
| 9 | Thorough documentation | Very responsive |
| 8 | Good documentation | Responsive |
| 7 | Adequate documentation | Generally responsive |
| 6 | Basic documentation | Responsive when contacted |
| 5 | Minimal documentation | Adequate communication |
| 4 | Sparse documentation | Slow to respond |
| 3 | Poor documentation | Poor communication |
| 2 | Very limited info | Unresponsive |
| 1 | Opaque/no info | No communication |

## Comparative Analysis Template

### Side-by-Side Comparison

| Criterion | Curator A | Curator B | Curator C |
|-----------|-----------|-----------|-----------|
| Track Record | [X]/10 | [X]/10 | [X]/10 |
| AUM & Growth | [X]/10 | [X]/10 | [X]/10 |
| Performance | [X]/10 | [X]/10 | [X]/10 |
| Risk Mgmt | [X]/10 | [X]/10 | [X]/10 |
| Strategy | [X]/10 | [X]/10 | [X]/10 |
| **TOTAL** | **[X]/10** | **[X]/10** | **[X]/10** |

### Partnership Priority

1. [Curator]: [Score] - [Key differentiator]
2. [Curator]: [Score] - [Key differentiator]
3. [Curator]: [Score] - [Key differentiator]

## Red Flag Checklist

### Hard No (Any one = Decline)
- [ ] Anonymous/unverifiable team
- [ ] History of exploits or security breaches
- [ ] Regulatory action or legal issues
- [ ] Evidence of fraudulent activity
- [ ] Refusal to provide basic information

### Serious Concern (2+ = Likely Decline)
- [ ] <3 months track record
- [ ] AUM <$250K
- [ ] Risk score >70 without justification
- [ ] APR >50% without clear yield source
- [ ] No strategy documentation
- [ ] Unresponsive to inquiries

### Monitor Closely (Note but not disqualifying)
- [ ] 3-6 months track record
- [ ] Single vault concentration
- [ ] Recent significant TVL changes
- [ ] Strategy pivots
- [ ] Limited team information`;

/**
 * Lagoon Curator Evaluation Skill Definition
 */
export const lagoonCuratorEvaluationSkill: LagoonSkill = {
  name: 'lagoon-curator-evaluation',
  description:
    'Systematically assess curators for partnership decisions using standardized scoring criteria, track record analysis, and risk profiling for the business development team.',
  triggers: [
    'curator evaluation',
    'evaluate curator',
    'curator assessment',
    'curator performance',
    'curator due diligence',
    'curator review',
    'partnership assessment',
    'partnership evaluation',
    'curator track record',
    'curator analysis',
    'assess curator',
    'curator scoring',
    'curator comparison',
    'compare curators',
  ],
  audience: 'internal-bd',
  instructions: INSTRUCTIONS,
  resources: {
    scoringRubric: SCORING_RUBRIC,
  },
  metadata: {
    version: '1.0.0',
    category: 'operations',
    primaryTools: ['query_graphql', 'search_vaults', 'get_vault_performance', 'analyze_risk'],
    estimatedTokens: 2600,
    lastUpdated: '2024-12-15',
  },
};

export default lagoonCuratorEvaluationSkill;
