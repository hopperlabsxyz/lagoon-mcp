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
export const paginationFirstSchema = z
  .number()
  .int()
  .positive()
  .max(1000, 'Maximum page size is 1000')
  .default(100);

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

      // TVL filters (nested state filters)
      state_totalAssetsUsd_gte: z.number().positive().optional(),
      state_totalAssetsUsd_lte: z.number().positive().optional(),

      // Curator filters
      curatorIds_contains: z.array(z.string()).optional(),
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
  orderBy: z.string().default('totalAssetsUsd'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

// get_vault_performance input
export const getVaultPerformanceInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  timeRange: z.enum(['7d', '30d', '90d', '1y'], {
    errorMap: () => ({ message: 'Time range must be one of: 7d, 30d, 90d, 1y' }),
  }),
});

/**
 * Type inference helpers
 */

export type QueryGraphQLInput = z.infer<typeof queryGraphQLInputSchema>;
export type GetVaultDataInput = z.infer<typeof getVaultDataInputSchema>;
export type GetUserPortfolioInput = z.infer<typeof getUserPortfolioInputSchema>;
export type SearchVaultsInput = z.infer<typeof searchVaultsInputSchema>;
export type GetVaultPerformanceInput = z.infer<typeof getVaultPerformanceInputSchema>;
