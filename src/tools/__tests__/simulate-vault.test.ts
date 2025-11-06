/**
 * Tests for simulate-vault tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createExecuteSimulateVault,
  simulateVaultInputSchema,
  type SimulateVaultInput,
} from '../simulate-vault.js';
import type { VaultData } from '../../types/generated.js';
import type { SimulationResult } from '@lagoon-protocol/v0-computation';
import { createMockContainer } from '../../../tests/helpers/test-container.js';

// Mock dependencies
vi.mock('../../graphql/client.js', () => ({
  graphqlClient: {
    request: vi.fn<[unknown, unknown?], Promise<unknown>>(),
  },
}));

vi.mock('../../sdk/simulation-service.js', () => ({
  simulateVaultManagement: vi.fn(),
}));

vi.mock('../../sdk/apr-service.js', () => ({
  transformPeriodSummariesToAPRData: vi.fn(),
}));

import { graphqlClient } from '../../graphql/client.js';
import { simulateVaultManagement } from '../../sdk/simulation-service.js';
import { transformPeriodSummariesToAPRData } from '../../sdk/apr-service.js';
describe('simulateVaultInputSchema', () => {
  it('should validate correct input', () => {
    const input = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: true,
    };

    const result = simulateVaultInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should apply default values for optional fields', () => {
    const input = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
    };

    const result = simulateVaultInputSchema.parse(input);
    expect(result.settleDeposit).toBe(true);
    expect(result.includeAPRCalculations).toBe(true);
  });

  it('should reject invalid vault address', () => {
    const input = {
      vaultAddress: 'invalid-address',
      chainId: 42161,
      newTotalAssets: '2000000000',
    };

    const result = simulateVaultInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative chainId', () => {
    const input = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: -1,
      newTotalAssets: '2000000000',
    };

    const result = simulateVaultInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid newTotalAssets format', () => {
    const input = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: 'invalid',
    };

    const result = simulateVaultInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative newTotalAssets', () => {
    const input = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '-1000000000',
    };

    const result = simulateVaultInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('executeSimulateVault', () => {
  const mockVault: VaultData = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    decimals: 18,
    asset: {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    } as const,
    state: {
      totalSupply: '1000000000000000000',
      totalAssets: '1000000000',
      highWaterMark: '1000000000',
      lastFeeTime: '1700000000',
      managementFee: '200',
      performanceFee: '1000',
      version: 'v1',
      safeAssetBalance: '500000000',
      pendingSiloBalances: {
        assets: '100000000',
        shares: '100000000000000000',
      } as const,
      pendingSettlement: {
        assets: '50000000',
        shares: '50000000000000000',
      } as const,
    } as const,
    chainId: 42161,
    tvl: 1000,
  } as VaultData;

  const mockSimulationResult: SimulationResult = {
    totalSupply: BigInt('2000000000000000000'),
    totalAssets: BigInt('2000000000'),
    feesAccrued: BigInt('10000000'),
    pricePerShare: BigInt('1000000'),
  };

  // Executor function created from factory with mock container
  let executeSimulateVault: ReturnType<typeof createExecuteSimulateVault>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock container and initialize executor
    const mockContainer = createMockContainer();
    executeSimulateVault = createExecuteSimulateVault(mockContainer);
  });

  it('should successfully simulate deposit scenario', async () => {
    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(mockSimulationResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect((content.simulation as Record<string, unknown>).vaultAddress).toBe(input.vaultAddress);
    expect((content.currentState as Record<string, unknown>).totalAssets).toBe(
      mockVault.state.totalAssets
    );
    expect((content.simulatedState as Record<string, unknown>).totalAssets).toBe('2000000000');
  });

  it('should include APR analysis when requested', async () => {
    const mockPeriodSummaries = [
      {
        timestamp: '1700000000',
        totalAssetsAtStart: '1000000000',
        totalSupplyAtStart: '1000000000000000000',
      } as const,
    ];

    const mockAPRData = {
      thirtyDay: {
        timestamp: 1700000000,
        pricePerShare: BigInt('1050000'),
      } as const,
      inception: {
        timestamp: 1690000000,
        pricePerShare: BigInt('1000000'),
      } as const,
    };

    vi.mocked(graphqlClient)
      .request.mockResolvedValueOnce({ vault: mockVault })
      .mockResolvedValueOnce({
        transactions: {
          items: mockPeriodSummaries.map((ps) => ({
            timestamp: ps.timestamp,
            data: {
              totalAssetsAtStart: ps.totalAssetsAtStart,
              totalSupplyAtStart: ps.totalSupplyAtStart,
            },
          })),
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      });
    vi.mocked(simulateVaultManagement).mockReturnValue(mockSimulationResult);
    vi.mocked(transformPeriodSummariesToAPRData).mockReturnValue(mockAPRData);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: true,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect(content.aprAnalysis).toBeDefined();
    expect((content.aprAnalysis as Record<string, unknown>).method).toContain('Lagoon SDK');
    expect((content.aprAnalysis as Record<string, unknown>).thirtyDay).toBeDefined();
    expect((content.aprAnalysis as Record<string, unknown>).inception).toBeDefined();
  });

  it('should handle withdrawal scenario', async () => {
    const withdrawalResult: SimulationResult = {
      totalSupply: BigInt('500000000000000000'),
      totalAssets: BigInt('500000000'),
      feesAccrued: BigInt('5000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(withdrawalResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '500000000',
      settleDeposit: false,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect((content.simulatedState as Record<string, unknown>).totalAssets).toBe('500000000');
    expect((content.settlementAnalysis as Record<string, unknown>).settleDeposit).toBe(false);
  });

  it('should handle vault not found error', async () => {
    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: null });

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);

    // Error responses are plain text, not JSON
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Vault not found');
  });

  it('should handle simulation failure gracefully', async () => {
    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockImplementation(() => {
      throw new Error('SDK internal error');
    });

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);

    // Error responses are plain text, not JSON
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('SDK internal error');
  });

  it('should continue without APR data on fetch failure', async () => {
    vi.mocked(graphqlClient)
      .request.mockResolvedValueOnce({ vault: mockVault })
      .mockRejectedValueOnce(new Error('Period summaries not available'));
    vi.mocked(simulateVaultManagement).mockReturnValue(mockSimulationResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: true,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect(content.simulatedState).toBeDefined();
    expect(content.aprAnalysis).toBeUndefined();
  });

  it('should calculate share price impact correctly', async () => {
    // For this test, we need simulation returns different price
    // To get price per share = 1.00, we need totalAssets = totalSupply (adjusting for decimals)
    // Current: 1000000000 assets (1000 USDC, 6 decimals) / 1e18 shares = price = 0.001 per share
    // This creates a 1:1 ratio in "real" value terms
    //
    // For appreciation test:
    // New: 2100000000 assets (2100 USDC) / 2e18 shares
    // New price per share = (2100000000 * 10^6) / 2000000000000000000 = 1050 (comparing in normalized units)
    // Old price per share = (1000000000 * 10^6) / 1000000000000000000 = 1000
    // Impact = (1050 - 1000) / 1000 * 100 = 5% increase
    const appreciatedResult: SimulationResult = {
      totalSupply: BigInt('1000000000000000000'), // Keep same supply
      totalAssets: BigInt('1050000000'), // Increase assets by 5%
      feesAccrued: BigInt('10000000'),
      pricePerShare: BigInt('1050000'), // 1.05 in 6 decimals (not used, but for reference)
    };

    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(appreciatedResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2100000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    // Current price per share: (1000000000 * 10^6) / 1000000000000000000 = 1000 (normalized units)
    // New price per share: (1050000000 * 10^6) / 1000000000000000000 = 1050 (normalized units)
    // Impact: (1050 - 1000) / 1000 * 100 = 5% increase
    expect(
      (content.simulatedState as Record<string, unknown>).sharePriceImpact as Record<
        string,
        unknown
      >
    ).toBeDefined();
    expect(
      (
        (content.simulatedState as Record<string, unknown>).sharePriceImpact as Record<
          string,
          unknown
        >
      ).percentage as number
    ).toBeGreaterThan(0);
    expect(
      (
        (content.simulatedState as Record<string, unknown>).sharePriceImpact as Record<
          string,
          unknown
        >
      ).direction
    ).toBe('increase');
  });

  it('should handle zero supply vault (new vault)', async () => {
    const newVault: VaultData = {
      ...mockVault,
      state: {
        ...mockVault.state,
        totalSupply: '0',
        totalAssets: '0',
      } as const,
    } as VaultData;

    const newVaultResult: SimulationResult = {
      totalSupply: BigInt('1000000000000000000'),
      totalAssets: BigInt('1000000000'),
      feesAccrued: BigInt('0'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: newVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(newVaultResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '1000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect((content.currentState as Record<string, unknown>).totalSupply).toBe('0');
    expect((content.simulatedState as Record<string, unknown>).totalSupply).toBe(
      '1000000000000000000'
    );
  });

  it('should include settlement analysis with all fields', async () => {
    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(mockSimulationResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect(content.settlementAnalysis).toBeDefined();
    expect((content.settlementAnalysis as Record<string, unknown>).assetsInSafe).toBe('500000000');
    expect(
      (
        (content.settlementAnalysis as Record<string, unknown>).pendingSiloBalances as Record<
          string,
          unknown
        >
      ).assets
    ).toBe('100000000');
    expect(
      (
        (content.settlementAnalysis as Record<string, unknown>).pendingSettlement as Record<
          string,
          unknown
        >
      ).assets
    ).toBe('50000000');
  });

  it('should format all BigInt values correctly', async () => {
    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(mockSimulationResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    // All BigInt values should be strings
    expect(typeof (content.currentState as Record<string, unknown>).totalAssets).toBe('string');
    expect(typeof (content.simulatedState as Record<string, unknown>).totalAssets).toBe('string');
    expect(
      typeof (
        (content.simulatedState as Record<string, unknown>).feesAccrued as Record<string, unknown>
      ).total
    ).toBe('string');

    // Formatted versions should be decimal strings
    expect(
      (content.currentState as Record<string, unknown>).totalAssetsFormatted as string
    ).toContain('.');
    expect(
      (content.simulatedState as Record<string, unknown>).totalAssetsFormatted as string
    ).toContain('.');
  });

  it('should include metadata in response', async () => {
    vi.mocked(graphqlClient).request.mockResolvedValueOnce({ vault: mockVault });
    vi.mocked(simulateVaultManagement).mockReturnValue(mockSimulationResult);

    const input: SimulateVaultInput = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
      newTotalAssets: '2000000000',
      settleDeposit: true,
      includeAPRCalculations: false,
    };

    const result = await executeSimulateVault(input);
    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect(content.simulation).toBeDefined();
    expect((content.simulation as Record<string, unknown>).vaultAddress).toBe(input.vaultAddress);
    expect((content.simulation as Record<string, unknown>).chainId).toBe(input.chainId);
    expect((content.simulation as Record<string, unknown>).timestamp as number).toBeGreaterThan(0);
    expect((content.simulation as Record<string, unknown>).sdkVersion as string).toContain(
      '@lagoon-protocol'
    );
  });
});
