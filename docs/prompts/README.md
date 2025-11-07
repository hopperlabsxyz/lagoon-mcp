# Analytical Prompts & Frameworks

This directory contains analytical guidance and frameworks for using Lagoon protocol tools effectively. These prompts provide structured approaches to financial analysis, portfolio management, and vault evaluation.

## Purpose & Scope

**What's in this directory:**
- 📊 **Analytical frameworks** - How to analyze DeFi vault data
- 🎯 **Best practices** - Professional financial analysis standards
- 📝 **Report templates** - Structured output formats
- 🔍 **Interpretation guides** - Understanding financial metrics

**What's NOT in this directory:**
- Tool capabilities and parameters → See [`/docs/tools/`](/docs/tools/)
- API schemas and return formats → See individual tool documentation
- Implementation details → See source code

## Available Prompts

### Financial Analysis Framework
**File**: [`financial-analysis.md`](./financial-analysis.md)

Comprehensive framework for analyzing DeFi vaults, portfolios, and yield strategies.

**Key Frameworks:**
- **Portfolio Analysis Pattern** - Multi-vault position analysis and optimization
- **Vault Performance Analysis Pattern** - Historical trends and benchmarking
- **Vault Discovery Pattern** - Finding suitable investment opportunities
- **Risk Assessment Framework** - Multi-factor risk evaluation

**Use Cases:**
- Portfolio performance review and rebalancing recommendations
- Individual vault due diligence and evaluation
- Yield farming strategy optimization
- Risk-adjusted return analysis

**Related Tools**: All 13 tools documented in [`/docs/tools/`](/docs/tools/)

---

### Curator Performance Intelligence
**File**: [`curator-performance-intelligence.md`](./curator-performance-intelligence.md)

Comprehensive framework for evaluating curator performance, reputation, and vault management capabilities.

**Key Features:**
- **Performance Metrics** - Weighted APR, Sharpe ratio, risk-adjusted returns
- **Reputation Scoring** - 0-100 composite score across 6 trust factors
- **Comparative Rankings** - Percentile rankings and peer comparisons
- **Trust Signals** - Positive indicators and warning signs framework
- **Decision Framework** - Curator selection checklists and use case matching

**Use Cases:**
- Data-driven curator selection for new investments
- Ongoing curator performance monitoring
- Identifying top-performing vs underperforming curators
- Risk assessment of curator relationships

**Related Tools**: `query_graphql`, `search_vaults`, `get_vault_data`, `get_vault_performance`, `compare_vaults`, `analyze_risk`

---

### Competitor Comparison Framework
**File**: [`competitor-comparison-framework.md`](./competitor-comparison-framework.md)

Objective comparison of Lagoon Protocol against major competitors (Gauntlet, Veda, Ether.fi).

**Key Features:**
- **Financial Comparison** - TVL, APR, fee structures, cost-adjusted returns
- **Platform Scale** - Vault diversity, network support, user base analysis
- **Features Matrix** - Risk management, discovery tools, automation capabilities
- **Security Analysis** - Audit coverage, incident history, trust indicators
- **Composite Scoring** - Weighted category scores for platform ranking

**Use Cases:**
- Platform evaluation before committing capital
- Competitive positioning analysis
- Migration decision support (moving between platforms)
- Scenario-based platform recommendations

**Related Tools**: `query_graphql`, `search_vaults`, `get_vault_performance`, `compare_vaults`, `analyze_risk`

---

### Onboarding Guide: First Vault Selection
**File**: [`onboarding-first-vault.md`](./onboarding-first-vault.md)

Structured guidance for new users making their first vault deposit with confidence.

**Key Features:**
- **Profile Assessment** - Risk tolerance, timeline, amount, and goals questionnaire
- **5-Step Selection Process** - Discovery, risk analysis, performance validation, curator check, projection
- **Decision Framework** - Scoring system for vault evaluation (0-40 scale)
- **Best Practices** - Common beginner mistakes and recommended approaches
- **Monitoring Guide** - Post-selection tracking and exit signals

**Use Cases:**
- New DeFi user onboarding workflows
- First-time vault deposit guidance
- Risk-appropriate vault selection
- Building confidence in investment decisions

**Related Tools**: `search_vaults`, `analyze_risk`, `get_vault_performance`, `query_graphql`, `simulate_vault`

---

### Protocol Overview & KPI Dashboard
**File**: [`protocol-overview-kpi-dashboard.md`](./protocol-overview-kpi-dashboard.md)

Real-time protocol health insights and competitive positioning for informed platform usage decisions.

**Key Features:**
- **Core KPIs** - TVL, vault count, user growth, volume metrics
- **Ecosystem Health** - Curator metrics, security track record, risk distribution
- **Competitive Analysis** - Market positioning vs Gauntlet, Veda, Ether.fi
- **Health Scoring** - 0-100 composite protocol health score
- **Growth Trends** - 7d, 30d, 90d trend analysis with visualizations

