# Analytical Prompts Documentation

## Overview

This directory contains documentation for Lagoon MCP analytical prompts. **The actual prompt logic lives in runtime TypeScript files** (`src/prompts/`), which are self-explanatory and contain complete implementation details.

**Documentation Purpose:**
- 📋 **Legal compliance** - Mandatory disclaimer standards
- 🎯 **High-level concepts** - Core analytical frameworks
- 🔗 **Navigation** - Links to runtime prompts

**Not in this directory:**
- Implementation details → See `src/prompts/*.ts`
- Tool capabilities → See [`/docs/tools/`](/docs/tools/)
- API schemas → See individual tool documentation

---

## 🔴 Legal Requirements

### Disclaimer Standards
**File**: [`DISCLAIMER_STANDARDS.md`](./DISCLAIMER_STANDARDS.md)

**Critical legal framework** for all financial analysis prompts. Covers:
- Universal & DeFi-specific disclaimers
- Communication language standards (prohibited vs. required framing)
- Regulatory compliance requirements
- Quality control and audit procedures

**Applies to**: ALL runtime prompts in `src/prompts/` providing financial analysis

---

## 📊 Analytical Framework

### Financial Analysis Concepts
**File**: [`financial-analysis.md`](./financial-analysis.md)

High-level analytical frameworks and interpretation guidelines for DeFi vault analysis.

**Covers**:
- Risk assessment frameworks (LOW/MEDIUM/HIGH categories)
- Metric interpretation (APR, TVL, capacity, volume)
- Analysis best practices
- Report structure templates

**For detailed methodologies**: See runtime prompts in `src/prompts/`

---

## 🔗 Runtime Prompts

The following prompts are implemented as self-explanatory TypeScript files in `src/prompts/`:

### Core Analysis Prompts

**[`financial-analysis.ts`](../src/prompts/financial-analysis.ts)** - Comprehensive DeFi vault analysis
- Portfolio analysis, performance evaluation, vault discovery patterns
- Tools: All 13 MCP tools for complete financial analysis

**[`curator-performance-intelligence.ts`](../src/prompts/curator-performance-intelligence.ts)** - Curator evaluation framework
- Performance metrics, reputation scoring, trust signals
- Tools: `query_graphql`, `search_vaults`, `get_vault_performance`, `analyze_risk`

**[`competitor-comparison-framework.ts`](../src/prompts/competitor-comparison-framework.ts)** - Platform comparison analysis
- Objective comparison vs. Gauntlet, Veda, Ether.fi
- Tools: `query_graphql`, `search_vaults`, `compare_vaults`

**[`onboarding-first-vault.ts`](../src/prompts/onboarding-first-vault.ts)** - New user vault selection guide
- 5-step selection process, risk assessment, monitoring guidance
- Tools: `search_vaults`, `analyze_risk`, `simulate_vault`

**[`protocol-overview-kpi-dashboard.ts`](../src/prompts/protocol-overview-kpi-dashboard.ts)** - Protocol health monitoring
- Real-time KPIs, ecosystem health, competitive positioning
- Tools: `query_graphql`, `search_vaults`, `get_vault_performance`

**[`portfolio-optimization-engine.ts`](../src/prompts/portfolio-optimization-engine.ts)** - Modern portfolio theory optimization
- Multiple strategies, correlation analysis, rebalancing recommendations
- Tools: `user_portfolio`, `compare_vaults`, `analyze_risk`, `simulate_vault`



---

## Documentation Philosophy

**Two-Layer System:**

1. **Documentation** (`docs/prompts/`) - Human-readable guidance
   - Legal compliance standards
   - High-level analytical concepts
   - Navigation and reference

2. **Runtime Prompts** (`src/prompts/`) - Self-explanatory AI instructions
   - Complete implementation logic
   - Detailed methodologies
   - Production-ready specifications

**Principle**: Prompts are self-explanatory in code. Documentation focuses on legal requirements and high-level concepts, not runtime logic duplication.

---

## Usage Guide

**For Analysts & Users:**
1. Read [`DISCLAIMER_STANDARDS.md`](./DISCLAIMER_STANDARDS.md) for legal framework
2. Review [`financial-analysis.md`](./financial-analysis.md) for high-level concepts
3. Reference runtime prompts in `src/prompts/` for detailed methodologies
4. See [`/docs/tools/`](/docs/tools/) for tool capabilities

**For Developers:**
1. **Legal compliance**: ALL prompts must follow `DISCLAIMER_STANDARDS.md`
2. **Implementation**: Prompts in `src/prompts/` are self-documenting
3. **Best practices**: Reference `financial-analysis.md` for framework patterns

---

## Contributing

When adding new prompts:

1. **Create runtime prompt** in `src/prompts/` (self-explanatory implementation)
2. **Add entry to this README** (one-line description + link)
3. **Ensure disclaimer compliance** following `DISCLAIMER_STANDARDS.md`
4. **Update tool docs** if introducing new tool usage patterns

**Quality Standards:**
- ✅ Runtime prompts are self-contained and self-explanatory
- ✅ Disclaimer compliance is mandatory
- ✅ Documentation avoids duplicating runtime logic
- ❌ Don't create separate .md files for each prompt (use runtime .ts files)

---

## Related Documentation

- **Tool Capabilities**: [`/docs/tools/README.md`](/docs/tools/README.md)
- **Runtime Prompts**: [`/src/prompts/`](../src/prompts/)

---

*Last updated: 2025-11-09*
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
