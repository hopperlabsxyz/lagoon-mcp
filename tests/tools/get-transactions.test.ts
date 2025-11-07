/**
 * get_transactions Tool Tests
 *
 * Comprehensive test suite covering:
 * - All transaction types (Deposit, Withdrawal, Swap, etc.)
 * - Pagination (first, skip parameters)
 * - Filtering (by transaction type, vault, chain)
 * - Ordering (blockNumber, timestamp, asc/desc)
 * - Cache behavior (miss → store, hit → instant return)
 * - Edge cases (empty results, invalid inputs, network failures)
 * - GraphQL error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExecuteGetTransactions } from '../../src/tools/get-transactions';
import * as graphqlClientModule from '../../src/graphql/client';
import { cache, cacheTTL } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';
import { GetTransactionsInput } from '../../src/utils/validators';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

/**
 * Transaction types supported by the system
 */
const TRANSACTION_TYPES = [
  'SettleDeposit',
  'SettleRedeem',
  'DepositRequest',
  'RedeemRequest',
  'NewTotalAssetsUpdated',
  'TotalAssetsUpdated',
  'PeriodSummary',
  'DepositSync',
  'DepositRequestCanceled',
  'RatesUpdated',
  'StateUpdated',
];

/**
 * Helper to create mock transaction item
 */
function createMockTransaction(overrides: Partial<any> = {}): any {
  return {
    id: '0x1234...abc',
    type: 'SettleDeposit',
    timestamp: 1704067200,
    blockNumber: 18900000,
    hash: '0xtxhash1234567890123456789012345678901234567890',
    logIndex: 42,
    chain: {
      id: 42161,
      name: 'Arbitrum One',
    },
    data: {
      sender: '0xuser1234567890123456789012345678901234567',
      owner: '0xuser1234567890123456789012345678901234567',
      assets: '1000000000000000000',
      shares: '1000000000000000000',
      assetsUsd: 1000,
      vault: {
        id: 'vault-123',
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'TEST',
      },
    },
    ...overrides,
  };
}

/**
 * Helper to create mock transactions response
 */
function createMockTransactionsResponse(
  transactions: any[] = [],
  pageInfo: Partial<any> = {}
): any {
  return {
    transactions: {
      items: transactions,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        count: transactions.length,
        limit: 100,
        skip: 0,
        totalCount: transactions.length,
        ...pageInfo,
      },
    },
  };
}

