/**
 * discover_tools Tool
 *
 * Meta-tool for progressive tool discovery.
 * Enables models to search and explore available tools by category or keyword.
 * Reduces initial context overhead by allowing on-demand tool loading.
 *
 * Use cases:
 * - Discover available capabilities before making specific tool calls
 * - Filter tools by category (vault, portfolio, analytics, etc.)
 * - Search for tools by keyword in names or descriptions
 * - Get tool input schemas for specific tools
 *
 * Performance: ~100-200 tokens per query. No caching needed (static data).
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool categories for filtering
// Maps category names to tool names that belong to each category
const TOOL_CATEGORIES = {
  vault: ['get_vault_data', 'search_vaults', 'compare_vaults', 'simulate_vault'],
  portfolio: ['get_user_portfolio', 'optimize_portfolio'],
  analytics: ['get_vault_performance', 'get_price_history', 'analyze_risk', 'predict_yield'],
  transactions: ['get_transactions'],
  export: ['export_data', 'query_graphql'],
} as const;

type ToolCategory = keyof typeof TOOL_CATEGORIES;

/**
 * Input schema for discover_tools
 */
export const discoverToolsInputSchema = z.object({
  category: z
    .enum(['vault', 'portfolio', 'analytics', 'transactions', 'export', 'all'])
    .optional()
    .describe('Filter tools by category. Omit or use "all" for all categories.'),
  keyword: z
    .string()
    .optional()
    .describe('Search tool names and descriptions for this keyword (case-insensitive).'),
  includeSchema: z
    .boolean()
    .default(false)
    .describe('Include input schema details. Default: false (just name + description).'),
});

export type DiscoverToolsInput = z.infer<typeof discoverToolsInputSchema>;

/**
 * Tool info structure for discovery results
 */
interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: unknown;
}

/**
 * Discovery result structure
 */
interface DiscoveryResult {
  availableCategories: string[];
  matchedTools: ToolInfo[];
  totalTools: number;
  tip: string;
}

/**
 * Get tool registry dynamically to avoid circular dependencies
 * This function imports the registry at runtime
 */
async function getToolRegistry(): Promise<
  Array<{ name: string; description: string; schema: z.ZodSchema }>
> {
  // Dynamic import to avoid circular dependency
  const { TOOL_REGISTRY } = await import('./registry.js');
  return TOOL_REGISTRY;
}

/**
 * Create the executeDiscoverTools function
 *
 * This is a pure function that doesn't require DI container
 * since it only reads static tool metadata.
 *
 * @returns Configured tool executor function
 */
export function createExecuteDiscoverTools(): (
  input: DiscoverToolsInput
) => Promise<CallToolResult> {
  return async (input: DiscoverToolsInput): Promise<CallToolResult> => {
    try {
      // Get tool registry dynamically
      const registry = await getToolRegistry();

      // Start with all tools except discover_tools itself
      let tools = registry.filter((t) => t.name !== 'discover_tools');

      // Filter by category if specified
      if (input.category && input.category !== 'all') {
        const categoryTools: readonly string[] =
          TOOL_CATEGORIES[input.category as ToolCategory] || [];
        tools = tools.filter((t) => categoryTools.includes(t.name));
      }

      // Filter by keyword if specified
      if (input.keyword) {
        const keyword = input.keyword.toLowerCase();
        tools = tools.filter(
          (t) =>
            t.name.toLowerCase().includes(keyword) || t.description.toLowerCase().includes(keyword)
        );
      }

      // Format response
      const result: DiscoveryResult = {
        availableCategories: Object.keys(TOOL_CATEGORIES),
        matchedTools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          ...(input.includeSchema ? { inputSchema: t.schema } : {}),
        })),
        totalTools: tools.length,
        tip:
          tools.length === 0
            ? 'No tools matched your criteria. Try a different category or keyword.'
            : 'Use category or keyword filters to narrow results. Set includeSchema=true for input details.',
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error discovering tools: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };
}
