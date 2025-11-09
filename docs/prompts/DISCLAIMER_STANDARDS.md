# Disclaimer Standards for Lagoon MCP Prompts

## Purpose

This document establishes mandatory disclaimer standards for all Lagoon MCP prompts that provide financial analysis, investment guidance, or DeFi-related recommendations. These standards ensure legal protection, regulatory compliance, and user safety.

---

## 🔴 Critical Requirements

### 1. All Runtime Prompts MUST Include Disclaimers

**Requirement**: Every runtime prompt (in `src/prompts/`) providing financial analysis MUST include appropriate disclaimers.

**Implementation**: Import and include disclaimer blocks from `src/prompts/shared/disclaimers.ts`

**Verification**: No prompt should go to production without disclaimer integration.

---

## Disclaimer Component System

### Available Disclaimer Modules

Located in `src/prompts/shared/disclaimers.ts`:

| Module | Purpose | Required For |
|--------|---------|--------------|
| `UNIVERSAL_DISCLAIMER` | Legal protection, risk acknowledgment | ALL runtime prompts |
| `DEFI_SPECIFIC_RISKS` | Smart contract, gas, MEV, and DeFi risks | All DeFi analysis prompts |
| `REGULATORY_COMPLIANCE_NOTICE` | Securities law, tax, KYC/AML | All financial guidance prompts |
| `DATA_DISCLAIMER` | Data sources, freshness, limitations | All data-driven prompts |
| `BEGINNER_WARNINGS` | Critical warnings for new users | Onboarding prompts |
| `PORTFOLIO_DISCLAIMER` | Portfolio analysis limitations | Portfolio optimization prompts |
| `REPORT_FOOTER_DISCLAIMER` | Footer for user-facing outputs | All analysis reports |

### Helper Function

Use the `getDisclaimers()` helper for custom combinations:

```typescript
import { getDisclaimers } from './shared/disclaimers';

const disclaimers = getDisclaimers({
  universal: true,
  defi: true,
  regulatory: false,
  data: true,
  beginner: false,
  portfolio: false,
});
```

---

## Disclaimer Placement Standards

### 1. Runtime Prompt Structure

```typescript
import {
  UNIVERSAL_DISCLAIMER,
  DEFI_SPECIFIC_RISKS,
  // ... other disclaimer modules
} from './shared/disclaimers';

export function getExamplePrompt(): string {
  return `# Prompt Title

${UNIVERSAL_DISCLAIMER}

${DEFI_SPECIFIC_RISKS}

// ... prompt-specific disclaimers

## Your Role
[Prompt content begins here...]
`;
}
```

**Key Points**:
- Disclaimers appear IMMEDIATELY after title
- Universal disclaimer ALWAYS comes first
- DeFi risks come second (when applicable)
- Prompt-specific disclaimers follow
- Content begins AFTER all disclaimers

### 2. In-Context Reminder Placement

Add mini-disclaimers before high-risk analysis sections:

```markdown
### Portfolio Rebalancing Analysis

⚠️ **Reminder**: Rebalancing triggers taxable events. This is quantitative
analysis, not investment advice. Consult tax and financial professionals.

[Analysis content...]
```

### 3. Report Footer Placement

All user-facing analysis reports MUST include footer:

```typescript
import { REPORT_FOOTER_DISCLAIMER } from './shared/disclaimers';

// At end of analysis output:
${REPORT_FOOTER_DISCLAIMER}
```

---

## Communication Language Standards

### 🚫 PROHIBITED Language

**NEVER use**:
- "I recommend you invest..."
- "You should buy/sell..."
- "This is a good investment..."
- "Best choice for you is..."
- "Guaranteed returns..."
- "You must do..."
- "Immediate action required: buy..."

### ✅ REQUIRED Language

**ALWAYS use**:
- "Historical data shows..."
- "For educational purposes, consider..."
- "Quantitative analysis indicates..."
- "This vault's characteristics include..."
- "One analytical approach is..."
- "Past performance does not guarantee future results"
- "Consult qualified professionals before..."

### Language Transformation Examples

