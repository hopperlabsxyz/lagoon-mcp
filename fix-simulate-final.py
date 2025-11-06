#!/usr/bin/env python3

import os
import sys
import re

def fix_simulate_vault_final():
    file_path = '/Users/francoisschuers/Documents/workspace/lagoon-mcp/src/tools/__tests__/simulate-vault.test.ts'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"Processing {file_path}...")
        
        # 1. Remplacer tous les SimulationResult par LagoonSimulationResult
        content = re.sub(r': SimulationResult = \{', ': LagoonSimulationResult = {', content)
        
        # 2. Ajouter feesAccrued aux objets manquants
        # Pattern pour trouver les objets sans feesAccrued
        patterns_to_fix = [
            (r'const withdrawalResult: LagoonSimulationResult = \{\s*totalSupply: BigInt\([^}]+\}\s*totalAssets: BigInt\([^}]+\}\s*pricePerShare: BigInt\([^}]+\}\s*\};',
             """const withdrawalResult: LagoonSimulationResult = {
    totalSupply: BigInt('1500000000000000000'),
    totalAssets: BigInt('1500000000'),
    feesAccrued: BigInt('5000000'),
    pricePerShare: BigInt('1000000000000000000'),
  };"""),
            
            (r'const appreciatedResult: LagoonSimulationResult = \{\s*totalSupply: BigInt\([^}]+\}\s*totalAssets: BigInt\([^}]+\}\s*\};',
             """const appreciatedResult: LagoonSimulationResult = {
    totalSupply: BigInt('2000000000000000000'),
    totalAssets: BigInt('2100000000'),
    feesAccrued: BigInt('10000000'),
    pricePerShare: BigInt('1100000000000000000'),
  };"""),
            
            (r'const newVaultResult: LagoonSimulationResult = \{\s*totalSupply: BigInt\([^}]+\}\s*totalAssets: BigInt\([^}]+\}\s*pricePerShare: BigInt\([^}]+\}\s*\};',
             """const newVaultResult: LagoonSimulationResult = {
    totalSupply: BigInt('1000000000000000000'),
    totalAssets: BigInt('1000000000'),
    feesAccrued: BigInt('0'),
    pricePerShare: BigInt('1000000000000000000'),
  };""")
        ]
        
        for pattern, replacement in patterns_to_fix:
            content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        # 3. Corriger les casts as any pour simulateVaultManagement 
        content = re.sub(
            r'vi\.mocked\(simulateVaultManagement\)\.mockReturnValue\(([^)]+)\);',
            r'vi.mocked(simulateVaultManagement).mockReturnValue(\1 as any);',
            content
        )
        
        # 4. Remplacer les { vault: mockVault } as any par une version typée
        content = re.sub(
            r'\{ vault: mockVault \} as any',
            '{ vault: mockVault }',
            content
        )
        
        # 5. Remplacer (mockVault as any).state par mockVault.state (avec cast global)
        content = re.sub(
            r'\(mockVault as any\)\.state',
            '(mockVault as any).state',  # Garde tel quel pour l'instant
            content
        )
        
        print("Applied fixes:")
        print("- Converted all SimulationResult to LagoonSimulationResult")
        print("- Added missing feesAccrued properties") 
        print("- Fixed simulateVaultManagement mock calls with type casts")
        print("- Cleaned up GraphQL mock type assertions")
        
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print(f"✓ Successfully updated {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

if __name__ == "__main__":
    success = fix_simulate_vault_final()
    sys.exit(0 if success else 1)