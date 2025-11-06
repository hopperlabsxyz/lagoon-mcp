/**
 * Prompt Registry
 *
 * Central registry for all MCP prompts.
 * Prompts provide templates for common queries and interactions.
 */

import { GetPromptRequest, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { getFinancialAnalysisPrompt } from './financial-analysis.js';
import { getCuratorPerformancePrompt } from './curator-performance.js';
import { getCompetitorComparisonPrompt } from './competitor-comparison.js';
import { getOnboardingFirstVaultPrompt } from './onboarding-first-vault.js';
import { getProtocolOverviewPrompt } from './protocol-overview.js';
import { getPortfolioOptimizationPrompt } from './portfolio-optimization.js';

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
  {
    name: 'curator-performance',
    description:
      'Comprehensive framework for evaluating curator performance, reputation, and vault management capabilities. ' +
      'Includes reputation scoring, performance metrics, risk-adjusted returns, and decision frameworks for curator selection.',
    arguments: [],
  },
  {
    name: 'competitor-comparison',
    description:
      'Objective comparison of Lagoon Protocol against major competitors (Gauntlet, Veda, Ether.fi). ' +
      'Provides data-driven analysis across financial performance, features, security, and use case fit.',
    arguments: [],
  },
  {
    name: 'onboarding-first-vault',
    description:
      'Structured guidance for new users making their first vault deposit. ' +
      'Includes risk profile assessment, step-by-step selection process, and confidence-building decision frameworks.',
    arguments: [],
  },
  {
    name: 'protocol-overview',
    description:
      'Real-time protocol health insights and KPI dashboard. ' +
      'Tracks TVL, user growth, vault performance, ecosystem health, and competitive positioning.',
    arguments: [],
  },
  {
    name: 'portfolio-optimization',
    description:
      'AI-powered portfolio optimization based on modern portfolio theory. ' +
      'Provides systematic rebalancing recommendations to maximize risk-adjusted returns with multiple optimization strategies.',
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

    case 'curator-performance':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getCuratorPerformancePrompt(),
            },
          },
        ],
      };

    case 'competitor-comparison':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getCompetitorComparisonPrompt(),
            },
          },
        ],
      };

    case 'onboarding-first-vault':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getOnboardingFirstVaultPrompt(),
            },
          },
        ],
      };

    case 'protocol-overview':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getProtocolOverviewPrompt(),
            },
          },
        ],
      };

    case 'portfolio-optimization':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getPortfolioOptimizationPrompt(),
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
