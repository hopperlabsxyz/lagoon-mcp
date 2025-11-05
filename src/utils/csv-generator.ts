/**
 * CSV Generator Utility
 *
 * Provides CSV formatting and generation for vault data export.
 * Handles proper escaping, quoting, and formatting for CSV compliance.
 */

/**
 * Escape CSV field value
 * Handles quotes, commas, newlines according to RFC 4180
 */
export function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const strValue = String(value);

  // Check if field needs quoting (contains comma, quote, or newline)
  const needsQuoting = /[",\n\r]/.test(strValue);

  if (needsQuoting) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * Generate CSV header row from column names
 */
export function generateCSVHeader(columns: string[]): string {
  return columns.map(escapeCSVField).join(',');
}

/**
 * Generate CSV row from data object
 */
export function generateCSVRow(data: Record<string, unknown>, columns: string[]): string {
  return columns.map((col) => escapeCSVField(data[col])).join(',');
}

/**
 * Generate complete CSV from array of objects
 */
export function generateCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (data.length === 0) {
    return generateCSVHeader(columns);
  }

  const header = generateCSVHeader(columns);
  const rows = data.map((row) => generateCSVRow(row, columns));

  return [header, ...rows].join('\n');
}

/**
 * Format vault data for CSV export
 */
export interface VaultCSVData extends Record<string, unknown> {
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  tvl: number;
  apy: number;
  pricePerShare: number;
  totalAssets: string;
  totalShares: string;
  assetSymbol: string;
  assetAddress: string;
}

/**
 * Generate CSV for vault data
 */
export function generateVaultCSV(vaults: VaultCSVData[]): string {
  const columns = [
    'address',
    'name',
    'symbol',
    'chainId',
    'tvl',
    'apy',
    'pricePerShare',
    'totalAssets',
    'totalShares',
    'assetSymbol',
    'assetAddress',
  ];

  return generateCSV(vaults, columns);
}

/**
 * Format transaction data for CSV export
 */
export interface TransactionCSVData extends Record<string, unknown> {
  id: string;
  type: string;
  timestamp: string;
  blockNumber: string;
  vaultAddress: string;
  userAddress?: string;
  amount?: string;
  shares?: string;
  assets?: string;
}

/**
 * Generate CSV for transaction data
 */
export function generateTransactionCSV(transactions: TransactionCSVData[]): string {
  const columns = [
    'id',
    'type',
    'timestamp',
    'blockNumber',
    'vaultAddress',
    'userAddress',
    'amount',
    'shares',
    'assets',
  ];

  return generateCSV(transactions, columns);
}

/**
 * Format price history data for CSV export
 */
export interface PriceHistoryCSVData extends Record<string, unknown> {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Generate CSV for price history data
 */
export function generatePriceHistoryCSV(priceData: PriceHistoryCSVData[]): string {
  const columns = ['date', 'open', 'high', 'low', 'close', 'volume'];

  return generateCSV(priceData, columns);
}

/**
 * Format performance metrics for CSV export
 */
export interface PerformanceCSVData extends Record<string, unknown> {
  timestamp: string;
  totalAssetsUsd: number;
  blockNumber: string;
}

/**
 * Generate CSV for performance metrics
 */
export function generatePerformanceCSV(metrics: PerformanceCSVData[]): string {
  const columns = ['timestamp', 'totalAssetsUsd', 'blockNumber'];

  return generateCSV(metrics, columns);
}
