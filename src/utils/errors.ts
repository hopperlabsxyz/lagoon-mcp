/**
 * Error Handling Utilities
 *
 * Custom error types and formatting for consistent error handling
 */

/**
 * GraphQL error detail structure
 */
type GraphQLErrorDetail = {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

/**
 * GraphQL-specific error with response details
 */
export class GraphQLError extends Error {
  constructor(
    message: string,
    public errors: GraphQLErrorDetail[]
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
}

/**
 * Input validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Cache operation error
 */
export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}

/**
 * Network/connection error
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Format error for user-facing display
 */
export function formatError(error: unknown): string {
  if (error instanceof GraphQLError) {
    return `GraphQL Error: ${error.message}\n${JSON.stringify(error.errors, null, 2)}`;
  }

  if (error instanceof ValidationError) {
    return `Validation Error: ${error.message}`;
  }

  if (error instanceof CacheError) {
    return `Cache Error: ${error.message}`;
  }

  if (error instanceof NetworkError) {
    return `Network Error: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Unknown Error: ${String(error)}`;
}

/**
 * MCP error response type
 */
type MCPErrorResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
};

/**
 * Standard error response for MCP tools
 */
export function errorResponse(error: unknown): MCPErrorResponse {
  return {
    content: [
      {
        type: 'text' as const,
        text: formatError(error),
      },
    ],
    isError: true,
  };
}

/**
 * Log error to stderr (Claude Code captures this)
 */
export function logError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}]` : '';
  console.error(`${prefix} ${formatError(error)}`);
}
