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
 * @param prettyPrint - Whether to pretty-print the JSON (default: true)
 * @returns Standardized success response
 */
export function createSuccessResponse(data: unknown, prettyPrint = true): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data),
      },
    ],
    isError: false,
  };
}

/**
 * A success response that also carries the data as `structuredContent`, for
 * clients that read tool output as an object. The text stays compact JSON,
 * first, so programmatic callers can parse it.
 */
export function createStructuredResponse(data: object): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    // The output types are interfaces, which TypeScript does not treat as records
    structuredContent: data as Record<string, unknown>,
    isError: false,
  };
}
