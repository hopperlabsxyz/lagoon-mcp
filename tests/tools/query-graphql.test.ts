/**
 * query_graphql Tool Tests
 *
 * Tests for the query_graphql tool handler covering:
 * - Valid query execution
 * - Query with variables
 * - GraphQL syntax errors
 * - Network timeout handling
 * - Input validation failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeQueryGraphQL } from '../../src/tools/query-graphql';
import * as graphqlClientModule from '../../src/graphql/client';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

describe('query_graphql Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Valid Query Execution', () => {
    it('should execute a simple query successfully', async () => {
      // Arrange
      const mockResponse = {
        getGlobalTVL: '1234567890',
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query: 'query { getGlobalTVL }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('getGlobalTVL');
      expect(result.content[0].text).toContain('1234567890');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        input.query,
        undefined
      );
    });

    it('should execute a query with variables successfully', async () => {
      // Arrange
      const mockResponse = {
        vaultByAddress: {
          id: 'vault-123',
          symbol: 'TEST-VAULT',
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query:
          'query GetVault($address: String!, $chainId: Int!) { vaultByAddress(address: $address, chainId: $chainId) { id symbol } }',
        variables: {
          address: '0x1234567890123456789012345678901234567890',
          chainId: 1,
        },
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('vault-123');
      expect(result.content[0].text).toContain('TEST-VAULT');
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        input.query,
        input.variables
      );
    });

    it('should format the response as pretty-printed JSON', async () => {
      // Arrange
      const mockResponse = {
        data: {
          nested: {
            value: 'test',
          },
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query: 'query { data { nested { value } } }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      const responseText = result.content[0].text as string;
      expect(responseText).toContain('\n'); // Pretty-printed JSON should have newlines
      expect(responseText).toContain('  '); // Should have indentation
      const parsed = JSON.parse(responseText);
      expect(parsed).toEqual(mockResponse);
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('GraphQL Syntax Errors', () => {
    it('should handle GraphQL syntax errors gracefully', async () => {
      // Arrange
      const graphqlError = {
        response: {
          errors: [
            {
              message: 'Syntax Error: Expected Name, found }',
              locations: [{ line: 1, column: 10 }],
            },
          ],
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(graphqlError);

      const input = {
        query: 'query { }', // Invalid GraphQL syntax
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('GraphQL Error');
      expect(result.content[0].text).toContain('Syntax Error');
    });

    it('should handle field not found errors', async () => {
      // Arrange
      const graphqlError = {
        response: {
          errors: [
            {
              message: 'Cannot query field "nonExistentField" on type "Query"',
            },
          ],
        },
      };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(graphqlError);

      const input = {
        query: 'query { nonExistentField }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('GraphQL Error');
      expect(result.content[0].text).toContain('nonExistentField');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network timeout errors', async () => {
      // Arrange
      const networkError = new Error('Network timeout');
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(networkError);

      const input = {
        query: 'query { test }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Network timeout');
    });

    it('should handle connection refused errors', async () => {
      // Arrange
      const networkError = new Error('ECONNREFUSED');
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(networkError);

      const input = {
        query: 'query { test }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('ECONNREFUSED');
    });

    it('should handle unknown errors gracefully', async () => {
      // Arrange
      const unknownError = 'Unknown error string';
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(unknownError);

      const input = {
        query: 'query { test }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('Variable Handling', () => {
    it('should pass complex variable types correctly', async () => {
      // Arrange
      const mockResponse = { result: 'success' };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query: 'query Test($filters: FilterInput!) { test(filters: $filters) }',
        variables: {
          filters: {
            chainId: 1,
            minTvl: 1000000,
            assetSymbol: 'USDC',
            isVisible: true,
          },
        },
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(
        input.query,
        input.variables
      );
    });

    it('should handle null variables', async () => {
      // Arrange
      const mockResponse = { result: 'success' };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query: 'query { test }',
        variables: {},
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalledWith(input.query, {});
    });
  });

  describe('Response Formatting', () => {
    it('should handle empty response objects', async () => {
      // Arrange
      const mockResponse = {};
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query: 'query { test }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('{}');
    });

    it('should handle large response payloads', async () => {
      // Arrange
      const largeArray = Array(100)
        .fill(null)
        .map((_, i) => ({ id: `item-${i}`, value: `value-${i}` }));
      const mockResponse = { items: largeArray };
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue(mockResponse);

      const input = {
        query: 'query { items { id value } }',
      };

      // Act
      const result = await executeQueryGraphQL(input);

      // Assert
      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content[0].text as string);
      expect(parsed.items).toHaveLength(100);
    });
  });
});
