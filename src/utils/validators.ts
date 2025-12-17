/**
 * Input Validation Schemas
 *
 * Zod schemas for runtime type validation of tool inputs
 */

import { z } from 'zod';

/**
 * Reusable validation schemas
 */

// Ethereum address (0x + 40 hex characters)
export const ethereumAddressSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{40}$/,
    'Invalid Ethereum address format (must be 0x followed by 40 hex characters)'
  );

// Chain ID (positive integer)
export const chainIdSchema = z.number().int().positive('Chain ID must be a positive integer');

// Pagination first parameter
// Default reduced from 100 to 20 for token efficiency (~80% reduction per query)
export const paginationFirstSchema = z
  .number()
  .int()
  .positive()
  .max(1000, 'Maximum page size is 1000')
  .default(20);

// Pagination skip parameter
export const paginationSkipSchema = z
  .number()
  .int()
  .nonnegative('Skip must be non-negative')
  .default(0);

/**
 * Tool-specific validation schemas
 */

// query_graphql input
export const queryGraphQLInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  variables: z.record(z.unknown()).optional(),
});

// get_vault_data input
export const getVaultDataInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
});

// get_user_portfolio input
export const getUserPortfolioInputSchema = z.object({
  userAddress: ethereumAddressSchema,
  responseFormat: z
    .enum(['list', 'summary', 'full'])
    .default('summary')
    .describe(
      'Response detail level: list (~60 tokens/vault), summary (~170 tokens/vault), full (~600 tokens/vault). Default: summary'
    ),
});

// search_vaults input
export const searchVaultsInputSchema = z.object({
  filters: z
    .object({
      // Asset filters
      assetSymbol_eq: z.string().optional(),
      assetSymbol_in: z.array(z.string()).optional(),
      assetId_eq: z.string().optional(),
      assetId_in: z.array(z.string()).optional(),

      // Chain filters
      chainId_eq: chainIdSchema.optional(),
      chainId_in: z.array(chainIdSchema).optional(),

      // Curator filters
      curatorIds_contains: z.string().optional(),
      curatorIds_contains_any: z.array(z.string()).optional(),

      // Visibility
      isVisible_eq: z.boolean().optional(),

      // Additional filters
      address_eq: ethereumAddressSchema.optional(),
      address_in: z.array(ethereumAddressSchema).optional(),
      symbol_eq: z.string().optional(),
      symbol_in: z.array(z.string()).optional(),
      integratorId_eq: z.string().optional(),
      integratorId_in: z.array(z.string()).optional(),
    })
    .optional(),
  pagination: z
    .object({
      first: paginationFirstSchema,
      skip: paginationSkipSchema,
    })
    .optional(),
  orderBy: z.enum(['address', 'chainId', 'id', 'totalAssetsUsd']).default('totalAssetsUsd'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
  // NEW: Response format for token optimization
  responseFormat: z
    .enum(['list', 'summary', 'full'])
    .default('list')
    .describe(
      'Response detail level: list (~60 tokens/vault), summary (~170 tokens/vault), full (~600 tokens/vault)'
    ),
  // NEW: Maximum results for token budget control
  maxResults: z
    .number()
    .int()
    .positive()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum number of results to return (default: 20, max: 50)'),
});

// get_vault_performance input
export const getVaultPerformanceInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  timeRange: z.enum(['7d', '30d', '90d', '1y'], {
    errorMap: () => ({ message: 'Time range must be one of: 7d, 30d, 90d, 1y' }),
  }),
  includeSDKCalculations: z.boolean().optional().default(true),
  responseFormat: z
    .enum(['summary', 'detailed'])
    .default('summary')
    .describe(
      'Response detail level: summary (key metrics only), detailed (full metrics table). Default: summary'
    ),
});

// get_transactions input
export const getTransactionsInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  transactionTypes: z
    .array(
      z.enum([
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
        'VaultState',
        'WhitelistUpdated',
      ])
    )
    .optional(),
  pagination: z
    .object({
      first: paginationFirstSchema,
      skip: paginationSkipSchema,
    })
    .optional(),
  orderBy: z.enum(['blockNumber', 'timestamp', 'id', 'chainId']).default('blockNumber'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
  responseFormat: z
    .enum(['summary', 'list', 'detailed'])
    .default('list')
    .describe(
      'Response detail level: summary (aggregates only ~50 tokens), list (transaction IDs and types ~100-200 tokens), detailed (full transaction data ~300-800 tokens). Default: list'
    ),
});

