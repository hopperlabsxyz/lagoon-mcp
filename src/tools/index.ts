/**
 * Tool Registry (DEPRECATED)
 *
 * This file is deprecated. Use src/tools/registry.ts instead.
 * Kept for backward compatibility only.
 */

import { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * @deprecated Use ToolDefinition from './registry.js' instead
 */
export type { ToolDefinition as Tool } from './registry.js';

/**
 * @deprecated Use TOOL_REGISTRY from './registry.js' instead
 * Tool array kept for backward compatibility only
 */
export { TOOL_REGISTRY as tools } from './registry.js';

/**
 * @deprecated Tool handlers are now managed by the registry
 * Use registerTools() from './registry.js' instead
 */

/**
 * @deprecated Use registerTools() from './registry.js' instead
 * This function is kept for backward compatibility only
 */
export function handleToolCall(request: CallToolRequest): CallToolResult {
  const toolName = request.params.name;

  return {
    content: [
      {
        type: 'text',
        text: `Tool "${toolName}" should be called via the MCP server. Use registerTools() from './registry.js'.`,
      },
    ],
    isError: true,
  };
}
