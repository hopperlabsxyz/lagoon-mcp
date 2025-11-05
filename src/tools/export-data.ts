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
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { exportDataInputSchema, ExportDataInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments.js';
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

/**
 * GraphQL query for vault data export
 */
const EXPORT_VAULTS_QUERY = `
  query ExportVaults($addresses: [Address!]!, $chainId: Int!) {
    vaults(where: { address_in: $addresses, chainId: $chainId }) {
      ...VaultFragment
    }
  }
  ${VAULT_FRAGMENT}
`;

/**
 * GraphQL query for transaction export
 */
const EXPORT_TRANSACTIONS_QUERY = `
  query ExportTransactions($vault_in: [Address!]!, $chainId: Int!, $first: Int!) {
    transactions(
      where: { vault_in: $vault_in, chainId: $chainId },
      orderBy: "timestamp",
      orderDirection: "desc",
      first: $first
    ) {
      items {
        id
        type
        timestamp
        blockNumber
        vault {
          address
        }
        data {
          ... on SettleDeposit {
            user
            assets
            shares
          }
          ... on SettleRedeem {
            user
            assets
            shares
          }
          ... on DepositRequest {
            user
            assets
          }
          ... on RedeemRequest {
            user
            shares
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for price history export
 */
const EXPORT_PRICE_HISTORY_QUERY = `
  query ExportPriceHistory($vault_in: [Address!]!, $first: Int!) {
    transactions(
      where: { vault_in: $vault_in, type: "TotalAssetsUpdated" },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        timestamp
        data {
          ... on TotalAssetsUpdated {
            pricePerShareUsd
            totalAssetsUsd
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for performance metrics export
 */
const EXPORT_PERFORMANCE_QUERY = `
  query ExportPerformance($vault_in: [Address!]!, $first: Int!) {
    transactions(
      where: { vault_in: $vault_in, type: "TotalAssetsUpdated" },
      orderBy: "timestamp",
      orderDirection: "asc",
      first: $first
    ) {
      items {
        timestamp
        blockNumber
        data {
          ... on TotalAssetsUpdated {
            totalAssetsUsd
          }
        }
      }
    }
  }
`;

/**
 * Convert VaultData to CSV format
 */
function convertVaultToCSV(vault: VaultData, chainId: number): VaultCSVData {
  const weeklyApr = vault.state?.weeklyApr?.linearNetApr;
  const monthlyApr = vault.state?.monthlyApr?.linearNetApr;
  const apy =
    typeof weeklyApr === 'number' ? weeklyApr : typeof monthlyApr === 'number' ? monthlyApr : 0;

  return {
    address: vault.address,
    name: vault.name || 'Unknown',
    symbol: vault.symbol || 'N/A',
    chainId,
    tvl: vault.state?.totalAssetsUsd || 0,
    apy,
    pricePerShare: vault.state?.pricePerShareUsd || 0,
    totalAssets: vault.state?.totalAssets || '0',
    totalShares: vault.state?.totalSupply || '0',
    assetSymbol: vault.asset?.symbol || 'N/A',
    assetAddress: vault.asset?.address || '0x0',
  };
}

/**
 * Export data in requested format
 *
 * @param input - Export configuration (data type, format, addresses, filters)
 * @returns Exported data in CSV or JSON format
 */
export async function executeExportData(input: ExportDataInput): Promise<CallToolResult> {
  try {
    // Validate input
    const validatedInput = exportDataInputSchema.parse(input);

    // Route to appropriate export handler
    switch (validatedInput.dataType) {
      case 'vaults':
        return await exportVaults(validatedInput);

      case 'transactions':
        return await exportTransactions(validatedInput);

      case 'price_history':
        return await exportPriceHistory(validatedInput);

      case 'performance':
        return await exportPerformance(validatedInput);

      default:
        // Exhaustiveness check - all data types should be handled above
        return {
          content: [
            {
              type: 'text',
              text: `Unknown data type: ${String(validatedInput.dataType)}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error, 'export_data');
  }
}

/**
 * Export vault data
 */
async function exportVaults(input: ExportDataInput): Promise<CallToolResult> {
  const data = await graphqlClient.request<{ vaults: VaultData[] }>(EXPORT_VAULTS_QUERY, {
    addresses: input.vaultAddresses,
    chainId: input.chainId,
  });

  if (!data.vaults || data.vaults.length === 0) {
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

  const csvData = data.vaults.map((vault) => convertVaultToCSV(vault, input.chainId));

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
async function exportTransactions(input: ExportDataInput): Promise<CallToolResult> {
  const data = await graphqlClient.request<{
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
async function exportPriceHistory(input: ExportDataInput): Promise<CallToolResult> {
  const data = await graphqlClient.request<{
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
async function exportPerformance(input: ExportDataInput): Promise<CallToolResult> {
  const data = await graphqlClient.request<{
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
