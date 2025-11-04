/**
 * Shared Error Handler for MCP Tools
 *
 * Centralized error handling logic for all MCP tools.
 * Handles validation errors, GraphQL errors, and generic errors.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ValidationError, errorResponse, logError } from './errors.js';

/**
 * Handle errors consistently across all MCP tools
 *
 * @param error - The error to handle
 * @param toolName - The name of the tool where the error occurred
 * @returns Standardized error response
 */
export function handleToolError(error: unknown, toolName: string): CallToolResult {
  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const validationError = new ValidationError(
      `Input validation failed: ${error.errors.map((e) => e.message).join(', ')}`
    );
    logError(validationError, toolName);
    return errorResponse(validationError);
  }

  // Handle GraphQL errors
  if (error && typeof error === 'object' && 'response' in error) {
    const gqlError = error as { response?: { errors?: unknown[] } };
    if (gqlError.response?.errors) {
      logError(error, toolName);
      return {
        content: [
          {
            type: 'text',
            text: `GraphQL Error: ${JSON.stringify(gqlError.response.errors, null, 2)}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Handle all other errors
  logError(error, toolName);
  return errorResponse(error);
}
