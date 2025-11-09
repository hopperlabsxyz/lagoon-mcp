/**
 * simulate_vault Tool
 *
 * Simulates vault operations with new total assets to model deposit/withdrawal scenarios.
 * Provides protocol-accurate fee calculations, APR impact analysis, and settlement requirements.
 *
 * Use cases:
 * - Simulate deposit/withdrawal impact on share price
 * - Model fee accrual scenarios
 * - Analyze settlement requirements
 * - Validate protocol calculations
 * - Performance: ~400-600 tokens per simulation
 *
 * Cache strategy:
 * - No caching (simulations are specific to input parameters and require fresh vault state)
 *
 * WHY NO CACHING?
 * This tool is intentionally non-cached because:
 * 1. Simulations are parameter-specific (newTotalAssets varies widely)
 * 2. Vault state changes frequently (stale simulations are misleading)
 * 3. One-time use simulations (rarely re-requested with same parameters)
 * 4. SDK-based calculations (fast execution, no benefit from caching)
 *
 * @module tools/simulate-vault
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { simulateVaultManagement } from '../sdk/simulation-service.js';
import { transformPeriodSummariesToAPRData } from '../sdk/apr-service.js';
import { formatBigInt, safeBigIntStringify } from '../sdk/math-utils.js';
import { calculatePricePerShare } from '../sdk/vault-utils.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import type { VaultData } from '../graphql/fragments/index.js';
import { GET_PERIOD_SUMMARIES_QUERY } from '../graphql/queries/index.js';
import { ServiceContainer } from '../core/container.js';

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
 * Create the executeSimulateVault function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 *
 * @example
 * ```typescript
 * const executor = createExecuteSimulateVault(container);
 * const result = await executor({
 *   vaultAddress: '0x1234...',
 *   chainId: 42161,
 *   newTotalAssets: '2000000000',
 *   settleDeposit: true,
 *   includeAPRCalculations: true
 * });
 * ```
 */
