/**
 * Tests for simulation-service.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapVaultToSimulationFormat,
  constructSimulationInput,
  simulateVaultManagement,
} from '../simulation-service.js';
import type { VaultData } from '../../types/generated.js';
import type { APRHistoricalData } from '../apr-service.js';
import type { SimulationResult } from '@lagoon-protocol/v0-computation';

// Mock the SDK simulate function
vi.mock('@lagoon-protocol/v0-computation', () => ({
  simulate: vi.fn(),
}));

import { simulate } from '@lagoon-protocol/v0-computation';

describe('mapVaultToSimulationFormat', () => {
  const baseVault: VaultData = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    decimals: 18,
    asset: {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
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
      },
      pendingSettlement: {
        assets: '50000000',
        shares: '50000000000000000',
      },
    },
    chainId: 42161,
    tvl: 1000,
  } as VaultData;

  it('should map vault data correctly to SDK format', () => {
    const newTotalAssets = BigInt('2000000000');
    const result = mapVaultToSimulationFormat(baseVault, newTotalAssets);

    expect(result).toEqual({
      decimals: 18,
      underlyingDecimals: 6,
      newTotalAssets: BigInt('2000000000'),
      totalSupply: BigInt('1000000000000000000'),
      totalAssets: BigInt('1000000000'),
      highWaterMark: BigInt('1000000000'),
      lastFeeTime: BigInt('1700000000'),
      feeRates: {
        managementRate: 200,
        performanceRate: 1000,
      },
      version: 'v1',
    });
  });

  it('should handle missing optional fields with defaults', () => {
    const minimalVault: VaultData = {
      ...baseVault,
      decimals: undefined,
      state: {
        ...baseVault.state,
        version: undefined,
      },
    } as VaultData;

    const newTotalAssets = BigInt('1000000000');
    const result = mapVaultToSimulationFormat(minimalVault, newTotalAssets);

    expect(result.decimals).toBe(18); // Default
    expect(result.version).toBe('latest'); // Default
  });

  it('should correctly calculate decimals offset', () => {
    const vault18_6: VaultData = {
      ...baseVault,
      decimals: 18,
      asset: { ...baseVault.asset, decimals: 6 },
    } as VaultData;

    const result = mapVaultToSimulationFormat(vault18_6, BigInt('1000000000'));
    expect(result.decimals).toBe(18);
    expect(result.underlyingDecimals).toBe(6);
    // Decimals offset = 18 - 6 = 12 (calculated by SDK)
  });

  it('should handle equal decimals (offset = 0)', () => {
    const vault18_18: VaultData = {
      ...baseVault,
      decimals: 18,
      asset: { ...baseVault.asset, decimals: 18 },
    } as VaultData;

    const result = mapVaultToSimulationFormat(vault18_18, BigInt('1000000000'));
    expect(result.decimals).toBe(18);
    expect(result.underlyingDecimals).toBe(18);
    // Decimals offset = 0
  });
});

describe('constructSimulationInput', () => {
  const baseVault: VaultData = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    decimals: 18,
    asset: {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
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
      },
      pendingSettlement: {
        assets: '50000000',
        shares: '50000000000000000',
      },
    },
    chainId: 42161,
    tvl: 1000,
  } as VaultData;

  it('should construct complete simulation input', () => {
    const newTotalAssets = BigInt('2000000000');
    const aprData: APRHistoricalData = {
      thirtyDay: {
        timestamp: 1700000000,
        pricePerShare: BigInt('1050000'),
      },
      inception: {
        timestamp: 1690000000,
        pricePerShare: BigInt('1000000'),
      },
    };

    const result = constructSimulationInput(baseVault, newTotalAssets, aprData, true);

    expect(result).toEqual({
      totalAssetsForSimulation: BigInt('2000000000'),
      assetsInSafe: BigInt('500000000'),
      pendingSiloBalances: {
        assets: BigInt('100000000'),
        shares: BigInt('100000000000000000'),
      },
      pendingSettlement: {
        assets: BigInt('50000000'),
        shares: BigInt('50000000000000000'),
      },
      settleDeposit: true,
      inception: aprData.inception,
      thirtyDay: aprData.thirtyDay,
    });
  });

  it('should handle missing APR data', () => {
    const newTotalAssets = BigInt('2000000000');
    const result = constructSimulationInput(baseVault, newTotalAssets);

    expect(result.inception).toBeUndefined();
    expect(result.thirtyDay).toBeUndefined();
    expect(result.settleDeposit).toBe(true); // Default
  });

  it('should handle settleDeposit=false', () => {
    const newTotalAssets = BigInt('2000000000');
    const result = constructSimulationInput(baseVault, newTotalAssets, undefined, false);

    expect(result.settleDeposit).toBe(false);
  });

  it('should use safe defaults for missing optional fields', () => {
    const minimalVault: VaultData = {
      ...baseVault,
      state: {
        ...baseVault.state,
        safeAssetBalance: undefined,
        pendingSiloBalances: undefined,
        pendingSettlement: undefined,
      },
    } as VaultData;

    const newTotalAssets = BigInt('1000000000');
    const result = constructSimulationInput(minimalVault, newTotalAssets);

    expect(result.assetsInSafe).toBe(BigInt('0'));
    expect(result.pendingSiloBalances.assets).toBe(BigInt('0'));
    expect(result.pendingSiloBalances.shares).toBe(BigInt('0'));
    expect(result.pendingSettlement.assets).toBe(BigInt('0'));
    expect(result.pendingSettlement.shares).toBe(BigInt('0'));
  });

  it('should handle partial pending balances', () => {
    const partialVault: VaultData = {
      ...baseVault,
      state: {
        ...baseVault.state,
        pendingSiloBalances: {
          assets: '100000000',
          shares: undefined as unknown as string,
        },
        pendingSettlement: {
          assets: undefined as unknown as string,
          shares: '50000000000000000',
        },
      },
    } as VaultData;

    const newTotalAssets = BigInt('1000000000');
    const result = constructSimulationInput(partialVault, newTotalAssets);

    expect(result.pendingSiloBalances.assets).toBe(BigInt('100000000'));
    expect(result.pendingSiloBalances.shares).toBe(BigInt('0'));
    expect(result.pendingSettlement.assets).toBe(BigInt('0'));
    expect(result.pendingSettlement.shares).toBe(BigInt('50000000000000000'));
  });
});

describe('simulateVaultManagement', () => {
  const baseVault: VaultData = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    decimals: 18,
    asset: {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
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
      },
      pendingSettlement: {
        assets: '50000000',
        shares: '50000000000000000',
      },
    },
    chainId: 42161,
    tvl: 1000,
  } as VaultData;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully simulate deposit scenario', () => {
    const mockResult: SimulationResult = {
      totalSupply: BigInt('2000000000000000000'),
      totalAssets: BigInt('2000000000'),
      feesAccrued: BigInt('10000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('2000000000');
    const result = simulateVaultManagement(baseVault, newTotalAssets);

    expect(result).toEqual(mockResult);
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it('should successfully simulate withdrawal scenario', () => {
    const mockResult: SimulationResult = {
      totalSupply: BigInt('500000000000000000'),
      totalAssets: BigInt('500000000'),
      feesAccrued: BigInt('5000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('500000000'); // Withdrawal
    const result = simulateVaultManagement(baseVault, newTotalAssets);

    expect(result).toEqual(mockResult);
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it('should integrate APR data when provided', () => {
    const mockResult: SimulationResult = {
      totalSupply: BigInt('2000000000000000000'),
      totalAssets: BigInt('2000000000'),
      feesAccrued: BigInt('10000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const aprData: APRHistoricalData = {
      thirtyDay: {
        timestamp: 1700000000,
        pricePerShare: BigInt('1050000'),
      },
      inception: {
        timestamp: 1690000000,
        pricePerShare: BigInt('1000000'),
      },
    };

    const newTotalAssets = BigInt('2000000000');
    simulateVaultManagement(baseVault, newTotalAssets, aprData);

    expect(simulate).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(simulate).mock.calls[0];
    expect(callArgs[1].inception).toBeDefined();
    expect(callArgs[1].thirtyDay).toBeDefined();
  });

  it('should throw error for missing vault data', () => {
    expect(() =>
      simulateVaultManagement(null as unknown as VaultData, BigInt('1000000000'))
    ).toThrow('Vault data is required for simulation');
  });

  it('should throw error for zero newTotalAssets', () => {
    expect(() => simulateVaultManagement(baseVault, BigInt('0'))).toThrow(
      'New total assets must be positive'
    );
  });

  it('should throw error for negative newTotalAssets', () => {
    expect(() => simulateVaultManagement(baseVault, BigInt('-1000000000'))).toThrow(
      'New total assets must be positive'
    );
  });

  it('should handle SDK simulation failure', () => {
    vi.mocked(simulate).mockImplementation(() => {
      throw new Error('SDK internal error');
    });

    const newTotalAssets = BigInt('2000000000');

    expect(() => simulateVaultManagement(baseVault, newTotalAssets)).toThrow(
      'Simulation failed: SDK internal error'
    );
  });

  it('should handle new vault with zero supply', () => {
    const newVault: VaultData = {
      ...baseVault,
      state: {
        ...baseVault.state,
        totalSupply: '0',
        totalAssets: '0',
      },
    } as VaultData;

    const mockResult: SimulationResult = {
      totalSupply: BigInt('1000000000000000000'),
      totalAssets: BigInt('1000000000'),
      feesAccrued: BigInt('0'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('1000000000');
    const result = simulateVaultManagement(newVault, newTotalAssets);

    expect(result).toEqual(mockResult);
  });

  it('should handle vault with high fees', () => {
    const highFeeVault: VaultData = {
      ...baseVault,
      state: {
        ...baseVault.state,
        managementFee: '2000', // 20%
        performanceFee: '3000', // 30%
      },
    } as VaultData;

    const mockResult: SimulationResult = {
      totalSupply: BigInt('2000000000000000000'),
      totalAssets: BigInt('2000000000'),
      feesAccrued: BigInt('50000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('2000000000');
    const result = simulateVaultManagement(highFeeVault, newTotalAssets);

    expect(result).toEqual(mockResult);
    expect(result.feesAccrued).toBeGreaterThan(BigInt('0'));
  });

  it('should respect settleDeposit=false parameter', () => {
    const mockResult: SimulationResult = {
      totalSupply: BigInt('2000000000000000000'),
      totalAssets: BigInt('2000000000'),
      feesAccrued: BigInt('10000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('2000000000');
    simulateVaultManagement(baseVault, newTotalAssets, undefined, false);

    expect(simulate).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(simulate).mock.calls[0];
    expect(callArgs[1].settleDeposit).toBe(false);
  });

  it('should handle large deposit (>50% TVL)', () => {
    const mockResult: SimulationResult = {
      totalSupply: BigInt('3000000000000000000'),
      totalAssets: BigInt('3000000000'),
      feesAccrued: BigInt('15000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('3000000000'); // +200% increase
    const result = simulateVaultManagement(baseVault, newTotalAssets);

    expect(result).toEqual(mockResult);
  });

  it('should handle large withdrawal (>50% TVL)', () => {
    const mockResult: SimulationResult = {
      totalSupply: BigInt('200000000000000000'),
      totalAssets: BigInt('200000000'),
      feesAccrued: BigInt('2000000'),
      pricePerShare: BigInt('1000000'),
    };

    vi.mocked(simulate).mockReturnValue(mockResult);

    const newTotalAssets = BigInt('200000000'); // -80% decrease
    const result = simulateVaultManagement(baseVault, newTotalAssets);

    expect(result).toEqual(mockResult);
  });
});
