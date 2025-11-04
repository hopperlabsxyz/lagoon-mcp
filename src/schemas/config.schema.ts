import { z } from 'zod';

/**
 * Environment variable validation schema
 *
 * Validates all environment variables at startup to ensure proper configuration.
 * Uses Zod for runtime validation and type inference.
 */
export const envSchema = z.object({
  /**
   * GraphQL API endpoint for Lagoon backend
   * Must be a valid URL
   * @default 'http://localhost:3001/query'
   */
  LAGOON_GRAPHQL_URL: z
    .string()
    .url('LAGOON_GRAPHQL_URL must be a valid URL')
    .default('http://localhost:3001/query')
    .describe('GraphQL API endpoint for Lagoon backend'),

  /**
   * Runtime environment
   * @default 'development'
   */
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('Runtime environment'),

  /**
   * Cache TTL in seconds (optional override)
   * @default 600 (10 minutes)
   */
  CACHE_TTL: z
    .string()
    .regex(/^\d+$/, 'CACHE_TTL must be a positive integer')
    .transform(Number)
    .optional()
    .describe('Cache TTL in seconds (default: 600)'),

  /**
   * Maximum number of cache entries (optional override)
   * @default 1000
   */
  CACHE_MAX_KEYS: z
    .string()
    .regex(/^\d+$/, 'CACHE_MAX_KEYS must be a positive integer')
    .transform(Number)
    .optional()
    .describe('Maximum cache entries (default: 1000)'),
});

/**
 * Validated environment variable type
 * Inferred from the Zod schema
 */
export type Env = z.infer<typeof envSchema>;
