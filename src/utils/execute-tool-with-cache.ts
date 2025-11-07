/**
 * Execute Tool With Cache Abstraction
 *
 * Generic caching wrapper for tools that follow the pattern:
 * 1. Check cache
 * 2. Execute GraphQL query on cache miss
 * 3. Validate result (optional)
 * 4. Transform result (optional)
 * 5. Cache and return
 *
 * Eliminates code duplication across 10+ tools with caching logic.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ServiceContainer } from '../core/container.js';
import { handleToolError } from './tool-error-handler.js';
import { createSuccessResponse } from './tool-response.js';

/**
 * Cache key generator function
 */
export type CacheKeyGenerator<TInput> = (input: TInput) => string;

/**
 * GraphQL variables mapper function
 */
export type VariablesMapper<TInput, TVariables = TInput> = (input: TInput) => TVariables;

/**
 * Result validator function
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  isError?: boolean; // If true, treat as error; if false/undefined, treat as non-error (e.g., no data found)
}

export type ResultValidator<TOutput> = (data: TOutput) => ValidationResult;

/**
 * Result transformer function
 */
export type ResultTransformer<TOutput, TTransformed = TOutput> = (data: TOutput) => TTransformed;

/**
 * Configuration for cached tool execution
 */
export interface CachedToolOptions<TInput, TOutput, TVariables = TInput, TTransformed = TOutput> {
  /** Service container with dependencies */
  container: ServiceContainer;

  /** Cache key generator from input */
  cacheKey: CacheKeyGenerator<TInput>;

  /** Cache TTL in seconds */
  cacheTTL: number;

  /** GraphQL query string */
  query: string;

  /** Map input to GraphQL variables */
  variables: VariablesMapper<TInput, TVariables>;

  /** Validate query result (optional) */
  validateResult?: ResultValidator<TOutput>;

  /** Transform result before caching/returning (optional) */
  transformResult?: ResultTransformer<TOutput, TTransformed>;

  /** Tool name for error reporting */
  toolName: string;
}

/**
 * Create a cached tool executor
 *
 * Returns an async function that executes the tool with caching logic.
 *
 * @example
 * ```typescript
 * const executeGetVaultData = executeToolWithCache<GetVaultDataInput, VaultDataResponse>({
 *   container,
 *   cacheKey: (input) => cacheKeys.vaultData(input.vaultAddress, input.chainId),
 *   cacheTTL: cacheTTL.vaultData,
 *   query: GET_VAULT_DATA_QUERY,
 *   variables: (input) => ({ address: input.vaultAddress, chainId: input.chainId }),
 *   validateResult: (data) => ({
 *     valid: !!data.vaultByAddress,
 *     message: data.vaultByAddress ? undefined : 'Vault not found',
 *   }),
 *   toolName: 'get_vault_data',
 * });
 * ```
 */
export function executeToolWithCache<TInput, TOutput, TVariables = TInput, TTransformed = TOutput>(
  options: CachedToolOptions<TInput, TOutput, TVariables, TTransformed>
): (input: TInput) => Promise<CallToolResult> {
  const {
    container,
    cacheKey,
    cacheTTL,
    query,
    variables,
    validateResult,
    transformResult,
    toolName,
  } = options;

  return async (input: TInput): Promise<CallToolResult> => {
    try {
      // 1. Generate cache key
      const key = cacheKey(input);

      // 2. Check cache
      const cached = container.cache.get<TOutput>(key);
      if (cached) {
        const result = transformResult
          ? transformResult(cached)
          : (cached as unknown as TTransformed);
        return createSuccessResponse(result);
      }

      // 3. Execute GraphQL query
      const queryVariables = variables(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const data = await container.graphqlClient.request<TOutput>(query, queryVariables as any);

      // 4. Validate result
      if (validateResult) {
        const validation = validateResult(data);
        if (!validation.valid) {
          return {
            content: [
              {
                type: 'text',
                text: validation.message || 'Invalid data returned from query',
              },
            ],
            // Use validator's isError flag, default to false for backward compatibility (no data = not an error)
            isError: validation.isError ?? false,
          };
        }
      }

      // 5. Cache result
      container.cache.set(key, data, cacheTTL);

      // 6. Transform and return
      const result = transformResult ? transformResult(data) : (data as unknown as TTransformed);
      return createSuccessResponse(result);
    } catch (error) {
      return handleToolError(error, toolName);
    }
  };
}

/**
 * Create a simple cached tool executor without validation or transformation
 *
 * Simplified version for tools that don't need validation or transformation.
 *
 * @example
 * ```typescript
 * const executeSimpleTool = createSimpleCachedTool({
 *   container,
 *   cacheKey: (input) => `tool:${input.id}`,
 *   cacheTTL: 300,
 *   query: SIMPLE_QUERY,
 *   variables: (input) => ({ id: input.id }),
 *   toolName: 'simple_tool',
 * });
 * ```
 */
export function createSimpleCachedTool<TInput, TOutput, TVariables = TInput>(
  options: Omit<
    CachedToolOptions<TInput, TOutput, TVariables, TOutput>,
    'validateResult' | 'transformResult'
  >
): (input: TInput) => Promise<CallToolResult> {
  return executeToolWithCache<TInput, TOutput, TVariables, TOutput>({
    ...options,
    validateResult: undefined,
    transformResult: undefined,
  });
}
