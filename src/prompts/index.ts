/**
 * Prompt Registry
 *
 * Central registry for all MCP prompts.
 * Prompts provide templates for common queries and interactions.
 */

import { GetPromptRequest, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { getFinancialAnalysisPrompt } from './financial-analysis.js';

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
 * Available prompts for MCP clients
 */
export const prompts: Prompt[] = [
  {
    name: 'financial-analysis',
    description:
      'Guidance for analyzing DeFi vault data and generating financial insights. ' +
      'Includes analysis patterns for portfolio review, vault performance, and vault discovery. ' +
      'Provides frameworks for risk assessment, metrics interpretation, and report structure.',
    arguments: [],
  },
];

/**
 * Handle prompt get requests
 */
export function handlePromptGet(request: GetPromptRequest): GetPromptResult {
  const promptName = request.params.name;

  switch (promptName) {
    case 'financial-analysis':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getFinancialAnalysisPrompt(),
            },
          },
        ],
      };

    default:
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Prompt "${promptName}" not found. Available prompts:\n${prompts.map((p) => `- ${p.name}: ${p.description}`).join('\n')}`,
            },
          },
        ],
      };
  }
}
