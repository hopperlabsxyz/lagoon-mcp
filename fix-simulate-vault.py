#!/usr/bin/env python3

import os
import sys
import re

def fix_simulate_vault_test():
    file_path = '/Users/francoisschuers/Documents/workspace/lagoon-mcp/src/tools/__tests__/simulate-vault.test.ts'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"Processing {file_path}...")
        
        # 1. Remplacer le mockVault avec un mock complet selon le modèle de mockVault
        mock_vault_replacement = """  const mockVault: Vault = {
    id: 'vault-test',
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Vault',
    symbol: 'TEST',
    decimals: 18,
    description: 'Test vault for simulation',
    shortDescription: 'Test vault',
    isVisible: true,
    inception: 1700000000,
    maxCapacity: '10000000000000000000000',
    logoUrl: 'https://example.com/test.png',
    asset: {
      id: 'asset-usdc',
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      network: 'Arbitrum',
      logoUrl: 'https://example.com/usdc.png',
    },
    chain: {
      id: '42161',
      name: 'Arbitrum',
      nativeToken: 'ETH',
      factory: '0xfactory123',
      isVisible: true,
      logoUrl: 'https://example.com/arbitrum.png',
    },
    state: {
      totalSupply: '1000000000000000000',
      totalAssets: '1000000000',
      totalAssetsUsd: 1000.0,
      totalSharesIssued: '1000000000000000000',
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
    airdrops: [],
    incentives: [],
    nativeYields: [],
    curators: [
      {
        id: 'curator-test',
        name: 'Test Curator',
        description: 'Test curator for simulation',
        logoUrl: 'https://example.com/curator.png',
      },
    ],
  } as Vault;"""

        # Pattern pour remplacer le mockVault existant
        vault_pattern = r'const mockVault: VaultData = \{[^}]+\{[^}]+\} as const,[^}]+\{[^}]+\{[^}]+\} as const,[^}]+\{[^}]+\} as const,[^}]+\} as const,[^}]+\} as VaultData;'
        
        content = re.sub(vault_pattern, mock_vault_replacement, content, flags=re.DOTALL)
        
        # 2. Supprimer feesAccrued des SimulationResult (plusieurs occurrences)
        content = re.sub(r'(\s+)feesAccrued: BigInt\([\'"][0-9]+[\'"]\),?\n', '', content)
        
        # 3. Corriger les JSON.parse avec type assertion
        content = re.sub(
            r'const content = JSON\.parse\(result\.content\[0\]\.text\) as Record<string, unknown>;',
            'const content = JSON.parse(result.content[0].text as string) as Record<string, unknown>;',
            content
        )
        
        print("Applied fixes:")
        print("- Updated mockVault to proper Vault type with all required fields")
        print("- Removed feesAccrued properties from SimulationResult objects")
        print("- Fixed JSON.parse type assertions")
        
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print(f"✓ Successfully updated {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

if __name__ == "__main__":
    success = fix_simulate_vault_test()
    sys.exit(0 if success else 1)