| ❌ WRONG | ✅ CORRECT |
|----------|------------|
| "I recommend you invest in Vault A" | "For educational purposes, analysis shows Vault A exhibits..." |
| "You should rebalance your portfolio" | "Historical data suggests portfolios with these characteristics..." |
| "This is the best vault for you" | "Based on the parameters provided, this vault's characteristics match..." |
| "Buy this vault immediately" | "This vault's metrics may be worth evaluating for..." |
| "Guaranteed 15% returns" | "Historical 30-day APR: 15% (past performance ≠ future results)" |

---

## Prompt-Specific Requirements

### Onboarding Prompts

**Required Disclaimers**:
- `UNIVERSAL_DISCLAIMER`
- `DEFI_SPECIFIC_RISKS`
- `BEGINNER_WARNINGS`
- `DATA_DISCLAIMER`

**Special Requirements**:
- Explicit "total loss risk" warning
- "Start small" guidance
- Tax obligations notice
- Jurisdictional compliance reminder

**Example**: `src/prompts/onboarding-first-vault.ts`

---

### Portfolio Optimization Prompts

**Required Disclaimers**:
- `UNIVERSAL_DISCLAIMER`
- `DEFI_SPECIFIC_RISKS`
- `PORTFOLIO_DISCLAIMER`
- `DATA_DISCLAIMER`

**Special Requirements**:
- Professional consultation notice for >$10K portfolios
- Tax implication warnings before rebalancing
- Modern Portfolio Theory limitation disclosure
- "Analysis not advice" framing throughout

**Example**: `src/prompts/portfolio-optimization.ts`

---

### Curator/Vault Analysis Prompts

**Required Disclaimers**:
- `UNIVERSAL_DISCLAIMER`
- `DEFI_SPECIFIC_RISKS`
- `DATA_DISCLAIMER`

**Special Requirements**:
- "Ratings are NOT endorsements" disclosure
- Conflict of interest mention (if applicable)
- Data source attribution
- Historical performance caveat

**Examples**:
- `src/prompts/curator-performance.ts`
- `src/prompts/competitor-comparison.ts`
- `src/prompts/protocol-overview.ts`

---

### Financial Analysis Prompts

**Required Disclaimers**:
- `UNIVERSAL_DISCLAIMER`
- `DEFI_SPECIFIC_RISKS`
- `DATA_DISCLAIMER`
- `REPORT_FOOTER_DISCLAIMER` (in outputs)

**Special Requirements**:
- Communication rules section
- Educational framing requirements
- Report footer for ALL outputs
- No investment advice language

**Example**: `src/prompts/financial-analysis.ts`

---

## Quality Control Checklist

### Pre-Production Verification

Before deploying any prompt to production, verify:

- [ ] **Universal Disclaimer**: Included at top
- [ ] **DeFi Risks**: Included for DeFi-related prompts
- [ ] **Prompt-Specific Disclaimers**: Relevant disclaimers added
- [ ] **Language Check**: No prohibited investment advice language
- [ ] **Educational Framing**: Uses "analysis" not "recommendation"
- [ ] **Report Footer**: Footer included for user outputs
- [ ] **In-Context Reminders**: High-risk sections have warnings
- [ ] **Professional Consultation**: Mentioned where appropriate
- [ ] **Data Limitations**: Data freshness and source noted

### Periodic Audit

Quarterly review of all prompts:

- [ ] Disclaimer content up-to-date with legal requirements
- [ ] Communication language compliant with standards
- [ ] New regulatory requirements incorporated
- [ ] User feedback on disclaimer clarity addressed
- [ ] Competitive analysis of industry disclaimer practices

---

## Legal Compliance Notes

### Regulatory Frameworks Addressed

1. **Securities Regulations**: Disclaimers address Howey Test considerations
2. **Investment Advisor Registration**: Clarifies service is NOT from registered advisors
3. **Tax Obligations**: Reminds users of tax reporting requirements
4. **Consumer Protection**: Includes risk disclosures and professional consultation notices
5. **Data Protection**: Addresses data limitations and user verification responsibilities

