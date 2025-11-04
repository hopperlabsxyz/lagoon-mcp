/**
 * Shared Response Formatter for MCP Tools
 *
 * Centralized response formatting logic for all MCP tools.
 * Provides consistent JSON formatting and success response structure.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Create a standardized success response with JSON-formatted data
 *
 * @param data - The data to return in the response
 * @returns Standardized success response
 */
export function createSuccessResponse(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
