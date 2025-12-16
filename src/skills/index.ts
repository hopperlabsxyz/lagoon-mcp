/**
 * Lagoon Skills Module
 *
 * Exports all skills and utilities for programmatic usage in backend integrations.
 *
 * ## Overview
 *
 * Skills are procedural knowledge modules that complement MCP's data connectivity.
 * While MCP tools fetch data, Skills teach Claude HOW to use those tools effectively.
 *
 * ## Usage in Backend
 *
 * ### Recommended: Use buildSkillAwarePrompt helper
 *
 * ```typescript
 * import { buildSkillAwarePrompt } from '@lagoon-protocol/lagoon-mcp/skills';
 *
 * // In your Claude API handler:
 * const { systemPrompt, detectedSkill, tokensAdded } = buildSkillAwarePrompt(
 *   "You are a Lagoon vault assistant...",
 *   userMessage,
 *   { confidenceThreshold: 0.5, includeResources: true }
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
 *
 * ### Alternative: Manual skill detection
 *
 * ```typescript
 * import { detectSkill, getSkillPrompt } from '@lagoon-protocol/lagoon-mcp/skills';
 *
 * const detection = detectSkill(userMessage);
 * if (detection.skill && detection.confidence > 0.5) {
 *   systemPrompt += getSkillPrompt(detection.skill.name);
 * }
 * ```
 *
 * ### Explicit skill activation
 *
 * ```typescript
 * import { getSkillPrompt } from '@lagoon-protocol/lagoon-mcp/skills';
 *
 * if (isNewUser) {
 *   systemPrompt += getSkillPrompt('lagoon-onboarding', { includeResources: true });
 * }
 * ```
 *
 * ## Available Skills
 *
 * - `lagoon-onboarding`: First vault selection for new users
 * - (Future) `lagoon-protocol-health`: Internal KPI monitoring
 * - (Future) `lagoon-portfolio-review`: Portfolio health checks
 *
 * @module skills
 */

// Type exports
export type {
  BuildPromptOptions,
  BuildPromptResult,
  LagoonSkill,
  SkillAudience,
  SkillCategory,
  SkillDetectionResult,
  SkillLoadOptions,
  SkillMetadata,
  SkillRegistry,
  SkillResources,
} from './types.js';

// Skill definitions
export { lagoonOnboardingSkill } from './onboarding.js';
export { lagoonProtocolHealthSkill } from './protocol-health.js';
export { lagoonPortfolioReviewSkill } from './portfolio-review.js';
export { lagoonCuratorEvaluationSkill } from './curator-evaluation.js';
export { lagoonRiskExpertSkill } from './risk-expert.js';
export { lagoonCustomerSupportSkill } from './customer-support.js';

// Shared utilities
export {
  COMMON_DISCLAIMERS,
  COMMON_TRIGGERS,
  COMMUNICATION_GUIDELINES,
  combineTriggers,
  estimateTokens,
} from './shared.js';

// Loader utilities
export {
  buildSkillAwarePrompt,
  createSkillRegistry,
  detectSkill,
  getSkill,
  getSkillCatalog,
  getSkillNames,
  getSkillPrompt,
  getSkills,
  skillRegistry,
} from './loader.js';

// Convenience re-export of all skills as a collection
import { lagoonOnboardingSkill } from './onboarding.js';
import { lagoonProtocolHealthSkill } from './protocol-health.js';
import { lagoonPortfolioReviewSkill } from './portfolio-review.js';
import { lagoonCuratorEvaluationSkill } from './curator-evaluation.js';
import { lagoonRiskExpertSkill } from './risk-expert.js';
import { lagoonCustomerSupportSkill } from './customer-support.js';

/**
 * All available skills as a named collection
 */
export const skills = {
  onboarding: lagoonOnboardingSkill,
  protocolHealth: lagoonProtocolHealthSkill,
  portfolioReview: lagoonPortfolioReviewSkill,
  curatorEvaluation: lagoonCuratorEvaluationSkill,
  riskExpert: lagoonRiskExpertSkill,
  customerSupport: lagoonCustomerSupportSkill,
} as const;

/**
 * Default export: skill registry for simple access
 */
export { skillRegistry as default } from './loader.js';