**Use Cases:**
- Platform health evaluation before depositing funds
- Monitoring protocol growth and adoption trends
- Competitive intelligence and market positioning
- Risk assessment through ecosystem health indicators

**Related Tools**: `query_graphql`, `search_vaults`, `get_vault_performance`, `compare_vaults`, `analyze_risk`

---

### Portfolio Optimization Engine
**File**: [`portfolio-optimization-engine.md`](./portfolio-optimization-engine.md)

AI-powered portfolio optimization based on modern portfolio theory for maximizing risk-adjusted returns.

**Key Features:**
- **Multiple Optimization Strategies** - Maximum Sharpe, Risk Parity, Minimum Variance, Maximum Return, Maximum Diversification
- **Modern Portfolio Theory** - Expected returns, volatility, Sharpe ratios, efficient frontier
- **Correlation Analysis** - Vault return correlations and diversification metrics
- **Rebalancing Recommendations** - Systematic allocation adjustments with cost-benefit analysis
- **Scenario Analysis** - Best/expected/worst case projections with risk metrics

**Use Cases:**
- Systematic portfolio rebalancing for $10K+ portfolios
- Maximizing risk-adjusted returns through optimization
- Diversification analysis and improvement
- Transaction cost vs benefit analysis
- Quarterly portfolio optimization reviews

**Related Tools**: `user_portfolio`, `compare_vaults`, `analyze_risk`, `vault_performance`, `simulate_vault`

---

### Advanced Analysis Patterns
**File**: [`analysis-patterns.md`](./analysis-patterns.md)

*Coming soon: Advanced techniques for complex analysis scenarios*

---

## Documentation Architecture

Our documentation follows a clear separation of concerns:

```
/docs/
  ├── tools/              ← "What tools can do"
  │   ├── README.md       (Tool catalog & quick reference)
  │   ├── analyze-risk.md (Risk scoring capabilities)
  │   ├── simulate-vault.md (Simulation parameters)
  │   └── ... (11 more tool docs)
  │
  └── prompts/            ← "How to analyze data"
      ├── README.md       (This file - prompt catalog)
      ├── financial-analysis.md (Analytical frameworks)
      └── analysis-patterns.md (Advanced techniques)

/src/prompts/
  └── financial-analysis.ts  ← "Runtime instructions for Claude"
```

### Separation of Concerns

| Directory | Focus | Audience | Update Frequency |
|-----------|-------|----------|------------------|
| `/docs/tools/` | Tool capabilities, parameters, schemas | Developers & Users | When tools change |
| `/docs/prompts/` | Analysis techniques, frameworks | Analysts & Users | When patterns evolve |
| `/src/prompts/` | Runtime AI instructions | Claude (internal) | As prompts improve |

**Key Principle**: Tool documentation should remain stable (capabilities don't change often), while analytical frameworks can evolve based on usage patterns and feedback.

---

## Using These Prompts

### For End Users
These prompts demonstrate how to structure queries and interpret results when using Lagoon protocol tools.

**Example workflow:**
1. Read [`financial-analysis.md`](./financial-analysis.md) to understand analysis frameworks
2. Reference [`/docs/tools/`](/docs/tools/) for specific tool capabilities
3. Apply the frameworks to your investment analysis needs

### For Developers
These prompts show the analytical patterns that Claude uses to generate insights.

**Integration:**
```typescript
import { getFinancialAnalysisPrompt } from './src/prompts/financial-analysis';

// Runtime prompt references this documentation
const prompt = getFinancialAnalysisPrompt();
```

### For AI Systems
Runtime prompts in `/src/prompts/` reference this documentation to:
- Provide consistent analytical approaches
- Apply domain-specific best practices
- Generate structured, professional reports

---

## Related Documentation

- **Tool Capabilities**: [`/docs/tools/README.md`](/docs/tools/README.md)
- **Tool-Specific Docs**: [`/docs/tools/`](/docs/tools/) (13 comprehensive guides)
- **API Reference**: [Coming soon]

---

## Contributing

When adding new prompts:

1. **Create the prompt file** in `/docs/prompts/`
2. **Add entry to this README** with description and use cases
3. **Cross-reference tools** used by the prompt
4. **Update `/docs/tools/`** to reference the new prompt where relevant
5. **Create runtime version** in `/src/prompts/` if needed

### Prompt Quality Standards

✅ **Good prompts should:**
- Focus on analytical patterns and interpretation
- Reference tool documentation rather than duplicating it
- Provide concrete examples with expected outputs
- Include best practices and common pitfalls
- Use consistent formatting and terminology

❌ **Avoid:**
- Duplicating tool parameter descriptions
- Embedding API schemas or return formats
- Implementation-specific details
- Outdated or stale information

---

## Feedback & Improvements

Have suggestions for improving these analytical frameworks? Please open an issue or submit a pull request.

**Common improvement areas:**
- New analysis patterns for specific use cases
- Enhanced interpretation guidelines
- Additional examples and templates
- Cross-domain analysis techniques

---

*Last updated: 2025*
*Part of the Lagoon MCP documentation ecosystem*