// compare_vaults input
// Supports both single chainId (backward compat) and chainIds array for cross-chain comparisons
export const compareVaultsInputSchema = z
  .object({
    vaultAddresses: z
      .array(ethereumAddressSchema)
      .min(2, 'At least 2 vault addresses are required for comparison')
      .max(10, 'Maximum 10 vaults can be compared at once'),
    // Single chainId for backward compatibility
    chainId: chainIdSchema.optional(),
    // Array of chainIds for cross-chain comparisons
    chainIds: z.array(chainIdSchema).optional(),
    responseFormat: z
      .enum(['summary', 'full'])
      .default('summary')
      .describe(
        'Response detail level: summary (~170 tokens/vault), full (~600 tokens/vault). Default: summary'
      ),
  })
  .refine((data) => data.chainId !== undefined || (data.chainIds && data.chainIds.length > 0), {
    message: 'Either chainId or chainIds must be provided',
  });

// get_price_history input
export const priceHistoryInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  timeRange: z.enum(['7d', '30d', '90d', '1y', 'all'], {
    errorMap: () => ({ message: 'Time range must be one of: 7d, 30d, 90d, 1y, all' }),
  }),
  responseFormat: z
    .enum(['summary', 'detailed'])
    .default('summary')
    .describe(
      'Response detail level: summary (key metrics only), detailed (full OHLCV table). Default: summary'
    ),
});

// export_data input
export const exportDataInputSchema = z.object({
  vaultAddresses: z.array(ethereumAddressSchema).min(1, 'At least 1 vault address is required'),
  chainId: chainIdSchema,
  dataType: z.enum(['vaults', 'transactions', 'price_history', 'performance'], {
    errorMap: () => ({
      message: 'Data type must be one of: vaults, transactions, price_history, performance',
    }),
  }),
  format: z.enum(['csv', 'json'], {
    errorMap: () => ({ message: 'Format must be either csv or json' }),
  }),
});

// analyze_risk input
export const analyzeRiskInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  responseFormat: z
    .enum(['score', 'summary', 'detailed'])
    .default('summary')
    .describe(
      'Response detail level: score (risk score only ~30 tokens), summary (risk score with key metrics ~200 tokens), detailed (comprehensive risk analysis ~400-600 tokens). Default: summary'
    ),
});

// predict_yield input
export const predictYieldInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  timeRange: z.enum(['7d', '30d', '90d'], {
    errorMap: () => ({ message: 'Time range must be one of: 7d, 30d, 90d' }),
  }),
  responseFormat: z
    .enum(['quick', 'detailed'])
    .default('quick')
    .describe(
      'Response detail level: quick (prediction only), detailed (with confidence intervals and analysis). Default: quick'
    ),
});

// optimize_portfolio input
export const optimizePortfolioInputSchema = z.object({
  vaultAddresses: z
    .array(ethereumAddressSchema)
    .min(2, 'At least 2 vault addresses are required for portfolio optimization')
    .max(20, 'Maximum 20 vaults can be included in portfolio'),
  chainId: chainIdSchema,
  currentPositions: z.array(
    z.object({
      vaultAddress: ethereumAddressSchema,
      valueUsd: z.number().positive('Position value must be positive'),
    })
  ),
  strategy: z
    .enum(['equal_weight', 'risk_parity', 'max_sharpe', 'min_variance'], {
      errorMap: () => ({
        message: 'Strategy must be one of: equal_weight, risk_parity, max_sharpe, min_variance',
      }),
    })
    .default('max_sharpe'),
  rebalanceThreshold: z
    .number()
    .positive('Rebalance threshold must be positive')
    .max(50, 'Rebalance threshold cannot exceed 50%')
    .default(5.0),
  responseFormat: z
    .enum(['quick', 'balanced', 'detailed'])
    .default('balanced')
    .describe(
      'Response detail level: quick (rebalance status and top actions ~300-400 tokens), balanced (standard output ~800 tokens), detailed (extended insights ~1200 tokens). Default: balanced'
    ),
});

/**
 * Type inference helpers
 */

export type QueryGraphQLInput = z.infer<typeof queryGraphQLInputSchema>;
export type GetVaultDataInput = z.infer<typeof getVaultDataInputSchema>;
export type GetUserPortfolioInput = z.infer<typeof getUserPortfolioInputSchema>;
export type SearchVaultsInput = z.infer<typeof searchVaultsInputSchema>;
export type GetVaultPerformanceInput = z.infer<typeof getVaultPerformanceInputSchema>;
export type GetTransactionsInput = z.infer<typeof getTransactionsInputSchema>;
export type CompareVaultsInput = z.infer<typeof compareVaultsInputSchema>;
export type PriceHistoryInput = z.infer<typeof priceHistoryInputSchema>;
export type ExportDataInput = z.infer<typeof exportDataInputSchema>;
export type AnalyzeRiskInput = z.infer<typeof analyzeRiskInputSchema>;
export type PredictYieldInput = z.infer<typeof predictYieldInputSchema>;
export type OptimizePortfolioInput = z.infer<typeof optimizePortfolioInputSchema>;
