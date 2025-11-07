/**
 * get_transactions Tool
 *
 * Vault transaction history with flexible filtering, pagination, and ordering.
 * Supports all transaction types with 5-minute caching.
 *
 * Use cases:
 * - Transaction history for specific vaults
 * - Filtering by transaction type (deposits, redemptions, etc.)
 * - Pagination and ordering support
 * - Performance: ~300-800 tokens per query (depending on result count)
 *
 * Cache strategy:
 * - 5-minute TTL for frequently changing transaction data
 * - Cache key includes filters, pagination, and ordering
 * - Cache hit rate target: 60-70%
 * - Cache tags: [CacheTag.TRANSACTION] for invalidation
 */

import { createHash } from 'crypto';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type GetTransactionsInput } from '../utils/validators.js';
import { TRANSACTIONS_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheKeys, cacheTTL } from '../cache/index.js';

/**
 * Build the where filter for the transactions query
 */
function buildWhereFilter(input: GetTransactionsInput): Record<string, unknown> {
  const where: Record<string, unknown> = {
    chainId_eq: input.chainId,
    vault_in: [input.vaultAddress.toLowerCase()],
  };

  if (input.transactionTypes && input.transactionTypes.length > 0) {
    where.type_in = input.transactionTypes;
  }

  return where;
}

/**
 * Generate a hash of the filters for cache key uniqueness
 */
function hashFilters(filters: Record<string, unknown>): string {
  const hash = createHash('md5');
  hash.update(JSON.stringify(filters));
  return hash.digest('hex').slice(0, 8);
}

/**
 * Transaction item type from GraphQL response
 */
interface TransactionItem {
  id: string;
  type: string;
  timestamp: number;
  blockNumber: number;
  hash: string;
  logIndex: number;
  chain: {
    id: number;
    name: string;
  };
  vault: {
    id: string;
    address: string;
  };
  data: unknown;
}

/**
 * Process transaction data and ensure type safety
 */
function processTransaction(tx: TransactionItem): TransactionItem {
  return {
    id: tx.id,
    type: tx.type,
    timestamp: tx.timestamp,
    blockNumber: tx.blockNumber,
    hash: tx.hash,
    logIndex: tx.logIndex,
    chain: tx.chain,
    vault: tx.vault,
    data: tx.data,
  };
}

/**
 * Transaction response interface
 */
interface TransactionsResponse {
  transactions: {
    items: TransactionItem[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      count: number;
      limit: number;
      skip: number;
      totalCount: number;
    };
  };
}

/**
 * Processed transaction output
 */
interface TransactionsOutput {
  vaultAddress: string;
  chainId: number;
  transactions: TransactionItem[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    count: number;
    totalCount: number;
  };
  filters: {
    transactionTypes?: string[];
    orderBy: string;
    orderDirection: string;
  };
}

/**
 * GraphQL variables type for TRANSACTIONS_QUERY
 */
interface TransactionsVariables {
  first: number;
  skip: number;
  where: Record<string, unknown>;
  orderBy: string;
  orderDirection: string;
}

/**
 * Transform raw GraphQL response into processed output
 * Uses closure to capture input and processed parameters
 */
function createTransformTransactionsData(
  input: GetTransactionsInput,
  orderBy: string,
  orderDirection: string
) {
  return (data: TransactionsResponse): TransactionsOutput => {
    // Process transactions
    const transactions = data.transactions.items.map(processTransaction);

    // Build result
    return {
      vaultAddress: input.vaultAddress,
      chainId: input.chainId,
      transactions,
      pageInfo: {
        hasNextPage: data.transactions.pageInfo.hasNextPage,
        hasPreviousPage: data.transactions.pageInfo.hasPreviousPage,
        count: data.transactions.pageInfo.count,
        totalCount: data.transactions.pageInfo.totalCount,
      },
      filters: {
        transactionTypes: input.transactionTypes,
        orderBy,
        orderDirection,
      },
    };
  };
}

/**
 * Create the executeGetTransactions function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteGetTransactions(
  container: ServiceContainer
): (input: GetTransactionsInput) => Promise<CallToolResult> {
  // Map to track in-flight requests at tool level (shared across all calls)
  const inFlightRequests = new Map<string, Promise<CallToolResult>>();

  return async (input: GetTransactionsInput) => {
    // Extract parameters with defaults
    const first = input.pagination?.first ?? 100;
    const skip = input.pagination?.skip ?? 0;
    const orderBy = input.orderBy ?? 'blockNumber';
    const orderDirection = input.orderDirection ?? 'desc';

    // Build where filter
    const where = buildWhereFilter(input);
    const filterHash = hashFilters(where);

    // Generate cache key for deduplication
    const cacheKey = cacheKeys.transactions({
      vaultAddress: input.vaultAddress.toLowerCase(),
      chainId: input.chainId,
      filterHash,
      first,
      skip,
      orderBy,
      orderDirection,
    });

    // Check for in-flight request with same key (request deduplication)
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return await inFlight;
    }

    // Create new request promise
    const requestPromise = (async (): Promise<CallToolResult> => {
      try {
        const executor = executeToolWithCache<
          GetTransactionsInput,
          TransactionsResponse,
          TransactionsVariables,
          TransactionsOutput
        >({
          container,
          cacheKey: (input) =>
            cacheKeys.transactions({
              vaultAddress: input.vaultAddress.toLowerCase(),
              chainId: input.chainId,
              filterHash,
              first,
              skip,
              orderBy,
              orderDirection,
            }),
          cacheTTL: cacheTTL.transactions,
          query: TRANSACTIONS_QUERY,
          variables: () => ({
            first,
            skip,
            where,
            orderBy,
            orderDirection,
          }),
          validateResult: (data) => {
            // Missing transactions object entirely = malformed response (error)
            if (!data.transactions) {
              return {
                valid: false,
                message: `No transaction data found for vault ${input.vaultAddress}`,
                isError: true, // Malformed response structure
              };
            }
            // Null/undefined items array = malformed response (error)
            if (data.transactions.items === null || data.transactions.items === undefined) {
              return {
                valid: false,
                message: `No transaction data found for vault ${input.vaultAddress}`,
                isError: true, // Malformed response structure
              };
            }
            // Empty array OR has items = valid response (transform will handle empty arrays)
            return { valid: true };
          },
          transformResult: createTransformTransactionsData(input, orderBy, orderDirection),
          toolName: 'get_transactions',
        });

        // Register cache tags for invalidation
        container.cacheInvalidator.register(cacheKey, [CacheTag.TRANSACTION]);

        return await executor(input);
      } finally {
        // Clean up in-flight request regardless of success/failure
        inFlightRequests.delete(cacheKey);
      }
    })();

    // Store in-flight request
    inFlightRequests.set(cacheKey, requestPromise);

    // Return the promise
    return await requestPromise;
  };
}
