# Lagoon Skills

Claude Skills that enhance the Lagoon MCP with procedural knowledge and domain expertise.

## What are Skills?

Skills are specialized instruction sets that teach Claude HOW to use MCP tools effectively. While MCP provides data connectivity (tools to fetch vault data, analyze risk, etc.), Skills provide procedural knowledge (when to use which tool, how to interpret results for different audiences).

**MCP (Data Layer)** + **Skills (Knowledge Layer)** = **Domain Expert Experience**

## Available Skills

### Customer-Facing Skills

| Skill | Audience | Purpose | Status |
|-------|----------|---------|--------|
| `lagoon-onboarding` | New Users | Guide new users to first vault selection | Active |
| `lagoon-portfolio-review` | Existing Users | Quarterly portfolio health checks | Active |
| `lagoon-risk-expert` | Advanced Users | Comprehensive risk evaluation | Active |

### Internal Team Skills

| Skill | Audience | Purpose | Status |
|-------|----------|---------|--------|
| `lagoon-protocol-health` | Operations | Daily/weekly KPI monitoring | Active |
| `lagoon-curator-evaluation` | Business Development | Partnership assessment with scoring | Active |
| `lagoon-customer-support` | Support Team | Support response templates | Active |

## Skill Structure

Each skill follows the Claude Skills specification:

```
skill-name/
├── SKILL.md              # Required: Main instructions with YAML frontmatter
└── [optional files]      # Supporting resources, examples, scripts
```

### SKILL.md Format

```yaml
---
name: skill-name
description: Clear description of purpose and activation triggers
---

# Skill Title

[Instructions that Claude follows when this skill is active]

## When This Skill Activates
[Trigger conditions]

## Workflow
[Step-by-step procedures]

## Communication Guidelines
[Tone, language, disclaimers]
```

## Using Skills

### With Claude.ai

1. Navigate to Settings > Features > Skills
2. Upload the skill folder or individual SKILL.md
3. Skills activate automatically based on conversation context

### With Claude Code

```bash
# Install from marketplace (when available)
/plugin marketplace add lagoon/skills

# Or install locally
/plugin install ./skills/lagoon-onboarding
```

### With Claude Desktop

Add to your Claude configuration:

```json
{
  "skills": [
    {
      "path": "/path/to/lagoon-mcp/skills/lagoon-onboarding"
    }
  ]
}
```

## Relationship to MCP Prompts

The Lagoon MCP includes 6 prompts that provide guidance frameworks. Skills extend this by:

1. **Adding procedural detail**: Exact tool sequences and parameters
2. **Adapting to audiences**: Different guidance for beginners vs experts
3. **Progressive loading**: Skills load only when relevant (~100 tokens initially)
4. **Supporting resources**: Additional files for complex workflows

### Migration Path

| MCP Prompt | Recommended Skill | Enhancement |
|------------|-------------------|-------------|
| `onboarding-first-vault` | `lagoon-onboarding` | Full workflow, profile assessment |
| `financial-analysis` | `lagoon-portfolio-review` | Structured review process |
| `curator-performance` | `lagoon-curator-evaluation` | Scoring rubric, deal-breakers |
| `protocol-overview` | `lagoon-protocol-health` | KPI thresholds, alerting |
| `portfolio-optimization` | `lagoon-portfolio-review` | MPT strategy guidance |
| `competitor-comparison` | (future) | Methodology, data sources |

## Creating New Skills

1. Create a folder: `skills/your-skill-name/`
2. Add `SKILL.md` with frontmatter and instructions
3. Add supporting resources as needed
4. Test with Claude to verify activation triggers

### Best Practices

- **Clear triggers**: Define specific activation conditions
- **Tool sequences**: Document exact tool workflows
- **User profiles**: Adapt guidance to different audience levels
- **Disclaimers**: Include appropriate legal/risk disclaimers
- **Examples**: Provide sample conversations and outputs

## Maintenance

Skills should be versioned alongside the MCP:
- Update tool references when MCP tools change
- Review and update risk thresholds periodically
- Add new skills based on user feedback and usage patterns

## Contributing

When creating new skills:
1. Follow the existing structure and naming conventions
2. Include comprehensive activation triggers
3. Test with real MCP tool outputs
4. Document any dependencies on specific MCP versions
