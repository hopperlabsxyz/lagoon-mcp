/**
 * Configuration management for Lagoon MCP
 *
 * Centralized configuration with validated environment variables.
 * All environment variables are validated at startup using Zod schema.
 * The application will exit with clear error messages if misconfigured.
 */

import { loadAndValidateEnv } from './utils/config-loader.js';

// Validate environment variables at startup (fails fast if misconfigured)
const env = loadAndValidateEnv();

/**
 * Application configuration
 *
 * This configuration is validated at startup to ensure all required
 * environment variables are properly set. The application will not
 * start if configuration is invalid.
 */
export const config = {
  // GraphQL Backend
  graphql: {
    endpoint: env.LAGOON_GRAPHQL_URL,
    timeout: 30000, // 30 seconds
  },

  // Caching
  cache: {
    stdTTL: env.CACHE_TTL ?? 600, // Default 10 minutes
    checkperiod: 120, // Check expired keys every 2 minutes
    maxKeys: env.CACHE_MAX_KEYS ?? 1000, // Maximum cache entries
  },

  // Server
  server: {
    name: 'lagoon-mcp',
    version: '0.1.0',
  },

  // Environment flags
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export type Config = typeof config;
