#!/usr/bin/env python3

import os
import sys
import re

def fix_simulation_results():
    file_path = '/Users/francoisschuers/Documents/workspace/lagoon-mcp/src/tools/__tests__/simulate-vault.test.ts'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"Processing {file_path}...")
        
        # 1. Corriger les SimulationResult pour utiliser le bon format
        # Pattern pour identifier les objets SimulationResult
        simulation_patterns = [
            (r'const mockSimulationResult: SimulationResult = \{[^}]+\};', 
             """const mockSimulationResult: SimulationResult = {
    totalSupply: BigInt('2000000000000000000'),
    totalAssets: BigInt('2000000000'),
    feesAccrued: BigInt('10000000'),
    pricePerShare: BigInt('1050000000000000000'),
  };"""),
            
            (r'const withdrawalResult: SimulationResult = \{[^}]+\};',
             """const withdrawalResult: SimulationResult = {
    totalSupply: BigInt('1500000000000000000'),
    totalAssets: BigInt('1500000000'),
    feesAccrued: BigInt('5000000'),
    pricePerShare: BigInt('1000000000000000000'),
  };"""),
            
            (r'const appreciatedResult: SimulationResult = \{[^}]+\};',
             """const appreciatedResult: SimulationResult = {
    totalSupply: BigInt('2000000000000000000'),
    totalAssets: BigInt('2100000000'),
    feesAccrued: BigInt('10000000'),
    pricePerShare: BigInt('1100000000000000000'),
  };"""),
            
            (r'const newVaultResult: SimulationResult = \{[^}]+\};',
             """const newVaultResult: SimulationResult = {
    totalSupply: BigInt('1000000000000000000'),
    totalAssets: BigInt('1000000000'),
    feesAccrued: BigInt('0'),
    pricePerShare: BigInt('1000000000000000000'),
  };""")
        ]
        
        for pattern, replacement in simulation_patterns:
            content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        # 2. Corriger anyData en any
        content = re.sub(r'as anyData', 'as any', content)
        
        print("Applied fixes:")
        print("- Corrected all SimulationResult objects to match Lagoon SDK interface")
        print("- Fixed anyData typo")
        
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print(f"✓ Successfully updated {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

if __name__ == "__main__":
    success = fix_simulation_results()
    sys.exit(0 if success else 1)