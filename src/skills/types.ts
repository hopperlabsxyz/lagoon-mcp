/**
 * Lagoon Skills Type Definitions
 *
 * Skills are procedural knowledge modules that teach Claude HOW to use
 * Lagoon MCP tools effectively. They complement MCP's data connectivity
 * with domain expertise and workflow guidance.
 *
 * @module skills/types
 */

/**
 * Represents a Lagoon skill with instructions and metadata.
 * Skills can be used in two contexts:
 * 1. Claude Desktop: Raw SKILL.md files loaded via JSON config
 * 2. Backend API: TypeScript modules injected into system prompts
 */
export interface LagoonSkill {
  /** Unique identifier (kebab-case) */
  name: string;

  /** Human-readable description for skill selection */
  description: string;

  /** Keywords/phrases that trigger this skill */
  triggers: string[];

  /** Target audience for this skill */
  audience: SkillAudience;

  /** Main skill instructions (content from SKILL.md) */
  instructions: string;

  /** Optional supporting resources */
  resources?: SkillResources;

  /** Skill metadata */
  metadata: SkillMetadata;
}

/**
 * Target audience categories for skills
 */
export type SkillAudience =
  | 'customer-new' // New users, onboarding
  | 'customer-existing' // Existing users, portfolio management
  | 'customer-advanced' // Advanced users, strategies
  | 'internal-ops' // Internal operations team
  | 'internal-bd' // Business development
  | 'internal-support'; // Customer support team

/**
 * Supporting resources for a skill
 */
export interface SkillResources {
  /** Tool usage patterns and parameters */
  toolSequences?: string;

  /** Domain-specific interpretation guides */
  interpretation?: string;

  /** Threshold definitions and criteria */
  thresholds?: string;

  /** Report templates */
  templates?: string;

  /** Additional named resources */
  [key: string]: string | undefined;
}

/**
 * Skill metadata for versioning and categorization
 */
export interface SkillMetadata {
  /** Skill version (semver) */
  version: string;

  /** Category for grouping */
  category: SkillCategory;

  /** MCP tools this skill primarily uses */
  primaryTools: string[];

  /** Estimated context tokens when loaded */
  estimatedTokens: number;

  /** Last updated date */
  lastUpdated: string;
}

/**
 * Skill categories for organization
 */
export type SkillCategory =
  | 'onboarding' // User onboarding and education
  | 'portfolio' // Portfolio management and review
  | 'risk' // Risk assessment and management
  | 'operations' // Internal operations
  | 'support' // Customer support
  | 'strategy'; // Advanced strategies

/**
 * Result of skill detection
 */
export interface SkillDetectionResult {
  /** The detected skill, if any */
  skill: LagoonSkill | null;

  /** Confidence score (0-1) */
  confidence: number;

  /** Matched triggers */
  matchedTriggers: string[];
}

/**
 * Options for skill loading
 */
export interface SkillLoadOptions {
  /** Include supporting resources */
  includeResources?: boolean;

  /** Maximum token budget (will truncate if exceeded) */
  maxTokens?: number;

  /** Filter by audience */
  audience?: SkillAudience[];

  /** Filter by category */
  category?: SkillCategory[];
}

/**
 * Skill registry for managing available skills
 */
export interface SkillRegistry {
  /** All registered skills */
  skills: LagoonSkill[];

  /** Get skill by name */
  getSkill(name: string): LagoonSkill | undefined;

  /** Detect relevant skill for a message */
  detectSkill(message: string): SkillDetectionResult;

  /** Get skills filtered by options */
  getSkills(options?: SkillLoadOptions): LagoonSkill[];

  /** Get skill content formatted for system prompt */
  getSkillPrompt(name: string, options?: SkillLoadOptions): string;
}

/**
 * Options for building a skill-aware system prompt
 */
export interface BuildPromptOptions {
  /** Minimum confidence threshold (0-1) to include a skill. Default: 0.5 */
  confidenceThreshold?: number;

  /** Include skill resources in the prompt. Default: true */
  includeResources?: boolean;

  /** Maximum tokens for skill content. Default: no limit */
  maxTokens?: number;

  /** Custom separator between base prompt and skill. Default: '\n\n---\n\n' */
  separator?: string;
}

/**
 * Result of building a skill-aware prompt
 */
export interface BuildPromptResult {
  /** The complete system prompt with skill injected (if matched) */
  systemPrompt: string;

  /** Name of the detected skill, or null if none matched */
  detectedSkill: string | null;

  /** Confidence score of the detection (0 if no skill) */
  confidence: number;

  /** Triggers that matched in the user message */
  matchedTriggers: string[];

  /** Estimated tokens added by the skill (0 if no skill) */
  tokensAdded: number;
}
