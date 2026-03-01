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
import { createExecuteQueryGraphQL } from '../../src/tools/query-graphql';
import * as graphqlClientModule from '../../src/graphql/client';
import { createMockContainer } from '../helpers/test-container';
import { parseJsonWithDisclaimer } from '../helpers/json-parser';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

describe('query_graphql Tool', () => {
  // Executor function created from factory with mock container
  let executeQueryGraphQL: ReturnType<typeof createExecuteQueryGraphQL>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executeQueryGraphQL = createExecuteQueryGraphQL(mockContainer);
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
      const parsed = parseJsonWithDisclaimer(responseText);
      expect(parsed).toEqual(mockResponse);
    });
  });

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  describe('Query Validation', () => {
    it('should reject GraphQL syntax errors before execution', async () => {
      const input = {
        query: 'query { }', // Invalid — empty selection set
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query validation failed');
      expect(result.content[0].text).toContain('Syntax Error');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should reject mutation operations', async () => {
      const input = {
        query: 'mutation { deleteVault(id: "123") { id } }',
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Only query operations are allowed');
      expect(result.content[0].text).toContain('mutation');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should reject subscription operations', async () => {
      const input = {
        query: 'subscription { vaultUpdated { id } }',
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Only query operations are allowed');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should reject queries exceeding depth limit', async () => {
      // Build a query with depth > 10
      const input = {
        query: 'query { a { b { c { d { e { f { g { h { i { j { k { l } } } } } } } } } } } }',
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('exceeds maximum allowed depth');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should reject queries exceeding alias limit', async () => {
      // Build a query with > 20 aliases
      const aliases = Array.from({ length: 21 }, (_, i) => `a${i}: field`).join(' ');
      const input = {
        query: `query { ${aliases} }`,
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('aliases');
      expect(result.content[0].text).toContain('exceeding maximum');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should allow queries within alias limit', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({ ok: true });

      const aliases = Array.from({ length: 5 }, (_, i) => `a${i}: field`).join(' ');
      const input = {
        query: `query { ${aliases} }`,
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalled();
    });

    it('should count depth through fragment spreads', async () => {
      // Fragment adds depth beyond what inline fields provide
      // Total depth: query(1) > a(2) > ...FragA > b(3) > c(4) > d(5) > e(6) > f(7) > g(8) > h(9) > i(10) > j(11) > k(12)
      const input = {
        query: `
          query { a { ...FragA } }
          fragment FragA on T { b { c { d { e { f { g { h { i { j { k } } } } } } } } } }
        `,
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('exceeds maximum allowed depth');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should count aliases inside fragments', async () => {
      // Fragment contains 11 aliases, spread twice = 22 total > MAX_ALIASES (20)
      const aliases = Array.from({ length: 11 }, (_, i) => `a${i}: field`).join(' ');
      const input = {
        query: `
          query { x { ...F } y { ...F } }
          fragment F on T { ${aliases} }
        `,
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('aliases');
      expect(result.content[0].text).toContain('exceeding maximum');
      expect(graphqlClientModule.graphqlClient.request).not.toHaveBeenCalled();
    });

    it('should re-evaluate fragment depth at each spread site (per-path)', async () => {
      // Fragment spread at depth 2 AND depth 9 — must detect max depth through deeper path
      // shallow: query(1) > shallow(2) > ...DeepFrag > a(3) > b(4) > c(5) — OK (depth 5)
      // deep: query(1) > d1(2) > d2(3) > d3(4) > d4(5) > d5(6) > d6(7) > d7(8) > d8(9) > ...DeepFrag > a(10) > b(11) > c(12) — exceeds MAX_QUERY_DEPTH
      const input = {
        query: `
          query { shallow { ...DeepFrag } d1 { d2 { d3 { d4 { d5 { d6 { d7 { d8 { ...DeepFrag } } } } } } } } }
          fragment DeepFrag on T { a { b { c } } }
        `,
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('exceeds maximum allowed depth');
    });

    it('should handle cyclic fragment references without infinite loop', async () => {
      // FragA references FragB, FragB references FragA — cycle
      const input = {
        query: `
          query { ...FragA }
          fragment FragA on T { a { ...FragB } }
          fragment FragB on T { b { ...FragA } }
        `,
      };

      // Should not hang — cycle is detected and broken
      const result = await executeQueryGraphQL(input);

      // The query itself may be valid or invalid depth-wise, but it must not hang
      expect(result).toBeDefined();
    });

    it('should allow valid queries within depth limit', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({ test: true });

      const input = {
        query: 'query { a { b { c } } }', // Depth 3, well within limit
      };

      const result = await executeQueryGraphQL(input);

      expect(result.isError).toBe(false);
      expect(graphqlClientModule.graphqlClient.request).toHaveBeenCalled();
    });

    it('should handle field not found errors from server', async () => {
      // Arrange — query passes local validation but fails on server
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
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      expect(parsed).toEqual({});
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
      const parsed = parseJsonWithDisclaimer(result.content[0].text as string);
      expect(parsed.items).toHaveLength(100);
    });
  });
});
