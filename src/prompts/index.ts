/**
 * Prompt Registry
 *
 * Central registry for all MCP prompts.
 * Prompts provide templates for common queries and interactions.
 */

import { GetPromptRequest, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * Prompt Registry
 * Add prompts here as they are implemented
 */
export const prompts: Record<string, Prompt> = {
  // Prompts will be added in later phases:
  // - analyze-vault - Analyze a specific vault
  // - compare-vaults - Compare multiple vaults
  // - portfolio-summary - Summarize user portfolio
};

/**
 * Handle prompt get requests
 */
export function handlePromptGet(request: GetPromptRequest): GetPromptResult {
  const promptName = request.params.name;

  // For now, return an error since no prompts are implemented yet
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Prompt "${promptName}" is not yet implemented. Prompts will be added in later phases.`,
        },
      },
    ],
  };
}
