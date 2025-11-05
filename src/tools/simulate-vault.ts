/**
 * Simulate Vault Tool
 *
 * Simulates vault operations with new total assets to model deposit/withdrawal scenarios.
 * Provides protocol-accurate fee calculations, APR impact analysis, and settlement requirements.
 *
 * @module tools/simulate-vault
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { simulateVaultManagement } from '../sdk/simulation-service.js';
import { transformPeriodSummariesToAPRData } from '../sdk/apr-service.js';
import { formatBigInt, safeBigIntStringify } from '../sdk/math-utils.js';
import { graphqlClient } from '../graphql/client.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import type { VaultData } from '../types/generated.js';
import { GET_PERIOD_SUMMARIES_QUERY } from '../graphql/queries/period-summaries.js';

/**
 * Input schema for simulate_vault tool
 */
export const simulateVaultInputSchema = z.object({
  vaultAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  chainId: z.number().int().positive('Chain ID must be a positive integer'),
  newTotalAssets: z
    .string()
    .regex(/^\d+$/, 'New total assets must be a positive integer string (wei)'),
  settleDeposit: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to settle pending deposits'),
  includeAPRCalculations: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include APR analysis in results'),
});

export type SimulateVaultInput = z.infer<typeof simulateVaultInputSchema>;

/**
 * JSON schema for tool registration
 */
export const simulateVaultJsonSchema = zodToJsonSchema(
  simulateVaultInputSchema,
  'simulateVaultInput'
);

/**
 * Execute simulate_vault tool
 *
 * Complete workflow:
 * 1. Validate input parameters
 * 2. Fetch vault data from GraphQL
 * 3. Optionally fetch period summaries for APR calculations
 * 4. Execute SDK simulation
 * 5. Format comprehensive response
 *
 * @param input - Validated tool input
 * @returns Formatted simulation results
 * @throws {Error} For validation, GraphQL, or simulation failures
 *
 * @example
 * ```typescript
 * const result = await executeSimulateVault({
 *   vaultAddress: '0x1234...',
 *   chainId: 42161,
 *   newTotalAssets: '2000000000',
 *   settleDeposit: true,
 *   includeAPRCalculations: true
 * });
 * ```
 */
