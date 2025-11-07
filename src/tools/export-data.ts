/**
 * export_data Tool
 *
 * Export vault data, transactions, price history, or performance metrics in CSV or JSON format.
 * Supports multiple data types and formats for integration with external tools and analysis.
 *
 * Use cases:
 * - Export vault data for spreadsheet analysis
 * - Generate transaction reports for accounting
 * - Export price history for charting tools
 * - Create performance datasets for custom analytics
 * - Performance: ~200-400 tokens per export depending on data size
 *
 * Cache strategy:
 * - No caching (exports are generated on-demand with latest data)
 *
 * WHY NO CACHING?
 * This tool is intentionally non-cached because:
 * 1. Export format/data type varies per request (CSV/JSON, vaults/transactions/etc)
 * 2. Exports need fresh data (no staleness tolerance)
 * 3. Large dataset exports would waste cache memory
 * 4. One-time use exports (unlikely to be re-requested with same parameters)
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ExportDataInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { VaultData } from '../graphql/fragments/index.js';
import {
  EXPORT_VAULTS_QUERY,
  EXPORT_TRANSACTIONS_QUERY,
  EXPORT_PRICE_HISTORY_QUERY,
  EXPORT_PERFORMANCE_QUERY,
} from '../graphql/queries/index.js';
import {
  generateVaultCSV,
  generateTransactionCSV,
  generatePriceHistoryCSV,
  generatePerformanceCSV,
  VaultCSVData,
  TransactionCSVData,
  PriceHistoryCSVData,
  PerformanceCSVData,
} from '../utils/csv-generator.js';
import { ServiceContainer } from '../core/container.js';

/**
 * Convert VaultData to CSV format
 */
function convertVaultToCSV(vault: VaultData, chainId: number): VaultCSVData {
  const weeklyApr = vault.state?.weeklyApr?.linearNetApr;
  const monthlyApr = vault.state?.monthlyApr?.linearNetApr;
  const apr =
    typeof weeklyApr === 'number' ? weeklyApr : typeof monthlyApr === 'number' ? monthlyApr : 0;

  return {
    address: vault.address,
    name: vault.name || 'Unknown',
    symbol: vault.symbol || 'N/A',
    chainId,
    tvl: vault.state?.totalAssetsUsd || 0,
    apr,
    pricePerShare: vault.state?.pricePerShareUsd || 0,
    totalAssets: vault.state?.totalAssets || '0',
    totalShares: vault.state?.totalSupply || '0',
    assetSymbol: vault.asset?.symbol || 'N/A',
    assetAddress: vault.asset?.address || '0x0',
  };
}

/**
 * Create the executeExportData function with DI container
 *
 * @param container - Service container with dependencies
 * @returns Configured tool executor function
 */
export function createExecuteExportData(
  container: ServiceContainer
): (input: ExportDataInput) => Promise<CallToolResult> {
  return async (input: ExportDataInput): Promise<CallToolResult> => {
    try {
      // Validate input
      // Input already validated by createToolHandler

      // Route to appropriate export handler
      switch (input.dataType) {
        case 'vaults':
          return await exportVaults(container, input);

        case 'transactions':
          return await exportTransactions(container, input);

        case 'price_history':
          return await exportPriceHistory(container, input);

        case 'performance':
          return await exportPerformance(container, input);

        default:
          // Exhaustiveness check - all data types should be handled above
          return {
            content: [
              {
                type: 'text',
                text: `Unknown data type: ${String(input.dataType)}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return handleToolError(error, 'export_data');
    }
  };
}

/**
 * Export vault data
 */
async function exportVaults(
  container: ServiceContainer,
  input: ExportDataInput
): Promise<CallToolResult> {
  const data = await container.graphqlClient.request<{ vaults: { items: VaultData[] } }>(
    EXPORT_VAULTS_QUERY,
    {
      addresses: input.vaultAddresses,
      chainId: input.chainId,
    }
  );

  if (!data.vaults || !data.vaults.items || data.vaults.items.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No vaults found for the provided addresses on chain ${input.chainId}`,
        },
      ],
      isError: false,
    };
  }

  const csvData = data.vaults.items.map((vault) => convertVaultToCSV(vault, input.chainId));

  if (input.format === 'csv') {
    const csv = generateVaultCSV(csvData);
    return {
      content: [
        {
          type: 'text',
          text: `# Vault Data Export (CSV)\n\n\`\`\`csv\n${csv}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: CSV\n**Data Type**: Vaults`,
        },
      ],
      isError: false,
    };
  } else {
    // JSON format
    return {
      content: [
        {
          type: 'text',
          text: `# Vault Data Export (JSON)\n\n\`\`\`json\n${JSON.stringify(csvData, null, 2)}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: JSON\n**Data Type**: Vaults`,
        },
      ],
      isError: false,
    };
  }
}

/**
 * Export transaction data
 */
async function exportTransactions(
  container: ServiceContainer,
  input: ExportDataInput
): Promise<CallToolResult> {
  const data = await container.graphqlClient.request<{
    transactions: {
      items: Array<{
        id: string;
        type: string;
        timestamp: string;
        blockNumber: string;
        vault: { address: string };
        data: unknown;
      }>;
    };
  }>(EXPORT_TRANSACTIONS_QUERY, {
    vault_in: input.vaultAddresses,
    chainId: input.chainId,
    first: 1000,
  });

  if (!data.transactions || data.transactions.items.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No transactions found for the provided vault addresses on chain ${input.chainId}`,
        },
      ],
      isError: false,
    };
  }

  const csvData: TransactionCSVData[] = data.transactions.items.map((tx) => {
    const txData = tx.data as {
      user?: string;
      assets?: string;
      shares?: string;
    };

    return {
      id: tx.id,
      type: tx.type,
      timestamp: new Date(parseInt(tx.timestamp, 10) * 1000).toISOString(),
      blockNumber: tx.blockNumber,
      vaultAddress: tx.vault.address,
      userAddress: txData.user,
      amount: txData.assets,
      shares: txData.shares,
      assets: txData.assets,
    };
  });

  if (input.format === 'csv') {
    const csv = generateTransactionCSV(csvData);
    return {
      content: [
        {
          type: 'text',
          text: `# Transaction Data Export (CSV)\n\n\`\`\`csv\n${csv}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: CSV\n**Data Type**: Transactions`,
        },
      ],
      isError: false,
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `# Transaction Data Export (JSON)\n\n\`\`\`json\n${JSON.stringify(csvData, null, 2)}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: JSON\n**Data Type**: Transactions`,
        },
      ],
      isError: false,
    };
  }
}

