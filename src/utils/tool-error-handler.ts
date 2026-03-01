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
  // Handle Zod validation errors with field path/index for better debugging
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors.map((e) => {
      // Include field path (e.g., "vaultAddresses.1") for array/nested errors
      const path = e.path.length > 0 ? `${e.path.join('.')} - ` : '';
      return `${path}${e.message}`;
    });
    const validationError = new ValidationError(
      `Input validation failed: ${formattedErrors.join('; ')}`
    );
    logError(validationError, toolName);
    return errorResponse(validationError);
  }

  // Handle GraphQL errors — sanitize in production to avoid leaking internals
  if (error && typeof error === 'object' && 'response' in error) {
    const gqlError = error as {
      response?: { errors?: Array<{ message?: string }> };
    };
    if (gqlError.response?.errors) {
      logError(error, toolName);
      // Production: return only message fields. Dev: full details.
      const isProduction = process.env.NODE_ENV === 'production';
      const sanitized = isProduction
        ? gqlError.response.errors.map((e) => e.message ?? 'Unknown error').join('; ')
        : JSON.stringify(gqlError.response.errors, null, 2);
      return {
        content: [
          {
            type: 'text',
            text: `GraphQL Error: ${sanitized}`,
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
