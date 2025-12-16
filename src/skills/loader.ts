/**
 * Skill Loader and Detection Utilities
 *
 * Provides utilities for loading skills programmatically and detecting
 * which skill is relevant for a given user message.
 *
 * @module skills/loader
 */

import type {
  BuildPromptOptions,
  BuildPromptResult,
  LagoonSkill,
  SkillDetectionResult,
  SkillLoadOptions,
  SkillRegistry,
} from './types.js';
import { lagoonOnboardingSkill } from './onboarding.js';
import { lagoonProtocolHealthSkill } from './protocol-health.js';
import { lagoonPortfolioReviewSkill } from './portfolio-review.js';
import { lagoonCuratorEvaluationSkill } from './curator-evaluation.js';
import { lagoonRiskExpertSkill } from './risk-expert.js';
import { lagoonCustomerSupportSkill } from './customer-support.js';

/**
 * All registered skills
 * Add new skills here as they are implemented
 */
const ALL_SKILLS: LagoonSkill[] = [
  lagoonOnboardingSkill,
  lagoonProtocolHealthSkill,
  lagoonPortfolioReviewSkill,
  lagoonCuratorEvaluationSkill,
  lagoonRiskExpertSkill,
  lagoonCustomerSupportSkill,
];

/**
 * Detect which skill is most relevant for a user message
 *
 * @param message - User message to analyze
 * @returns Detection result with skill, confidence, and matched triggers
 *
 * @example
 * ```typescript
 * const result = detectSkill("I'm new to DeFi, where should I start?");
 * if (result.skill && result.confidence > 0.5) {
 *   systemPrompt += result.skill.instructions;
 * }
 * ```
 */
export function detectSkill(message: string): SkillDetectionResult {
  const normalizedMessage = message.toLowerCase().trim();

  let bestMatch: LagoonSkill | null = null;
  let bestConfidence = 0;
  let bestTriggers: string[] = [];

  for (const skill of ALL_SKILLS) {
    const matchedTriggers = skill.triggers.filter((trigger) =>
      normalizedMessage.includes(trigger.toLowerCase())
    );

    if (matchedTriggers.length > 0) {
      // Confidence based on number of matched triggers and their specificity
      const triggerScore = matchedTriggers.length / skill.triggers.length;
      const specificityBonus = matchedTriggers.some((t) => t.length > 10) ? 0.2 : 0;
      const confidence = Math.min(triggerScore + specificityBonus, 1);

      if (confidence > bestConfidence) {
        bestMatch = skill;
        bestConfidence = confidence;
        bestTriggers = matchedTriggers;
      }
    }
  }

  return {
    skill: bestMatch,
    confidence: bestConfidence,
    matchedTriggers: bestTriggers,
  };
}

/**
 * Get a skill by name
 *
 * @param name - Skill name (e.g., 'lagoon-onboarding')
 * @returns The skill or undefined if not found
 */
export function getSkill(name: string): LagoonSkill | undefined {
  return ALL_SKILLS.find((skill) => skill.name === name);
}

/**
 * Get all skills, optionally filtered by options
 *
 * @param options - Filter options
 * @returns Array of matching skills
 */
export function getSkills(options?: SkillLoadOptions): LagoonSkill[] {
  let skills = [...ALL_SKILLS];

  if (options?.audience) {
    skills = skills.filter((s) => options.audience!.includes(s.audience));
  }

  if (options?.category) {
    skills = skills.filter((s) => options.category!.includes(s.metadata.category));
  }

  return skills;
}

/**
 * Get skill content formatted for system prompt injection
 *
 * @param name - Skill name
 * @param options - Load options
 * @returns Formatted skill content or empty string if not found
 *
 * @example
 * ```typescript
 * const skillPrompt = getSkillPrompt('lagoon-onboarding', {
 *   includeResources: true
 * });
 * const systemPrompt = basePrompt + skillPrompt;
 * ```
 */
export function getSkillPrompt(name: string, options?: SkillLoadOptions): string {
  const skill = getSkill(name);
  if (!skill) return '';

  let content = skill.instructions;

  // Optionally include resources
  if (options?.includeResources && skill.resources) {
    const resourceContent = Object.entries(skill.resources)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `\n\n## Resource: ${key}\n\n${value}`)
      .join('');
    content += resourceContent;
  }

  // Token budget check (using 3.5 chars/token for Lagoon's dense technical content)
  if (options?.maxTokens) {
    const estimatedTokens = Math.ceil(content.length / 3.5);
    if (estimatedTokens > options.maxTokens) {
      const maxChars = Math.floor(options.maxTokens * 3.5);

      // Try to truncate at semantic boundaries (resource sections first)
      const lastResourceBreak = content.lastIndexOf('\n\n## Resource:', maxChars);
      if (lastResourceBreak > maxChars * 0.7) {
        content =
          content.slice(0, lastResourceBreak) +
          '\n\n[Resources truncated - core instructions included]';
      } else {
        // Fall back to paragraph boundary
        const lastParagraph = content.lastIndexOf('\n\n', maxChars);
        if (lastParagraph > maxChars * 0.8) {
          content = content.slice(0, lastParagraph) + '\n\n[Content truncated]';
        } else {
          content = content.slice(0, maxChars) + '\n\n[Content truncated]';
        }
      }
    }
  }

  return content;
}