describe('get_transactions tool', () => {
  let mockRequest: ReturnType<typeof vi.fn>;
  let executeGetTransactions: (input: GetTransactionsInput) => Promise<any>;
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    // Reset cache
    cache.flushAll();

    // Reset mocks
    vi.clearAllMocks();
    mockRequest = vi.fn();
    (graphqlClientModule.graphqlClient.request as any) = mockRequest;

    // Create mock container
    mockContainer = createMockContainer();

    // Create tool executor
    executeGetTransactions = createExecuteGetTransactions(mockContainer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should fetch transactions for a vault successfully', async () => {
      const mockTx = createMockTransaction();
      const mockResponse = createMockTransactionsResponse([mockTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(1);
      expect(content.transactions[0].type).toBe('SettleDeposit');
      expect(content.vaultAddress).toBe(input.vaultAddress);
      expect(content.chainId).toBe(input.chainId);
      expect(mockRequest).toHaveBeenCalledOnce();
    });

    it('should return empty array when no transactions exist', async () => {
      const mockResponse = createMockTransactionsResponse([]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(0);
      expect(content.pageInfo.totalCount).toBe(0);
    });
  });

  describe('Transaction Type Filtering', () => {
    it('should filter by single transaction type', async () => {
      const depositTx = createMockTransaction({ type: 'SettleDeposit' });
      const mockResponse = createMockTransactionsResponse([depositTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        transactionTypes: ['SettleDeposit'],
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(1);
      expect(content.transactions[0].type).toBe('SettleDeposit');
      expect(content.filters.transactionTypes).toEqual(['SettleDeposit']);

      // Verify GraphQL query included type filter
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].where.type_in).toEqual(['SettleDeposit']);
    });

    it('should filter by multiple transaction types', async () => {
      const depositTx = createMockTransaction({ type: 'SettleDeposit', id: 'tx-1' });
      const withdrawalTx = createMockTransaction({ type: 'SettleRedeem', id: 'tx-2' });
      const mockResponse = createMockTransactionsResponse([depositTx, withdrawalTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        transactionTypes: ['SettleDeposit', 'SettleRedeem'],
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(2);
      expect(content.filters.transactionTypes).toEqual(['SettleDeposit', 'SettleRedeem']);
    });

    it('should handle all supported transaction types', async () => {
      const transactions = TRANSACTION_TYPES.map((type, idx) =>
        createMockTransaction({ type, id: `tx-${idx}` })
      );
      const mockResponse = createMockTransactionsResponse(transactions);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        transactionTypes: TRANSACTION_TYPES as GetTransactionsInput['transactionTypes'],
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(TRANSACTION_TYPES.length);
    });
  });

  describe('Pagination', () => {
    it('should paginate results with first parameter', async () => {
      const transactions = Array.from({ length: 10 }, (_, i) =>
        createMockTransaction({ id: `tx-${i}` })
      );
      const mockResponse = createMockTransactionsResponse(transactions, {
        hasNextPage: true,
        limit: 10,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: {
          first: 10,
          skip: 0,
        },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(10);
      expect(content.pageInfo.hasNextPage).toBe(true);

      // Verify GraphQL query used first parameter
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].first).toBe(10);
    });

    it('should paginate results with skip parameter', async () => {
      const transactions = Array.from({ length: 10 }, (_, i) =>
        createMockTransaction({ id: `tx-${i + 20}` })
      );
      const mockResponse = createMockTransactionsResponse(transactions, {
        hasPreviousPage: true,
        skip: 20,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: {
          first: 10,
          skip: 20,
        },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.pageInfo.hasPreviousPage).toBe(true);

      // Verify GraphQL query used skip parameter
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].skip).toBe(20);
    });

    it('should use default pagination when not specified', async () => {
      const mockResponse = createMockTransactionsResponse([]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      await executeGetTransactions(input);

      // Verify default values: first=100, skip=0
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].first).toBe(100);
      expect(callArgs[1].skip).toBe(0);
    });

    it('should handle large pagination offsets', async () => {
      const transactions = Array.from({ length: 5 }, (_, i) =>
        createMockTransaction({ id: `tx-${i + 1000}` })
      );
      const mockResponse = createMockTransactionsResponse(transactions, {
        hasPreviousPage: true,
        totalCount: 1050,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: {
          first: 50,
          skip: 1000,
        },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.pageInfo.totalCount).toBe(1050);
    });
  });

  describe('Ordering', () => {
    it('should order by blockNumber descending (default)', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1', blockNumber: 18900003 }),
        createMockTransaction({ id: 'tx-2', blockNumber: 18900002 }),
        createMockTransaction({ id: 'tx-3', blockNumber: 18900001 }),
      ];
      const mockResponse = createMockTransactionsResponse(transactions);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.filters.orderBy).toBe('blockNumber');
      expect(content.filters.orderDirection).toBe('desc');

      // Verify transactions are in descending order
      expect(content.transactions[0].blockNumber as number).toBeGreaterThan(
        content.transactions[1].blockNumber as number
      );
    });

    it('should order by timestamp ascending', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1', timestamp: 1704067200 }),
        createMockTransaction({ id: 'tx-2', timestamp: 1704067300 }),
        createMockTransaction({ id: 'tx-3', timestamp: 1704067400 }),
      ];
      const mockResponse = createMockTransactionsResponse(transactions);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'timestamp',
        orderDirection: 'asc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.filters.orderBy).toBe('timestamp');
      expect(content.filters.orderDirection).toBe('asc');

      // Verify GraphQL query used correct ordering
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].orderBy).toBe('timestamp');
      expect(callArgs[1].orderDirection).toBe('asc');
    });

    it('should order by blockNumber ascending', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx-1', blockNumber: 18900001 }),
        createMockTransaction({ id: 'tx-2', blockNumber: 18900002 }),
      ];
      const mockResponse = createMockTransactionsResponse(transactions);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'asc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.filters.orderDirection).toBe('asc');
    });
  });

  describe('Cache Behavior', () => {
    it('should cache query results', async () => {
      const mockTx = createMockTransaction();
      const mockResponse = createMockTransactionsResponse([mockTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      // First call - cache miss
      await executeGetTransactions(input);
      expect(mockRequest).toHaveBeenCalledOnce();

      // Second call - cache hit
      await executeGetTransactions(input);
      expect(mockRequest).toHaveBeenCalledOnce(); // Still only once
    });

    it('should generate different cache keys for different filters', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()]);
      mockRequest.mockResolvedValue(mockResponse);

      const baseInput: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      // Call 1: No filter
      await executeGetTransactions(baseInput);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Call 2: With filter - should be cache miss
      await executeGetTransactions({
        ...baseInput,
        transactionTypes: ['SettleDeposit'],
      });
      expect(mockRequest).toHaveBeenCalledTimes(2);

      // Call 3: Same filter - should be cache hit
      await executeGetTransactions({
        ...baseInput,
        transactionTypes: ['SettleDeposit'],
      });
      expect(mockRequest).toHaveBeenCalledTimes(2); // No new call
    });

    it('should generate different cache keys for different pagination', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()]);
      mockRequest.mockResolvedValue(mockResponse);

      const baseInput: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      // Call 1: Page 1
      await executeGetTransactions({ ...baseInput, pagination: { first: 10, skip: 0 } });
      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Call 2: Page 2 - different cache key
      await executeGetTransactions({ ...baseInput, pagination: { first: 10, skip: 10 } });
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should respect cache TTL of 5 minutes', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()]);
      mockRequest.mockResolvedValue(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      // Verify TTL is set to 5 minutes (300 seconds)
      expect(cacheTTL.transactions).toBe(300);

      await executeGetTransactions(input);
      expect(mockRequest).toHaveBeenCalledOnce();
    });

    it('should normalize vault address to lowercase for cache key', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()]);
      mockRequest.mockResolvedValue(mockResponse);

      // Call with uppercase address
      await executeGetTransactions({
        vaultAddress: '0X1234567890ABCDEF1234567890ABCDEF12345678',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      });

      // Call with lowercase address - should hit cache
      await executeGetTransactions({
        vaultAddress: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      });

      expect(mockRequest).toHaveBeenCalledOnce();
    });
  });

  describe('Transaction Data Structure', () => {
    it('should include all required transaction fields', async () => {
      const mockTx = createMockTransaction({
        id: 'tx-123',
        type: 'SettleDeposit',
        timestamp: 1704067200,
        blockNumber: 18900000,
        hash: '0xtxhash123',
        logIndex: 42,
      });
      const mockResponse = createMockTransactionsResponse([mockTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);
      const tx = content.transactions[0];

      expect(tx).toHaveProperty('id');
      expect(tx).toHaveProperty('type');
      expect(tx).toHaveProperty('timestamp');
      expect(tx).toHaveProperty('blockNumber');
      expect(tx).toHaveProperty('hash');
      expect(tx).toHaveProperty('logIndex');
      expect(tx).toHaveProperty('chain');
      expect(tx).toHaveProperty('vault');
      expect(tx).toHaveProperty('data');
    });

    it('should include chain information', async () => {
      const mockTx = createMockTransaction({
        chain: {
          id: 42161,
          name: 'Arbitrum One',
        },
      });
      const mockResponse = createMockTransactionsResponse([mockTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);
      const tx = content.transactions[0];

      expect(tx.chain.id).toBe(42161);
      expect(tx.chain.name).toBe('Arbitrum One');
    });

    it('should include vault information', async () => {
      const mockTx = createMockTransaction({
        vault: {
          id: 'vault-123',
          address: '0x1234567890123456789012345678901234567890',
        },
      });
      const mockResponse = createMockTransactionsResponse([mockTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);
      const tx = content.transactions[0];

      expect(tx.vault.id).toBe('vault-123');
      expect(tx.vault.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should include transaction-specific data', async () => {
      const mockTx = createMockTransaction({
        type: 'SettleDeposit',
        data: {
          sender: '0xuser1234567890123456789012345678901234567',
          owner: '0xuser1234567890123456789012345678901234567',
          assets: '1000000000000000000',
          shares: '1000000000000000000',
          assetsUsd: 1000,
        },
      });
      const mockResponse = createMockTransactionsResponse([mockTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);
      const tx = content.transactions[0];

      expect(tx.data.sender).toBeDefined();
      expect(tx.data.assets).toBeDefined();
      expect(tx.data.shares).toBeDefined();
      expect(tx.data.assetsUsd).toBe(1000);
    });
  });

  describe('Page Info', () => {
    it('should include complete page information', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()], {
        hasNextPage: true,
        hasPreviousPage: false,
        count: 1,
        totalCount: 150,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);

      expect(content.pageInfo).toEqual({
        hasNextPage: true,
        hasPreviousPage: false,
        count: 1,
        totalCount: 150,
      });
    });

    it('should indicate first page correctly', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()], {
        hasNextPage: true,
        hasPreviousPage: false,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: { first: 10, skip: 0 },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);

      expect(content.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should indicate middle page correctly', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()], {
        hasNextPage: true,
        hasPreviousPage: true,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: { first: 10, skip: 20 },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);

      expect(content.pageInfo.hasNextPage).toBe(true);
      expect(content.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should indicate last page correctly', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()], {
        hasNextPage: false,
        hasPreviousPage: true,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: { first: 10, skip: 90 },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);
      const content = JSON.parse(result.content[0].text as string);

      expect(content.pageInfo.hasNextPage).toBe(false);
      expect(content.pageInfo.hasPreviousPage).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL network errors', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Network timeout'));

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network timeout');
    });

    it('should handle missing transaction data', async () => {
      mockRequest.mockResolvedValueOnce({});

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No transaction data found');
    });

    it('should handle malformed GraphQL response', async () => {
      mockRequest.mockResolvedValueOnce({
        transactions: {
          items: null, // Invalid structure
        },
      });

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(true);
    });

    it('should handle GraphQL errors array', async () => {
      mockRequest.mockResolvedValueOnce({
        errors: [{ message: 'Invalid vault address format' }],
      });

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle vault with zero transactions', async () => {
      const mockResponse = createMockTransactionsResponse([], {
        totalCount: 0,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(0);
      expect(content.pageInfo.totalCount).toBe(0);
    });

    it('should handle very large transaction batches', async () => {
      const transactions = Array.from({ length: 1000 }, (_, i) =>
        createMockTransaction({ id: `tx-${i}` })
      );
      const mockResponse = createMockTransactionsResponse(transactions);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        pagination: { first: 1000, skip: 0 },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(1000);
    });

    it('should handle transactions with minimal data', async () => {
      const minimalTx = {
        id: 'tx-123',
        type: 'SettleDeposit',
        timestamp: 1704067200,
        blockNumber: 18900000,
        hash: '0xtx',
        logIndex: 0,
        chain: { id: 42161, name: 'Arbitrum' },
        vault: { id: 'vault-1', address: '0x1234' },
        data: {},
      };
      const mockResponse = createMockTransactionsResponse([minimalTx]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);
      expect(content.transactions).toHaveLength(1);
    });

    it('should handle mixed-case vault addresses', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()]);
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0X1234ABcd5678EFgh9012IJkl3456MNop7890QRst',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      // Verify address was lowercased in GraphQL query
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].where.vault_in[0]).toBe('0x1234abcd5678efgh9012ijkl3456mnop7890qrst');
    });

    it('should handle concurrent requests for same vault', async () => {
      const mockResponse = createMockTransactionsResponse([createMockTransaction()]);
      mockRequest.mockResolvedValue(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      // Make 3 concurrent requests
      const results = await Promise.all([
        executeGetTransactions(input),
        executeGetTransactions(input),
        executeGetTransactions(input),
      ]);

      // All should succeed
      results.forEach((result) => {
        expect(result.isError).toBe(false);
      });

      // First call fetches, others hit cache
      expect(mockRequest).toHaveBeenCalledOnce();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle filtered + paginated + ordered query', async () => {
      const transactions = [
        createMockTransaction({
          type: 'SettleDeposit',
          blockNumber: 18900003,
          id: 'tx-3',
        }),
        createMockTransaction({
          type: 'SettleDeposit',
          blockNumber: 18900002,
          id: 'tx-2',
        }),
        createMockTransaction({
          type: 'SettleDeposit',
          blockNumber: 18900001,
          id: 'tx-1',
        }),
      ];
      const mockResponse = createMockTransactionsResponse(transactions, {
        hasNextPage: true,
        hasPreviousPage: true,
        totalCount: 100,
      });
      mockRequest.mockResolvedValueOnce(mockResponse);

      const input: GetTransactionsInput = {
        vaultAddress: '0x1234567890123456789012345678901234567890',
        chainId: 42161,
        transactionTypes: ['SettleDeposit'],
        pagination: { first: 3, skip: 10 },
        orderBy: 'blockNumber',
        orderDirection: 'desc',
        responseFormat: 'detailed',
      };

      const result = await executeGetTransactions(input);

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text as string);

      // Verify all parameters were applied
      expect(content.filters.transactionTypes).toEqual(['SettleDeposit']);
      expect(content.filters.orderBy).toBe('blockNumber');
      expect(content.filters.orderDirection).toBe('desc');
      expect(content.pageInfo.hasNextPage).toBe(true);
      expect(content.pageInfo.hasPreviousPage).toBe(true);

      // Verify GraphQL query
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[1].where.type_in).toEqual(['SettleDeposit']);
      expect(callArgs[1].first).toBe(3);
      expect(callArgs[1].skip).toBe(10);
      expect(callArgs[1].orderBy).toBe('blockNumber');
      expect(callArgs[1].orderDirection).toBe('desc');
    });
  });
});
