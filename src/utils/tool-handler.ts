/**
 * Type-Safe Tool Handler Utilities
 *
 * Provides type-safe wrappers for MCP tool handlers to eliminate
 * unsafe type assertions (as never) throughout the codebase.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodSchema } from 'zod';

/**
 * Creates a type-safe tool handler that validates input against a schema
 *
 * @param handler - The tool handler function with proper typing
 * @param schema - Zod schema for runtime validation (handles schemas with defaults)
 * @returns A wrapper function that safely handles unknown arguments
 *
 * @example
 * const safeHandler = createToolHandler(
 *   executeQueryGraphQL,
 *   queryGraphQLInputSchema
 * );
 * await safeHandler(unknownArgs);
 */
export function createToolHandler<TOutput, TInput = TOutput>(
  handler: (input: TOutput) => Promise<CallToolResult>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodSchema<TOutput, any, TInput>
): (args: unknown) => Promise<CallToolResult> {
  return async (args: unknown): Promise<CallToolResult> => {
    try {
      // Validate and parse arguments using the provided schema
      // schema.parse returns TOutput (with defaults applied)
      const validatedArgs = schema.parse(args ?? {});

      // Call the handler with properly typed arguments
      return await handler(validatedArgs);
    } catch (error) {
      // If validation fails, return an error result
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Type-safe wrapper for tool handlers that don't need explicit validation
 *
 * @param handler - The tool handler function
 * @returns A wrapper function that safely casts unknown arguments
 *
 * Note: Use createToolHandler with schema validation instead when possible
 */
export function wrapToolHandler<T>(
  handler: (input: T) => Promise<CallToolResult>
): (args: unknown) => Promise<CallToolResult> {
  return async (args: unknown): Promise<CallToolResult> => {
    return await handler(args as T);
  };
}
