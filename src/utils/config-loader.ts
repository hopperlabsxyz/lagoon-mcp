import { ZodError } from 'zod';
import { envSchema, type Env } from '../schemas/config.schema.js';

/**
 * Validates and loads environment variables using Zod schema.
 *
 * This function performs strict validation of all environment variables
 * at application startup. If validation fails, it prints detailed error
 * messages and exits the process.
 *
 * @returns Validated environment variables
 * @throws Exits process with code 1 if validation fails
 *
 * @example
 * const env = loadAndValidateEnv();
 * console.log(env.LAGOON_GRAPHQL_URL); // Type-safe access
 */
export function loadAndValidateEnv(): Env {
  try {
    // Parse and validate environment variables
    const env = envSchema.parse({
      LAGOON_GRAPHQL_URL: process.env.LAGOON_GRAPHQL_URL,
      NODE_ENV: process.env.NODE_ENV,
      CACHE_TTL: process.env.CACHE_TTL,
      CACHE_MAX_KEYS: process.env.CACHE_MAX_KEYS,
    });

    return env;
  } catch (error) {
    if (error instanceof ZodError) {
      // Format and display validation errors
      console.error('❌ Configuration validation failed:\n');

      error.errors.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  • ${path}: ${err.message}`);
      });

      console.error(
        '\n💡 Check your .env file and ensure all required variables are set correctly.'
      );
      console.error('📄 See .env.example for reference.\n');

      // Exit process with error code
      process.exit(1);
    }

    // Re-throw unexpected errors
    throw error;
  }
}