/**
 * Export price history data
 */
async function exportPriceHistory(
  container: ServiceContainer,
  input: ExportDataInput
): Promise<CallToolResult> {
  const data = await container.graphqlClient.request<{
    transactions: {
      items: Array<{
        timestamp: string;
        data: { pricePerShareUsd: number; totalAssetsUsd: number };
      }>;
    };
  }>(EXPORT_PRICE_HISTORY_QUERY, {
    vault_in: input.vaultAddresses,
    first: 1000,
  });

  if (!data.transactions || data.transactions.items.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No price history found for the provided vault addresses`,
        },
      ],
      isError: false,
    };
  }

  // Aggregate by day for OHLCV
  const dayBuckets = new Map<string, number[]>();

  for (const tx of data.transactions.items) {
    const date = new Date(parseInt(tx.timestamp, 10) * 1000).toISOString().split('T')[0];
    if (!dayBuckets.has(date)) {
      dayBuckets.set(date, []);
    }
    dayBuckets.get(date)!.push(tx.data.pricePerShareUsd);
  }

  const csvData: PriceHistoryCSVData[] = Array.from(dayBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, prices]) => ({
      date,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: prices.length,
    }));

  if (input.format === 'csv') {
    const csv = generatePriceHistoryCSV(csvData);
    return {
      content: [
        {
          type: 'text',
          text: `# Price History Export (CSV)\n\n\`\`\`csv\n${csv}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: CSV\n**Data Type**: Price History (OHLCV)`,
        },
      ],
      isError: false,
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `# Price History Export (JSON)\n\n\`\`\`json\n${JSON.stringify(csvData, null, 2)}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: JSON\n**Data Type**: Price History (OHLCV)`,
        },
      ],
      isError: false,
    };
  }
}

/**
 * Export performance metrics
 */
async function exportPerformance(
  container: ServiceContainer,
  input: ExportDataInput
): Promise<CallToolResult> {
  const data = await container.graphqlClient.request<{
    transactions: {
      items: Array<{
        timestamp: string;
        blockNumber: string;
        data: { totalAssetsUsd: number };
      }>;
    };
  }>(EXPORT_PERFORMANCE_QUERY, {
    vault_in: input.vaultAddresses,
    first: 1000,
  });

  if (!data.transactions || data.transactions.items.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No performance data found for the provided vault addresses`,
        },
      ],
      isError: false,
    };
  }

  const csvData: PerformanceCSVData[] = data.transactions.items.map((tx) => ({
    timestamp: new Date(parseInt(tx.timestamp, 10) * 1000).toISOString(),
    totalAssetsUsd: tx.data.totalAssetsUsd,
    blockNumber: tx.blockNumber,
  }));

  if (input.format === 'csv') {
    const csv = generatePerformanceCSV(csvData);
    return {
      content: [
        {
          type: 'text',
          text: `# Performance Metrics Export (CSV)\n\n\`\`\`csv\n${csv}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: CSV\n**Data Type**: Performance Metrics`,
        },
      ],
      isError: false,
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `# Performance Metrics Export (JSON)\n\n\`\`\`json\n${JSON.stringify(csvData, null, 2)}\n\`\`\`\n\n**Records**: ${csvData.length}\n**Format**: JSON\n**Data Type**: Performance Metrics`,
        },
      ],
      isError: false,
    };
  }
}
