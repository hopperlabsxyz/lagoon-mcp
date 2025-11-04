/**
 * Tool Registry
 *
 * Central registry for all MCP tools.
 * Tools will be implemented in Phase 2.
 */

import { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool Registry
 * Add tools here as they are implemented in Phase 2
 */
export const tools: Record<string, Tool> = {
  // Tools will be added in Phase 2:
  // - get_vault_data
  // - get_user_portfolio
  // - search_vaults
  // - get_vault_performance
  // - get_global_tvl
};

/**
 * Handle tool calls
 */
export function handleToolCall(request: CallToolRequest): CallToolResult {
  const toolName = request.params.name;

  // For now, return an error since no tools are implemented yet
  return {
    content: [
      {
        type: 'text',
        text: `Tool "${toolName}" is not yet implemented. Tools will be added in Phase 2.`,
      },
    ],
    isError: true,
  };
}
