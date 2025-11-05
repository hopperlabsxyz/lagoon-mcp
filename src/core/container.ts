/**
 * Dependency Injection Container
 *
 * Provides centralized dependency management for testability and flexibility.
 * Eliminates global singletons and enables easy mocking for tests.
 */

import { GraphQLClient } from 'graphql-request';
import { Config } from '../config.js';
import { CacheService } from './cache-adapter.js';
import { CacheInvalidator } from './cache-invalidation.js';

/**
 * Service container interface
 * All application dependencies are accessed through this container
 */
export interface ServiceContainer {
  /** GraphQL client for backend communication */
  graphqlClient: GraphQLClient;

  /** Cache service for data caching */
  cache: CacheService;

  /** Cache invalidation coordinator */
  cacheInvalidator: CacheInvalidator;

  /** Application configuration */
  config: Config;
}

/**
 * Create production container with real implementations
 */
export function createContainer(
  graphqlClient: GraphQLClient,
  cache: CacheService,
  config: Config
): ServiceContainer {
  const cacheInvalidator = new CacheInvalidator(cache);

  return {
    graphqlClient,
    cache,
    cacheInvalidator,
    config,
  };
}

/**
 * Create test container with mock implementations
 * Useful for unit testing without real dependencies
 */
export function createTestContainer(overrides?: Partial<ServiceContainer>): ServiceContainer {
  // Mock GraphQL client
  const mockGraphQLClient = {
    request: () => Promise.resolve({}),
    setHeader: () => mockGraphQLClient,
    setHeaders: () => mockGraphQLClient,
  } as unknown as GraphQLClient;

  // Mock cache service
  const mockCache: CacheService = {
    get: () => undefined,
    set: () => void 0,
    has: () => false,
    del: () => void 0,
    flush: () => void 0,
    getStats: () => ({
      hits: 0,
      misses: 0,
      keys: 0,
      ksize: 0,
      vsize: 0,
    }),
  };

  // Mock cache invalidator
  const mockCacheInvalidator = new CacheInvalidator(mockCache);

  // Mock config
  const mockConfig: Config = {
    graphql: {
      endpoint: 'http://test.example.com/graphql',
      timeout: 30000,
    },
    cache: {
      stdTTL: 600,
      checkperiod: 120,
      maxKeys: 1000,
    },
    server: {
      name: 'lagoon-mcp',
      version: '0.1.0',
    },
    isDevelopment: true,
    isProduction: false,
    isTest: true,
  };

  return {
    graphqlClient: mockGraphQLClient,
    cache: mockCache,
    cacheInvalidator: mockCacheInvalidator,
    config: mockConfig,
    ...overrides,
  };
}
