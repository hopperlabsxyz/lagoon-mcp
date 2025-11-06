#!/usr/bin/env python3

import os
import sys
import re

def fix_all_simulation_mocks():
    file_path = '/Users/francoisschuers/Documents/workspace/lagoon-mcp/src/tools/__tests__/simulate-vault.test.ts'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"Processing {file_path}...")
        
        # 1. Remplacer tous les vi.mocked(simulateVaultManagement).mockReturnValue(...Result as any)
        content = re.sub(
            r'vi\.mocked\(simulateVaultManagement\)\.mockReturnValue\((\w+) as any\);',
            r'mockSimulateVaultManagement(\1);',
            content
        )
        
        print("Applied fixes:")
        print("- Replaced all simulateVaultManagement mocks with helper function")
        
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print(f"✓ Successfully updated {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

if __name__ == "__main__":
    success = fix_all_simulation_mocks()
    sys.exit(0 if success else 1)