### Jurisdictional Considerations

Disclaimers are designed to be:
- **Jurisdiction-Agnostic**: Users reminded to check local laws
- **Comprehensive**: Covers major regulatory frameworks (SEC, CFTC, MiCA, etc.)
- **Conservative**: Errs on side of over-disclosure
- **User-Focused**: Emphasizes user responsibility for compliance

---

## Update Procedures

### When to Update Disclaimers

Update `src/prompts/shared/disclaimers.ts` when:
1. **Legal Review**: Legal counsel recommends changes
2. **Regulatory Changes**: New regulations affecting DeFi/cryptocurrency
3. **Incident Response**: Security incidents requiring new warnings
4. **User Feedback**: Clarity issues identified by users
5. **Industry Standards**: Best practices evolve in DeFi space

### Update Process

1. **Propose Changes**: Document rationale and affected areas
2. **Legal Review**: Obtain legal counsel approval if available
3. **Impact Assessment**: Identify all affected prompts
4. **Implementation**: Update `disclaimers.ts` and affected prompts
5. **Testing**: Verify disclaimer integration in outputs
6. **Documentation**: Update this standards document
7. **Deployment**: Roll out with changelog and communication

---

## Testing & Validation

### Automated Checks

Create automated tests to verify:

```typescript
describe('Disclaimer Standards', () => {
  test('All runtime prompts include UNIVERSAL_DISCLAIMER', () => {
    // Check all prompt files import and include universal disclaimer
  });

  test('DeFi prompts include DEFI_SPECIFIC_RISKS', () => {
    // Check DeFi-related prompts include DeFi risks
  });

  test('No prompts use prohibited language', () => {
    // Scan for "I recommend", "you should invest", etc.
  });

  test('All prompts use educational framing', () => {
    // Verify "analysis", "historical data", etc. usage
  });
});
```

### Manual Review Checklist

For each new/updated prompt:

- [ ] Disclaimers appear before content (not buried)
- [ ] Disclaimers are comprehensive for prompt type
- [ ] Language is educational, not advisory
- [ ] High-risk sections have in-context reminders
- [ ] User outputs include report footer
- [ ] Mobile/web rendering tested (disclaimer visibility)

---

## Examples & Templates

### Minimal Prompt Template

```typescript
import { UNIVERSAL_DISCLAIMER, DEFI_SPECIFIC_RISKS } from './shared/disclaimers';

export function getMinimalPrompt(): string {
  return `# Minimal Prompt Title

${UNIVERSAL_DISCLAIMER}

${DEFI_SPECIFIC_RISKS}

## Your Role
You are an analytical tool providing educational information about...
[Content...]
`;
}
```

### Comprehensive Prompt Template

```typescript
import {
  UNIVERSAL_DISCLAIMER,
  DEFI_SPECIFIC_RISKS,
  REGULATORY_COMPLIANCE_NOTICE,
  DATA_DISCLAIMER,
  BEGINNER_WARNINGS,
  REPORT_FOOTER_DISCLAIMER,
} from './shared/disclaimers';

export function getComprehensivePrompt(): string {
  return `# Comprehensive Prompt Title

${UNIVERSAL_DISCLAIMER}

${DEFI_SPECIFIC_RISKS}

${REGULATORY_COMPLIANCE_NOTICE}

${DATA_DISCLAIMER}

${BEGINNER_WARNINGS}

## Your Role
You are an analytical tool...

## Communication Standards

**NEVER use**: "I recommend", "you should invest"
**ALWAYS use**: "Historical data shows", "for educational purposes"

## Report Footer

Include in all outputs:
${REPORT_FOOTER_DISCLAIMER}

[Content...]
`;
}
```

---

## Contact & Support

**Questions about disclaimer standards**: Consult legal counsel or project maintainers

**Reporting Issues**: If you identify disclaimer gaps or compliance concerns, report immediately

**Continuous Improvement**: Disclaimer standards evolve - stay updated with latest guidance

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Next Review**: Quarterly or upon regulatory changes
**Owner**: Lagoon MCP Legal & Compliance Team
