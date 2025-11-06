# simulate_vault

Simulate vault operations with new total assets to model deposit/withdrawal scenarios with protocol-accurate calculations.

## Overview

The `simulate_vault` tool provides "what-if" analysis for vault operations by simulating the effects of deposit or withdrawal transactions before they occur. It uses the Lagoon Protocol SDK to perform protocol-accurate calculations that match the smart contract behavior, including:

- Management and performance fee accruals
- Share price impact analysis
- Settlement requirements for pending deposits/withdrawals
- APR calculations from historical data
- Risk and liquidity assessments

This tool is essential for:
- **Pre-transaction planning**: Understanding the exact outcome before committing
- **Fee optimization**: Timing transactions to minimize fee impact
- **Settlement strategy**: Determining when to settle pending deposits
- **Risk assessment**: Evaluating the impact of large deposits/withdrawals

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vaultAddress` | string | Yes | Vault contract address (must be valid Ethereum address: 0x...) |
| `chainId` | number | Yes | Network ID (e.g., 1 for Ethereum, 42161 for Arbitrum) |
| `newTotalAssets` | string | Yes | Proposed total assets after operation in wei (must be positive integer string) |
| `settleDeposit` | boolean | No | Whether to settle pending deposits (default: `true`) |
| `includeAPRCalculations` | boolean | No | Include APR analysis from historical data (default: `true`) |

### Parameter Details

#### `newTotalAssets`
This is the key parameter that defines your simulation scenario:

- **For deposits**: `newTotalAssets` = current total assets + deposit amount
- **For withdrawals**: `newTotalAssets` = current total assets - withdrawal amount
- **Format**: Wei (smallest unit), as a string to preserve BigInt precision
- **Example**: For USDC (6 decimals), $1000 = "1000000000" (1000 * 10^6)

#### `settleDeposit`
Controls whether pending deposits are settled in the simulation:
- `true` (default): Simulates immediate settlement of pending deposits
- `false`: Keeps deposits pending, useful for analyzing settlement timing

#### `includeAPRCalculations`
Controls APR analysis inclusion:
- `true` (default): Fetches historical data and calculates 30-day and inception APR
- `false`: Skips APR calculations for faster responses

## Output Structure

```json
{
  "simulation": {
    "vaultAddress": "0x...",
    "chainId": 42161,
    "timestamp": 1700000000000,
    "sdkVersion": "@lagoon-protocol/v0-computation@0.12.0"
  },
  "currentState": {
    "totalAssets": "1000000000",
    "totalAssetsFormatted": "1000.00",
    "totalSupply": "1000000000000000000",
    "totalSupplyFormatted": "1.00",
    "pricePerShare": "1000000",
    "pricePerShareFormatted": "1.00",
    "managementFee": "200",
    "performanceFee": "1000",
    "highWaterMark": "1000000"
  },
  "simulatedState": {
    "totalAssets": "2000000000",
    "totalAssetsFormatted": "2000.00",
    "totalSupply": "2000000000000000000",
    "totalSupplyFormatted": "2.00",
    "pricePerShare": "1000000",
    "pricePerShareFormatted": "1.00",
    "feesAccrued": {
      "total": "10000000",
      "totalFormatted": "10.00",
      "management": "Included in total",
      "performance": "Included in total"
    },
    "sharePriceImpact": {
      "absolute": "0",
      "absoluteFormatted": "0.00",
      "percentage": 0,
      "direction": "unchanged"
    }
  },
  "settlementAnalysis": {
    "settleDeposit": true,
    "assetsInSafe": "500000000",
    "pendingSiloBalances": {
      "assets": "100000000",
      "shares": "100000000000000000"
    },
    "pendingSettlement": {
      "assets": "50000000",
      "shares": "50000000000000000"
    }
  },
  "aprAnalysis": {
    "method": "Lagoon SDK v0.10.1 (protocol-accurate)",
    "dataSource": "Lagoon GraphQL period summaries",
    "thirtyDay": {
      "timestamp": 1700000000,
      "pricePerShare": "1050000",
      "pricePerShareFormatted": "1.05"
    },
    "inception": {
      "timestamp": 1690000000,
      "pricePerShare": "1000000",
      "pricePerShareFormatted": "1.00"
    }
  }
}
```

### Output Sections Explained

#### `simulation`
Metadata about the simulation:
- Vault and network identifiers
- Timestamp (when simulation was performed)
- SDK version used for calculations

#### `currentState`
Current vault metrics before the simulated operation:
- Total assets and supply
- Current price per share
- Fee configuration
- High water mark for performance fees

#### `simulatedState`
Projected vault metrics after the simulated operation:
- New total assets and supply
- New price per share
- **Fees accrued**: Management and performance fees charged
- **Share price impact**: Change in price per share (absolute and percentage)

#### `settlementAnalysis`
Settlement requirements and liquidity details:
- Assets available in safe for immediate redemption
- Pending silo balances (deposits waiting to be settled)
- Pending settlement (withdrawals waiting to be processed)

#### `aprAnalysis` (optional)
Historical APR calculations:
- **thirtyDay**: Price per share 30 days ago
- **inception**: Price per share at vault inception
- Used to project yield and evaluate performance trends

## Use Cases

### 1. Deposit Planning
**Question**: "If I deposit $10,000, what will my share price be?"

```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "11000000000",
  "settleDeposit": true,
  "includeAPRCalculations": true
}
```

**Analysis**:
- Compare `currentState.pricePerShare` vs `simulatedState.pricePerShare`
- Review `simulatedState.feesAccrued` to understand fee impact
- Check `sharePriceImpact.percentage` for dilution/appreciation

### 2. Withdrawal Analysis
**Question**: "How much can I withdraw without triggering settlement unwinding?"

```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "500000000",
  "settleDeposit": false,
  "includeAPRCalculations": false
}
```

**Analysis**:
- Check `settlementAnalysis.assetsInSafe` (available for immediate redemption)
- If withdrawal > assetsInSafe, unwinding is required
- Review `settlementAnalysis.pendingSettlement` for queued withdrawals

### 3. Fee Estimation
**Question**: "What fees will I pay over 30 days with my deposit?"

```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "1050000000",
  "settleDeposit": true,
  "includeAPRCalculations": true
}
```

**Analysis**:
- Review `currentState.managementFee` (annual rate in basis points)
- Check `simulatedState.feesAccrued.total` for immediate fees
- Calculate: `(managementFee / 10000) * deposit * (30/365)` for 30-day projection

### 4. Settlement Strategy
**Question**: "Should I settle deposits now or wait?"

```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "1000000000",
  "settleDeposit": true,
  "includeAPRCalculations": true
}
```

Compare with `settleDeposit: false` to see the difference:
- Settlement may trigger management fee accrual
- May update high water mark, affecting performance fees
- Check `aprAnalysis` to evaluate if vault is appreciating

### 5. Large Position Impact
**Question**: "If I add 50% more TVL, how will it affect other depositors?"

```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "1500000000",
  "settleDeposit": true,
  "includeAPRCalculations": true
}
```

**Analysis**:
- Check `sharePriceImpact.percentage` (should be near 0% for dilution-free)
- Review `simulatedState.feesAccrued` (higher TVL = more fees)
- Evaluate liquidity via `settlementAnalysis.assetsInSafe`

## Data Sources

- **Vault Data**: Lagoon GraphQL API (real-time on-chain state)
- **Period Summaries**: Lagoon GraphQL API (historical snapshots)
- **Calculations**: Lagoon SDK v0.10.1 (`@lagoon-protocol/v0-computation`)
- **No External Dependencies**: No Alchemy, no direct RPC calls

## Calculation Methodology

The simulation uses the Lagoon Protocol SDK's `simulate()` function, which implements the exact logic from the vault smart contracts:

1. **Fee Accrual**:
   - Management fees: Time-based (annual rate prorated)
   - Performance fees: Only if new total assets exceed high water mark

2. **Share Conversion**:
   - Assets to shares: `shares = (assets * totalSupply) / totalAssets`
   - Shares to assets: `assets = (shares * totalAssets) / totalSupply`
   - Rounding: Up for deposits (user favor), Down for withdrawals (vault favor)

3. **Decimal Handling**:
   - Supports different vault and asset decimals (e.g., 18-decimal shares, 6-decimal USDC)
   - Decimals offset: `vaultDecimals - assetDecimals`
   - All calculations in BigInt for precision

4. **Settlement Logic**:
   - Pending deposits settled if `settleDeposit = true`
   - Affects total supply and may trigger fee accrual
   - Updates high water mark if new assets increase price per share

## Performance

- **Response Time**: ~500-800ms (depending on APR calculations)
- **Token Usage**: ~400-600 tokens per simulation
- **Caching**: No caching (always fresh simulation)
- **GraphQL Queries**:
  - 1 query for vault data (~200ms)
  - 1 query for period summaries if `includeAPRCalculations=true` (~300ms)

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Vault not found" | Invalid address or chain | Verify address and chainId |
| "New total assets must be positive" | Zero or negative value | Provide positive integer string |
| "Invalid Ethereum address format" | Malformed address | Use 40-character hex string with 0x prefix |
| "Simulation failed" | SDK internal error | Check vault state validity, retry |

## Related Tools

- **`get_vault_data`**: Get current vault state before simulation
- **`get_vault_performance`**: View historical performance metrics
- **`analyze_risk`**: Assess risk including fee impact (enhanced with Phase 3)
- **`predict_yield`**: Project future yields (enhanced with Phase 3)

## Examples

### Example 1: Simple Deposit Simulation

**Input**:
```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "2000000000",
  "settleDeposit": true,
  "includeAPRCalculations": true
}
```

**Output** (simplified):
```json
{
  "currentState": {
    "totalAssets": "1000000000",
    "totalAssetsFormatted": "1000.00 USDC",
    "pricePerShare": "1000000",
    "pricePerShareFormatted": "1.00 USDC"
  },
  "simulatedState": {
    "totalAssets": "2000000000",
    "totalAssetsFormatted": "2000.00 USDC",
    "pricePerShare": "1000000",
    "pricePerShareFormatted": "1.00 USDC",
    "feesAccrued": {
      "total": "10000000",
      "totalFormatted": "10.00 USDC"
    },
    "sharePriceImpact": {
      "percentage": 0,
      "direction": "unchanged"
    }
  }
}
```

**Interpretation**:
- Depositing $1000 USDC doubles the vault TVL
- Price per share remains $1.00 (no dilution)
- $10 USDC in management fees accrued
- No performance fees (not above high water mark)

### Example 2: Withdrawal Without Settlement

**Input**:
```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "newTotalAssets": "750000000",
  "settleDeposit": false,
  "includeAPRCalculations": false
}
```

**Output** (simplified):
```json
{
  "currentState": {
    "totalAssets": "1000000000",
    "totalAssetsFormatted": "1000.00 USDC"
  },
  "simulatedState": {
    "totalAssets": "750000000",
    "totalAssetsFormatted": "750.00 USDC",
    "sharePriceImpact": {
      "percentage": -0.5,
      "direction": "decrease"
    }
  },
  "settlementAnalysis": {
    "settleDeposit": false,
    "assetsInSafe": "500000000",
    "pendingSiloBalances": {
      "assets": "100000000"
    }
  }
}
```

**Interpretation**:
- Withdrawing $250 USDC (25% of TVL)
- Price per share decreases by 0.5%
- $500 USDC available in safe (sufficient for this withdrawal)
- $100 USDC in pending deposits not settled

## Limitations

- **Simulation Only**: Does not execute transactions on-chain
- **Static Snapshot**: Based on current vault state; market conditions may change
- **Fee Approximation**: Exact fees depend on block timestamp when transaction executes
- **No Slippage**: Does not account for asset price slippage during deposit/withdrawal
- **Single Operation**: Simulates one operation at a time, not multiple sequential operations

## Best Practices

1. **Always simulate before large transactions** (>10% of TVL)
2. **Check settlement requirements** to avoid unwinding delays
3. **Compare with/without settlement** to optimize timing
4. **Monitor fee impact** for high-fee vaults (>2% management fee)
5. **Use APR analysis** to evaluate vault performance trends
6. **Verify current state** with `get_vault_data` before simulation
7. **Consider gas costs** when timing actual transactions

## Technical Notes

- **BigInt Precision**: All amounts in wei to avoid floating-point errors
- **Type Safety**: Full TypeScript types with Zod validation
- **SDK Version**: Uses `@lagoon-protocol/v0-computation@0.12.0`
- **Protocol Accuracy**: Calculations match vault smart contract logic exactly
- **Stateless**: Each simulation is independent, no server-side state

## Related Prompts

**Vault Simulation Pattern**: [/docs/prompts/financial-analysis.md#4-vault-simulation-pattern](../prompts/financial-analysis.md#4-vault-simulation-pattern)

See the analytical guide for:
- Pre-transaction planning strategies
- Fee optimization techniques
- Impact analysis for large transactions
- Settlement timing optimization

---

## Version History

- **v0.1.0** (Phase 2): Initial release with complete simulation functionality

## Support

For issues, questions, or feature requests, please refer to:
- Main documentation: `README.md`
- SDK integration guide: `docs/SDK_INTEGRATION.md`
- GitHub issues: https://github.com/your-repo/lagoon-mcp/issues