export async function executeSimulateVault(input: SimulateVaultInput): Promise<CallToolResult> {
  try {
    const { vaultAddress, chainId, newTotalAssets, settleDeposit, includeAPRCalculations } = input;

    // 1. Fetch vault data
    const vaultQuery = `
      query GetVault($vaultAddress: String!, $chainId: Int!) {
        vault(address: $vaultAddress, chainId: $chainId) {
          address
          name
          symbol
          decimals
          asset {
            address
            symbol
            name
            decimals
          }
          state {
            totalSupply
            totalAssets
            highWaterMark
            lastFeeTime
            managementFee
            performanceFee
            version
            safeAssetBalance
            pendingSiloBalances {
              assets
              shares
            }
            pendingSettlement {
              assets
              shares
            }
          }
          chainId
          tvl
        }
      }
    `;

    const vaultData = await graphqlClient.request<{ vault: VaultData }>(vaultQuery, {
      vaultAddress,
      chainId,
    });

    if (!vaultData?.vault) {
      throw new Error(`Vault not found: ${vaultAddress} on chain ${chainId}`);
    }

    const vault = vaultData.vault;

    // 2. Optionally fetch APR data
    let aprData;
    if (includeAPRCalculations) {
      try {
        const periodSummariesData = await graphqlClient.request<{
          periodSummaries: Array<{
            timestamp: string;
            totalAssetsAtStart: string;
            totalSupplyAtStart: string;
          }>;
        }>(GET_PERIOD_SUMMARIES_QUERY, { vaultAddress, chainId });

        if (periodSummariesData?.periodSummaries?.length > 0) {
          aprData = transformPeriodSummariesToAPRData(periodSummariesData.periodSummaries, vault);
        }
      } catch (error) {
        // Non-fatal: proceed without APR data
        console.warn('Failed to fetch APR data:', error);
      }
    }

    // 3. Execute simulation
    const newTotalAssetsBigInt = BigInt(newTotalAssets);
    const simulationResult = simulateVaultManagement(
      vault,
      newTotalAssetsBigInt,
      aprData,
      settleDeposit
    );

    // 4. Format response
    const vaultDecimals = vault.decimals ?? 18;
    const assetDecimals = vault.asset.decimals;
    const currentTotalAssets = BigInt(vault.state.totalAssets);
    const currentTotalSupply = BigInt(vault.state.totalSupply);

    // Calculate price per share impact using high-precision arithmetic
    // To avoid precision loss with integer division, we use a large precision multiplier
    const PRECISION = BigInt(10 ** 18);

    let priceImpactPercentage = 0;
    let priceImpactAbsolute = BigInt(0);
    let currentPricePerShare = BigInt(0);
    let newPricePerShare = BigInt(0);

    if (currentTotalSupply > 0n && simulationResult.totalSupply > 0n) {
      // Calculate prices with 18 decimal precision
      currentPricePerShare = (currentTotalAssets * PRECISION) / currentTotalSupply;
      newPricePerShare = (simulationResult.totalAssets * PRECISION) / simulationResult.totalSupply;

      priceImpactAbsolute = newPricePerShare - currentPricePerShare;
      priceImpactPercentage =
        currentPricePerShare > 0n
          ? Number((priceImpactAbsolute * 10000n) / currentPricePerShare) / 100
          : 0;
    } else if (simulationResult.totalSupply > 0n) {
      // New vault case - no current price to compare
      newPricePerShare = (simulationResult.totalAssets * PRECISION) / simulationResult.totalSupply;
      currentPricePerShare = PRECISION; // 1.0 as default
      priceImpactAbsolute = BigInt(0);
      priceImpactPercentage = 0;
    }

    // Build response
    const response = {
      simulation: {
        vaultAddress,
        chainId,
        timestamp: Date.now(),
        sdkVersion: '@lagoon-protocol/v0-computation@0.12.0',
      },
      currentState: {
        totalAssets: vault.state.totalAssets,
        totalAssetsFormatted: formatBigInt(currentTotalAssets, assetDecimals),
        totalSupply: vault.state.totalSupply,
        totalSupplyFormatted: formatBigInt(currentTotalSupply, vaultDecimals),
        pricePerShare: currentPricePerShare.toString(),
        pricePerShareFormatted: formatBigInt(currentPricePerShare, assetDecimals),
        managementFee: vault.state.managementFee,
        performanceFee: vault.state.performanceFee,
        highWaterMark: vault.state.highWaterMark,
      },
      simulatedState: {
        totalAssets: simulationResult.totalAssets.toString(),
        totalAssetsFormatted: formatBigInt(simulationResult.totalAssets, assetDecimals),
        totalSupply: simulationResult.totalSupply.toString(),
        totalSupplyFormatted: formatBigInt(simulationResult.totalSupply, vaultDecimals),
        pricePerShare: newPricePerShare.toString(),
        pricePerShareFormatted: formatBigInt(newPricePerShare, assetDecimals),
        feesAccrued: {
          total: simulationResult.feesAccrued.toString(),
          totalFormatted: formatBigInt(simulationResult.feesAccrued, assetDecimals),
          management: 'Included in total',
          performance: 'Included in total',
        },
        sharePriceImpact: {
          absolute: priceImpactAbsolute.toString(),
          absoluteFormatted: formatBigInt(priceImpactAbsolute, assetDecimals),
          percentage: priceImpactPercentage,
          direction:
            priceImpactAbsolute > 0n
              ? 'increase'
              : priceImpactAbsolute < 0n
                ? 'decrease'
                : 'unchanged',
        },
      },
      settlementAnalysis: {
        settleDeposit,
        assetsInSafe: vault.state.safeAssetBalance || '0',
        pendingSiloBalances: {
          assets: vault.state.pendingSiloBalances?.assets || '0',
          shares: vault.state.pendingSiloBalances?.shares || '0',
        },
        pendingSettlement: {
          assets: vault.state.pendingSettlement?.assets || '0',
          shares: vault.state.pendingSettlement?.shares || '0',
        },
      },
      ...(includeAPRCalculations &&
        aprData && {
          aprAnalysis: {
            method: 'Lagoon SDK v0.10.1 (protocol-accurate)',
            dataSource: 'Lagoon GraphQL period summaries',
            ...(aprData.thirtyDay && {
              thirtyDay: {
                timestamp: aprData.thirtyDay.timestamp,
                pricePerShare: aprData.thirtyDay.pricePerShare.toString(),
                pricePerShareFormatted: formatBigInt(
                  aprData.thirtyDay.pricePerShare,
                  assetDecimals
                ),
              },
            }),
            ...(aprData.inception && {
              inception: {
                timestamp: aprData.inception.timestamp,
                pricePerShare: aprData.inception.pricePerShare.toString(),
                pricePerShareFormatted: formatBigInt(
                  aprData.inception.pricePerShare,
                  assetDecimals
                ),
              },
            }),
          },
        }),
    };

    return {
      content: [
        {
          type: 'text',
          text: safeBigIntStringify(response),
        },
      ],
    };
  } catch (error) {
    return handleToolError(error, 'simulate_vault');
  }
}
