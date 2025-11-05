/**
 * export_data Tool Tests
 *
 * Tests for the export_data tool handler covering:
 * - All 4 data types (vaults, transactions, price_history, performance)
 * - Both formats (CSV, JSON)
 * - CSV escaping edge cases (quotes, commas, newlines)
 * - Empty data handling for all types
 * - GraphQL error handling
 * - Invalid input validation (addresses, chain IDs, data types, formats)
 * - OHLCV aggregation for price history
 * - APY fallback logic (weekly → monthly → 0)
 *
 * Phase 4.2 implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeExportData } from '../../src/tools/export-data';
import * as graphqlClientModule from '../../src/graphql/client';

// Mock the GraphQL client
vi.mock('../../src/graphql/client', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
}));

/**
 * Helper to create complete mock vault for export
 */
function createMockVault(
  overrides: Partial<{
    address: string;
    name: string;
    symbol: string;
    tvl: number;
    weeklyApr: number;
    monthlyApr: number;
  }> = {}
): unknown {
  const defaults = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    tvl: 1000000,
    weeklyApr: 0.1,
    monthlyApr: 0.12,
  };

  const merged = { ...defaults, ...overrides };

  return {
    address: merged.address,
    symbol: merged.symbol,
    name: merged.name,
    decimals: 18,
    asset: {
      address: '0xasset1234567890123456789012345678901234',
      symbol: 'USDC',
    },
    state: {
      totalAssets: '1000000000000',
      totalSupply: '900000000000',
      totalAssetsUsd: merged.tvl,
      pricePerShareUsd: 1.05,
      weeklyApr:
        merged.weeklyApr !== undefined
          ? {
              linearNetApr: merged.weeklyApr,
            }
          : undefined,
      monthlyApr:
        merged.monthlyApr !== undefined
          ? {
              linearNetApr: merged.monthlyApr,
            }
          : undefined,
    },
  };
}

/**
 * Helper to create mock transaction
 */
function createMockTransaction(
  overrides: Partial<{
    id: string;
    type: string;
    timestamp: string;
    blockNumber: string;
    userAddress: string;
    amount: string;
    vaultAddress: string;
  }> = {}
): unknown {
  const defaults = {
    id: 'tx-123',
    type: 'SettleDeposit',
    timestamp: '1704067200', // 2024-01-01
    blockNumber: '12345',
    userAddress: '0xuser1234567890123456789012345678901234',
    amount: '1000000000',
    vaultAddress: '0x1234567890123456789012345678901234567890',
  };

  const merged = { ...defaults, ...overrides };

  return {
    id: merged.id,
    type: merged.type,
    timestamp: merged.timestamp,
    blockNumber: merged.blockNumber,
    vault: {
      address: merged.vaultAddress,
    },
    data: {
      user: merged.userAddress,
      assets: merged.amount,
      shares: '950000000',
    },
  };
}

/**
 * Helper to create mock price transaction (TotalAssetsUpdated)
 */
function createMockPriceTransaction(
  overrides: Partial<{
    timestamp: string;
    pricePerShareUsd: number;
    totalAssetsUsd: number;
  }> = {}
): unknown {
  const defaults = {
    timestamp: '1704067200', // 2024-01-01
    pricePerShareUsd: 1.05,
    totalAssetsUsd: 1000000,
  };

  const merged = { ...defaults, ...overrides };

  return {
    id: `price-${merged.timestamp}`,
    timestamp: merged.timestamp,
    blockNumber: '12345',
    data: {
      __typename: 'TotalAssetsUpdated',
      pricePerShare: '1050000000000000000',
      pricePerShareUsd: merged.pricePerShareUsd,
      totalAssets: '1000000000000',
      totalAssetsUsd: merged.totalAssetsUsd,
    },
  };
}

