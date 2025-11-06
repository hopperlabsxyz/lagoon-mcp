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
