import { vi } from 'vitest';
import type { ServiceContainer } from '../../src/core/container.js';
import { graphqlClient } from '../../src/graphql/client.js';
import { cache } from '../../src/cache/index.js';

/**
 * Creates a standard mock ServiceContainer for testing.
 *
 * This eliminates duplication across test files and provides a consistent
 * mock container setup. The config object is mutable (no 'as const') to
 * satisfy TypeScript's strict type checking.
 *
 * @param overrides - Optional partial ServiceContainer to override defaults
 * @returns A fully configured mock ServiceContainer
 *
 * @example
 * ```typescript
 * const mockContainer = createMockContainer();
 * const executor = createExecuteTool(mockContainer);
 * ```
 */
export function createMockContainer(overrides?: Partial<ServiceContainer>): ServiceContainer {
  return {
    graphqlClient,
    cache,
    cacheInvalidator: {
      register: vi.fn<[string, unknown[]], void>(),
      invalidateByTag: vi.fn<[unknown], number>(),
    },
    config: {
      graphql: { endpoint: 'http://test', timeout: 30000 },
      cache: { stdTTL: 600, checkperiod: 120, maxKeys: 1000 },
      server: { name: 'lagoon-mcp', version: '0.1.0' },
      isDevelopment: false,
      isProduction: false,
      isTest: true,
    },
    ...overrides,
  };
}
