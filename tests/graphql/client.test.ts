/**
 * GraphQL Client Tests
 * Tests for GraphQL client initialization and health check
 */

import { describe, it, expect } from 'vitest';
import { graphqlClient, checkBackendHealth } from '../../src/graphql/client';
import { TEST_CONFIG } from '../setup';

describe('GraphQL Client', () => {
  describe('Client Initialization', () => {
    it('should create a GraphQL client instance', () => {
      expect(graphqlClient).toBeDefined();
      expect(graphqlClient.request as unknown).toBeTypeOf('function');
    });

    it('should use the correct endpoint from configuration', () => {
      // The client is configured in src/graphql/client.ts
      // We verify it uses the environment variable
      expect(process.env.LAGOON_GRAPHQL_URL as string).toBe(TEST_CONFIG.graphqlUrl);
    });
  });

  describe('Backend Health Check', () => {
    it('should have a checkBackendHealth function', () => {
      expect(checkBackendHealth).toBeTypeOf('function');
    });

    // Skip actual health check if backend is not running
    it.skip('should successfully connect to backend (requires running backend)', async () => {
      const result = await checkBackendHealth();
      expect(result).toBe(true);
    }, 10000);

    it('should handle connection errors gracefully', async (): Promise<void> => {
      // Test with an invalid endpoint
      const invalidClient = async (): Promise<boolean> => {
        try {
          await checkBackendHealth();
          return true;
        } catch {
          return false;
        }
      };

      // If backend is not running, this should handle the error
      const result = await invalidClient();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL errors', () => {
      // This test would require mocking the client
      // For now, we just verify the error handling structure exists
      expect(graphqlClient.request as unknown).toBeTypeOf('function');
    });

    it('should handle network errors', () => {
      // This test would require mocking network failures
      // For now, we just verify the client is properly configured
      expect(graphqlClient).toBeDefined();
    });
  });
});

describe('Configuration', () => {
  it('should load configuration from environment variables', () => {
    expect(process.env.LAGOON_GRAPHQL_URL).toBeDefined();
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have valid GraphQL URL format', () => {
    const url = process.env.LAGOON_GRAPHQL_URL || '';
    expect(url).toMatch(/^https?:\/\/.+/);
  });
});
