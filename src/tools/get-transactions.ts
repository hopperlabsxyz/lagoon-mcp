import { createHash } from 'crypto';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import { type GetTransactionsInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { createSuccessResponse } from '../utils/tool-response.js';
import { TRANSACTIONS_QUERY } from '../graphql/queries/index.js';

// Query now imported from ../graphql/queries/index.js

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
 * Execute the get_transactions tool
 *
 * Queries vault transaction history with flexible filtering, pagination, and ordering.
 * Supports all transaction types: deposits, redemptions, settlements, state changes, and more.
 *
 * @param input - Transaction query parameters (pre-validated by createToolHandler)
 * @returns Transaction history with pagination info
 */
export async function executeGetTransactions(input: GetTransactionsInput): Promise<CallToolResult> {
  try {
    // Extract parameters with defaults (input already validated by createToolHandler)
    const first = input.pagination?.first ?? 100;
    const skip = input.pagination?.skip ?? 0;
    const orderBy = input.orderBy ?? 'blockNumber';
    const orderDirection = input.orderDirection ?? 'desc';

    // Build where filter
    const where = buildWhereFilter(input);
    const filterHash = hashFilters(where);

    // Generate cache key
    const cacheKey = cacheKeys.transactions({
      vaultAddress: input.vaultAddress.toLowerCase(),
      chainId: input.chainId,
      filterHash,
      first,
      skip,
      orderBy,
      orderDirection,
    });

    // Check cache
    const cached = cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    // Execute GraphQL query
    const response = await graphqlClient.request<TransactionsResponse>(TRANSACTIONS_QUERY, {
      first,
      skip,
      where,
      orderBy,
      orderDirection,
    });

    // Process transactions
    const transactions = response.transactions.items.map(processTransaction);

    // Build result
    const result = {
      vaultAddress: input.vaultAddress,
      chainId: input.chainId,
      transactions,
      pageInfo: {
        hasNextPage: response.transactions.pageInfo.hasNextPage,
        hasPreviousPage: response.transactions.pageInfo.hasPreviousPage,
        count: response.transactions.pageInfo.count,
        totalCount: response.transactions.pageInfo.totalCount,
      },
      filters: {
        transactionTypes: input.transactionTypes,
        orderBy,
        orderDirection,
      },
    };

    // Cache result
    cache.set(cacheKey, result, cacheTTL.transactions);

    return createSuccessResponse(result);
  } catch (error) {
    return handleToolError(error, 'get_transactions');
  }
}
