/**
 * Vitest Global Setup
 * Configures test environment and global fixtures
 */

import { beforeEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LAGOON_GRAPHQL_URL = 'http://localhost:3001/query';

// Clear cache between tests
beforeEach(() => {
  // Reset any global state here if needed
});

// Global test timeout
export const TEST_TIMEOUT = 30000; // 30 seconds

// Test configuration constants
export const TEST_CONFIG: {
  graphqlUrl: string;
  cacheConfig: {
    stdTTL: number;
    checkperiod: number;
    maxKeys: number;
  };
} = {
  graphqlUrl: 'http://localhost:3001/query',
  cacheConfig: {
    stdTTL: 60, // 1 minute for tests
    checkperiod: 120,
    maxKeys: 100,
  },
};