describe('export_data Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // Vault Export Tests
  // ==========================================

  describe('Vault Data Export', () => {
    it('should export vaults in CSV format', async () => {
      const mockVault = createMockVault();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [mockVault],
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```csv');
      expect(text).toContain('address,name,symbol');
      expect(text).toContain('0x1234567890123456789012345678901234567890');
      expect(text).toContain('Test Vault');
      expect(text).toContain('TEST');
    });

    it('should export vaults in JSON format', async () => {
      const mockVault = createMockVault();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [mockVault],
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'json',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```json');
      expect(text).toContain('"address": "0x1234567890123456789012345678901234567890"');
      expect(text).toContain('"name": "Test Vault"');
    });

    it('should handle APY fallback (weekly → monthly → 0)', async () => {
      const vault1 = createMockVault({ weeklyApr: 0.15, monthlyApr: 0.12 });
      const vault2 = createMockVault({ weeklyApr: undefined, monthlyApr: 0.08 });
      const vault3 = createMockVault({ weeklyApr: undefined, monthlyApr: undefined });

      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [vault1, vault2, vault3],
      });

      const result = await executeExportData({
        vaultAddresses: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          '0x3333333333333333333333333333333333333333',
        ],
        chainId: 1,
        dataType: 'vaults',
        format: 'json',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      const data = JSON.parse(text.split('```json\n')[1].split('\n```')[0]);

      expect(data[0].apy).toBe(0.15); // Weekly APR used
      expect(data[1].apy).toBe(0.08); // Monthly APR used (no weekly)
      expect(data[2].apy).toBe(0); // Default 0 (no APR data)
    });

    it('should handle empty vault results', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [],
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('No vaults found');
    });
  });

  // ==========================================
  // Transaction Export Tests
  // ==========================================

  describe('Transaction Data Export', () => {
    it('should export transactions in CSV format', async () => {
      const mockTx = createMockTransaction();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [mockTx],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'transactions',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```csv');
      expect(text).toContain('id,type,timestamp');
      expect(text).toContain('tx-123');
      expect(text).toContain('SettleDeposit');
    });

    it('should export transactions in JSON format', async () => {
      const mockTx = createMockTransaction();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [mockTx],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'transactions',
        format: 'json',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```json');
      expect(text).toContain('"id": "tx-123"');
      expect(text).toContain('"type": "SettleDeposit"');
    });

    it('should handle empty transaction results', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'transactions',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('No transactions found');
    });
  });

  // ==========================================
  // Price History Export Tests
  // ==========================================

  describe('Price History Export', () => {
    it('should export price history in CSV format with OHLCV aggregation', async () => {
      const mockPriceTx1 = createMockPriceTransaction({
        timestamp: '1704067200', // 2024-01-01 00:00
        pricePerShareUsd: 1.0,
        totalAssetsUsd: 1000000,
      });
      const mockPriceTx2 = createMockPriceTransaction({
        timestamp: '1704070800', // 2024-01-01 01:00
        pricePerShareUsd: 1.05,
        totalAssetsUsd: 1050000,
      });
      const mockPriceTx3 = createMockPriceTransaction({
        timestamp: '1704074400', // 2024-01-01 02:00
        pricePerShareUsd: 0.98,
        totalAssetsUsd: 980000,
      });

      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [mockPriceTx1, mockPriceTx2, mockPriceTx3],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'price_history',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```csv');
      expect(text).toContain('date,open,high,low,close,volume');
      expect(text).toContain('2024-01-01');
    });

    it('should export price history in JSON format', async () => {
      const mockPriceTx = createMockPriceTransaction();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [mockPriceTx],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'price_history',
        format: 'json',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```json');
      expect(text).toContain('"date": "2024-01-01"');
      expect(text).toContain('"open":');
      expect(text).toContain('"high":');
      expect(text).toContain('"low":');
      expect(text).toContain('"close":');
      expect(text).toContain('"volume":');
    });

    it('should handle empty price history results', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'price_history',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('No price history found');
    });
  });

  // ==========================================
  // Performance Export Tests
  // ==========================================

  describe('Performance Data Export', () => {
    it('should export performance metrics in CSV format', async () => {
      const mockPriceTx = createMockPriceTransaction();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [mockPriceTx],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'performance',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```csv');
      expect(text).toContain('timestamp,totalAssetsUsd,blockNumber');
      expect(text).toContain('2024-01-01');
      expect(text).toContain('1000000');
    });

    it('should export performance metrics in JSON format', async () => {
      const mockPriceTx = createMockPriceTransaction();
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [mockPriceTx],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'performance',
        format: 'json',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('```json');
      expect(text).toContain('"timestamp": "2024-01-01');
      expect(text).toContain('"totalAssetsUsd": 1000000');
    });

    it('should handle empty performance results', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        transactions: {
          items: [],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'performance',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('No performance data found');
    });
  });

  // ==========================================
  // CSV Escaping Tests
  // ==========================================

  describe('CSV Escaping', () => {
    it('should escape CSV fields with quotes', async () => {
      const mockVault = createMockVault({ name: 'Vault "Special" Name' });
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [mockVault],
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('"Vault ""Special"" Name"');
    });

    it('should escape CSV fields with commas', async () => {
      const mockVault = createMockVault({ name: 'Vault, with commas' });
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [mockVault],
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('"Vault, with commas"');
    });

    it('should escape CSV fields with newlines', async () => {
      const mockVault = createMockVault({ name: 'Vault\nwith\nnewlines' });
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockResolvedValue({
        vaults: [mockVault],
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('"Vault\nwith\nnewlines"');
    });
  });

  // ==========================================
  // Input Validation Tests
  // ==========================================

  // NOTE: Input validation tests removed - validation is now handled by createToolHandler wrapper
  // in src/utils/tool-handler.ts. Tools themselves trust that inputs are pre-validated.

  // ==========================================
  // Error Handling Tests
  // ==========================================

  describe('Error Handling', () => {
    it('should handle GraphQL network errors', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue(
        new Error('Network error')
      );

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('Error:');
      expect(text).toContain('Network error');
    });

    it('should handle GraphQL response errors', async () => {
      vi.spyOn(graphqlClientModule.graphqlClient, 'request').mockRejectedValue({
        response: {
          errors: [{ message: 'GraphQL error' }],
        },
      });

      const result = await executeExportData({
        vaultAddresses: ['0x1234567890123456789012345678901234567890'],
        chainId: 1,
        dataType: 'vaults',
        format: 'csv',
      });

      expect(result.isError).toBe(true);
    });
  });
});