export function createExecuteSimulateVault(
  container: ServiceContainer
): (input: SimulateVaultInput) => Promise<CallToolResult> {
  return async (input: SimulateVaultInput): Promise<CallToolResult> => {
    try {
      const { vaultAddress, chainId, newTotalAssets, settleDeposit, includeAPRCalculations } =
        input;

      // 1. Fetch vault data
      const vaultQuery = `
      query GetVault($vaultAddress: Address!, $chainId: Int!) {
        vault: vaultByAddress(address: $vaultAddress, chainId: $chainId) {
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
          chain {
            id
          }
        }
      }
    `;

      const vaultData = await container.graphqlClient.request<{ vault: VaultData }>(vaultQuery, {
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
          const periodSummariesData = await container.graphqlClient.request<{
            transactions: {
              items: Array<{
                timestamp: string;
                data: {
                  totalAssetsAtStart: string;
                  totalSupplyAtStart: string;
                };
              }>;
              pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
            };
          }>(GET_PERIOD_SUMMARIES_QUERY, {
            where: {
              vault_in: [vaultAddress],
              chainId_eq: chainId,
              type_in: ['PeriodSummary'],
            },
            orderBy: 'timestamp',
            orderDirection: 'asc',
            first: 1000,
          });

          if (periodSummariesData?.transactions?.items?.length > 0) {
            // Extract PeriodSummary data from transaction items
            const periodSummaries = periodSummariesData.transactions.items.map((tx) => ({
              timestamp: tx.timestamp,
              totalAssetsAtStart: tx.data.totalAssetsAtStart,
              totalSupplyAtStart: tx.data.totalSupplyAtStart,
            }));

            aprData = transformPeriodSummariesToAPRData(periodSummaries, vault);
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

      // Calculate price per share impact using Lagoon SDK

      let priceImpactPercentage = 0;
      let priceImpactAbsolute = BigInt(0);
      let currentPricePerShare = BigInt(0);
      let newPricePerShare = BigInt(0);

      if (currentTotalSupply > 0n && simulationResult.totalSupply > 0n) {
        // Calculate prices using SDK (returns price in asset decimals)
        currentPricePerShare = calculatePricePerShare(
          currentTotalAssets,
          currentTotalSupply,
          vaultDecimals,
          assetDecimals
        );
        newPricePerShare = calculatePricePerShare(
          simulationResult.totalAssets,
          simulationResult.totalSupply,
          vaultDecimals,
          assetDecimals
        );

        priceImpactAbsolute = newPricePerShare - currentPricePerShare;
        priceImpactPercentage =
          currentPricePerShare > 0n
            ? Number((priceImpactAbsolute * 10000n) / currentPricePerShare) / 100
            : 0;
      } else if (simulationResult.totalSupply > 0n) {
        // New vault case - no current price to compare
        newPricePerShare = calculatePricePerShare(
          simulationResult.totalAssets,
          simulationResult.totalSupply,
          vaultDecimals,
          assetDecimals
        );
        currentPricePerShare = BigInt(10 ** assetDecimals); // 1.0 in asset decimals
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
          pricePerShare: (currentPricePerShare ?? BigInt(0)).toString(),
          pricePerShareFormatted: formatBigInt(currentPricePerShare ?? BigInt(0), assetDecimals),
          managementFee: vault.state.managementFee,
          performanceFee: vault.state.performanceFee,
          highWaterMark: vault.state.highWaterMark,
        },
        simulatedState: {
          totalAssets: simulationResult.totalAssets?.toString() ?? vault.state.totalAssets,
          totalAssetsFormatted: formatBigInt(
            simulationResult.totalAssets ?? BigInt(vault.state.totalAssets),
            assetDecimals
          ),
          totalSupply: simulationResult.totalSupply?.toString() ?? vault.state.totalSupply,
          totalSupplyFormatted: formatBigInt(
            simulationResult.totalSupply ?? BigInt(vault.state.totalSupply),
            vaultDecimals
          ),
          pricePerShare: (newPricePerShare ?? BigInt(0)).toString(),
          pricePerShareFormatted: formatBigInt(newPricePerShare ?? BigInt(0), assetDecimals),
          feesAccrued: {
            management: simulationResult.managementFees?.inAssets?.toString() ?? '0',
            managementFormatted: formatBigInt(
              simulationResult.managementFees?.inAssets ?? 0n,
              assetDecimals
            ),
            performance: simulationResult.performanceFees?.inAssets?.toString() ?? '0',
            performanceFormatted: formatBigInt(
              simulationResult.performanceFees?.inAssets ?? 0n,
              assetDecimals
            ),
            total: (
              (simulationResult.managementFees?.inAssets ?? 0n) +
              (simulationResult.performanceFees?.inAssets ?? 0n)
            ).toString(),
            totalFormatted: formatBigInt(
              (simulationResult.managementFees?.inAssets ?? 0n) +
                (simulationResult.performanceFees?.inAssets ?? 0n),
              assetDecimals
            ),
          },
          sharePriceImpact: {
            absolute: (priceImpactAbsolute ?? BigInt(0)).toString(),
            absoluteFormatted: formatBigInt(priceImpactAbsolute ?? BigInt(0), assetDecimals),
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
                  pricePerShare: aprData.thirtyDay.pricePerShare?.toString() ?? '0',
                  pricePerShareFormatted: formatBigInt(
                    aprData.thirtyDay.pricePerShare ?? 0n,
                    assetDecimals
                  ),
                },
              }),
              ...(aprData.inception && {
                inception: {
                  timestamp: aprData.inception.timestamp,
                  pricePerShare: aprData.inception.pricePerShare?.toString() ?? '0',
                  pricePerShareFormatted: formatBigInt(
                    aprData.inception.pricePerShare ?? 0n,
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
            text: safeBigIntStringify(response) + getToolDisclaimer('simulate_vault'),
          },
        ],
      };
    } catch (error) {
      return handleToolError(error, 'simulate_vault');
    }
  };
}