/**
 * Get all skill names
 *
 * @returns Array of skill names
 */
export function getSkillNames(): string[] {
  return ALL_SKILLS.map((skill) => skill.name);
}

/**
 * Get skill metadata for all skills (lightweight)
 *
 * @returns Array of skill metadata with name and description
 */
export function getSkillCatalog(): Array<{
  name: string;
  description: string;
  audience: string;
  category: string;
  estimatedTokens: number;
}> {
  return ALL_SKILLS.map((skill) => ({
    name: skill.name,
    description: skill.description,
    audience: skill.audience,
    category: skill.metadata.category,
    estimatedTokens: skill.metadata.estimatedTokens,
  }));
}

/**
 * Create a skill registry instance
 *
 * @returns SkillRegistry implementation
 */
export function createSkillRegistry(): SkillRegistry {
  return {
    skills: ALL_SKILLS,
    getSkill,
    detectSkill,
    getSkills,
    getSkillPrompt,
  };
}

/**
 * Default skill registry instance
 */
export const skillRegistry = createSkillRegistry();

/**
 * Build a skill-aware system prompt for Claude API integration
 *
 * This is the main helper function for backend integrations. It automatically
 * detects relevant skills based on user message and injects them into the
 * system prompt.
 *
 * @param baseSystemPrompt - Your base system prompt
 * @param userMessage - The user's message to analyze for skill triggers
 * @param options - Configuration options
 * @returns Result with complete system prompt and detection metadata
 *
 * @example
 * ```typescript
 * import { buildSkillAwarePrompt } from '@lagoon-protocol/lagoon-mcp/skills';
 *
 * // In your Claude API handler:
 * const { systemPrompt, detectedSkill, tokensAdded } = buildSkillAwarePrompt(
 *   "You are a Lagoon vault assistant...",
 *   userMessage,
 *   { confidenceThreshold: 0.5 }
 * );
 *
 * const response = await claude.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   system: systemPrompt,
 *   tools: mcpTools,
 *   messages: [{ role: 'user', content: userMessage }]
 * });
 *
 * // Log skill usage for analytics
 * if (detectedSkill) {
 *   console.log(`Skill activated: ${detectedSkill} (+${tokensAdded} tokens)`);
 * }
 * ```
 */
export function buildSkillAwarePrompt(
  baseSystemPrompt: string,
  userMessage: string,
  options: BuildPromptOptions = {}
): BuildPromptResult {
  // Conservative defaults for token efficiency
  // - includeResources: false saves ~500 tokens (use true for rich guidance)
  // - maxTokens: 1000 prevents runaway costs (use undefined for no limit)
  const confidenceThreshold: number = options.confidenceThreshold ?? 0.5;
  const includeResources: boolean = options.includeResources ?? false;
  const separator: string = options.separator ?? '\n\n---\n\n';
  // Use hasOwnProperty to distinguish between omitted and explicitly set to undefined
  let maxTokens: number | undefined = 1000;
  if (Object.prototype.hasOwnProperty.call(options, 'maxTokens')) {
    maxTokens = options.maxTokens;
  }

  // Detect relevant skill
  const detection = detectSkill(userMessage);

  // No skill matched or below threshold
  if (!detection.skill || detection.confidence < confidenceThreshold) {
    return {
      systemPrompt: baseSystemPrompt,
      detectedSkill: null,
      confidence: 0,
      matchedTriggers: [],
      tokensAdded: 0,
    };
  }

  // Get skill content
  const loadOptions: SkillLoadOptions = {
    includeResources,
    maxTokens,
  };
  const skillContent = getSkillPrompt(detection.skill.name, loadOptions);

  // Estimate tokens added (using 3.5 chars/token for Lagoon's dense technical content)
  const tokensAdded = Math.ceil(skillContent.length / 3.5);

  // Build complete prompt
  const systemPrompt = baseSystemPrompt + separator + skillContent;

  return {
    systemPrompt,
    detectedSkill: detection.skill.name,
    confidence: detection.confidence,
    matchedTriggers: detection.matchedTriggers,
    tokensAdded,
  };
}
