/**
 * DeFi Glossary Resource
 *
 * Comprehensive terminology guide for Lagoon DeFi Protocol.
 * Explains vault concepts, financial metrics, and transaction types.
 */

export function getDefiGlossary(): string {
  return `# Lagoon DeFi Protocol - Glossary

## Core Vault Concepts

### Vault
A DeFi vault is an automated investment strategy that manages user deposits to generate yield. In Lagoon, vaults are ERC-4626 compliant smart contracts that accept deposits of a specific asset and issue shares representing ownership.

**Key Properties:**
- **Address**: Unique Ethereum address identifying the vault contract
- **Symbol**: Short identifier (e.g., "LAG-USDC-ETH")
- **Asset**: The underlying ERC-20 token accepted for deposits
- **Total Assets**: Combined value of all deposited assets (in asset units)
- **Total Supply**: Total shares issued to depositors
- **Price Per Share (PPS)**: Vault share value = totalAssets / totalSupply

### Shares
Vault shares represent proportional ownership of the vault's assets. When users deposit, they receive shares. When they withdraw, they burn shares to receive assets.

**Share Mechanics:**
- Shares are minted on deposit at current PPS
- Shares are burned on withdrawal at current PPS
- Share value increases as vault generates yield
- Shares are transferable ERC-20 tokens

### Asset
The underlying ERC-20 token that the vault accepts for deposits (e.g., USDC, WETH, DAI).

**Asset Properties:**
- Decimals: Precision (e.g., USDC = 6, WETH = 18)
- Price USD: Current USD value per token unit
- Symbol: Token ticker (e.g., "USDC", "WETH")

---

## Financial Metrics

### Total Value Locked (TVL)
The total USD value of all assets deposited in the vault. Critical metric for vault size and adoption.

**Calculation:** \`TVL = totalAssets * assetPriceUsd\`

**Interpretation:**
- TVL > $10M: Large, established vault
- TVL $1M-$10M: Medium-sized vault
- TVL < $1M: Small or new vault

### Annual Percentage Rate (APR)
The annualized rate of return for vault deposits. Lagoon provides multiple APR metrics:

**Types:**
- **Gross APR**: Total yield before fees
- **Net APR**: Yield after management and performance fees
- **Linear Net APR**: Simple annualized return
- **Live APR**: Current real-time APR estimate

**Time Periods:**
- **Inception APR**: Since vault launch
- **Yearly APR**: Last 365 days
- **Monthly APR**: Last 30 days
- **Weekly APR**: Last 7 days

### Price Per Share (PPS)
The value of one vault share in terms of underlying assets.

**Calculation:** \`PPS = totalAssets / totalSupply\`

**Growth:** PPS increases as vault generates yield. A rising PPS indicates profitable strategy.

**Example:**
- Initial PPS: 1.0 (1 share = 1 asset)
- After 1 year at 10% APR: 1.1 (1 share = 1.1 assets)
- Depositor's gain: 10% return

### Capacity
Maximum assets the vault can accept. Some vaults have capacity limits due to strategy constraints.

**Properties:**
- **Max Capacity**: Hard limit on total deposits
- **Utilization**: Current deposits / max capacity
- **Remaining Capacity**: Available deposit space

**Risk Indicator:**
- Utilization > 90%: High risk of deposit reversion
- Utilization 70-90%: Approaching capacity
- Utilization < 70%: Ample room for deposits

---

## Vault States and Operations

### Vault States
Vaults transition through different operational states:

**State Values:**
- **OPEN**: Normal operation, accepting deposits/withdrawals
- **CLOSING**: Last call for deposits, preparing to close
- **CLOSED**: No new deposits, only withdrawals allowed

### Settlement Process
Lagoon uses an asynchronous and synchronous settlement system for deposits and withdrawals:

**Synchronous Deposit Flow:**
1. User requests deposit
2. Vault processes deposit immediately
3. Shares minted and distributed to users

**Asynchronous Deposit Flow:**
1. User requests deposit → assets locked in pending state
2. Vault processes batch during settlement window
3. Shares minted and distributed to users

**Asynchronous Withdrawal Flow:**
1. User requests redemption → shares locked in pending state
2. Vault liquidates positions during settlement
3. Assets returned to users

**Key Fields:**
- **Pending Settlement**: Assets/shares awaiting batch processing
- **Average Settlement**: Typical time for settlement (hours)
- **Safe Asset Balance**: Immediately available liquidity

---

## Transaction Types

### TotalAssetsUpdated
Records changes to vault's total asset value. Most frequent transaction type.

**Use Cases:**
- Performance tracking over time
- TVL history and trend analysis
- Price per share calculations

**Data Fields:**
- totalAssets: New total assets (BigInt)
- totalAssetsUsd: New TVL in USD
- timestamp: When update occurred

### PeriodSummary
Aggregated vault metrics for a specific time period (typically daily).

**Use Cases:**
- Volume analysis (deposits + withdrawals)
- Daily TVL snapshots
- Activity level tracking

**Data Fields:**
- tvl: Total value locked at period end
- deposits: Total deposited during period (BigInt)
- withdrawals: Total withdrawn during period (BigInt)

### DepositRequest
User initiates a deposit into the vault.

**Data Fields:**
- sender: User address
- amount: Assets to deposit (BigInt)
- shares: Expected shares to receive

### SettleDeposit
Vault processes pending deposits and mints shares.

**Data Fields:**
- assetsDeposited: Assets added to vault (BigInt)
- sharesMinted: Shares issued to depositors

### RedeemRequest
User initiates a withdrawal from the vault.

**Data Fields:**
- redeemer: User address
- shares: Shares to burn (BigInt)
- assets: Expected assets to receive

### SettleRedeem
Vault processes pending withdrawals and returns assets.

**Data Fields:**
- sharesRedeemed: Shares burned (BigInt)
- assetsWithdrawn: Assets returned to users

### StateUpdated
Vault state transition (OPEN ↔ CLOSING ↔ CLOSED).

**Data Fields:**
- oldState: Previous state
- newState: New state
- reason: Why state changed

### RatesUpdated
Changes to vault fee rates.

**Data Fields:**
- managementFee: New management fee (%)
- performanceFee: New performance fee (%)

---

## Fees and Revenue

### Management Fee
Annual fee charged on total assets under management, regardless of performance.

**Typical Range:** 0% - 2% annually

**Example:** 2% management fee = 2% of TVL charged per year

### Performance Fee
Fee charged on profits generated by the vault strategy.

**Typical Range:** 0% - 20% of profits

**Example:** 10% performance fee = 10% of gains goes to vault manager

**Calculation:**
- Vault generates 15% return
- 10% performance fee applied
- User receives: 15% * 0.9 = 13.5% net return
- Manager receives: 15% * 0.1 = 1.5% of profit

### High Water Mark
Ensures performance fees are only charged on new profits, not recovery of previous losses.

**Mechanism:**
- Tracks highest PPS achieved
- Performance fees only apply to gains above high water mark
- Prevents double-charging on volatile performance

---

## Roles and Governance

### Curator
Entity that designs and manages the vault strategy. Curators are responsible for:
- Strategy selection and optimization
- Risk management and monitoring
- Performance reporting
- Fee collection

**Multiple Curators:** Some vaults have multiple curators collaborating on strategy.

### Integrator
Platform or protocol that integrates the Lagoon vault into their UI/UX.

**Benefits:**
- Custom branding and user experience
- Integration fees or revenue sharing
- Whitelabel vault access

### Roles (Smart Contract)
**Owner:** Administrative control over vault settings
**Valuation Manager:** Updates vault valuations and pricing
**Whitelist Manager:** Controls deposit access permissions
**Safe:** Multisig wallet holding vault assets
**Fee Receiver:** Receives management and performance fees

---

## DeFi Integrations

Vaults may integrate with external DeFi protocols for yield generation:

**Common Integrations:**
- **DEX (Decentralized Exchange)**: Uniswap, Curve, Balancer for liquidity provision
- **Lending Protocols**: Aave, Compound for supply-side yield
- **Staking**: Native token staking for rewards
- **Derivatives**: Options, perpetuals for hedged strategies

**Integration Properties:**
- Name: Protocol name (e.g., "Uniswap V3")
- Type: Category (DEX, Lending, Staking, etc.)
- Description: Strategy details
- Link: Protocol URL

---

## Yield Components

### Native Yields
Base yield from underlying protocol (e.g., Uniswap trading fees, Aave lending interest).

**Properties:**
- APR: Current annualized rate
- Description: Source of yield
- Start/End Timestamp: Yield period
- Logo: Protocol branding

### Incentives
Additional yield from protocol token emissions or rewards programs.

**Properties:**
- APR: Incentive rate
- Incentive Rate: Tokens distributed per unit time
- Reference Token: Reward token (e.g., UNI, COMP)
- End Timestamp: When incentives expire

### Airdrops
One-time token distributions to vault participants.

**Properties:**
- APR: Annualized value of airdrop
- Distribution Timestamp: When distributed
- Multiplier: Boost factor for early participants
- PPS Increase: Impact on share value

---

## Risk Metrics

### Concentration Risk
Percentage of portfolio in single vault or asset.

**Risk Levels:**
- <20%: Low concentration, well-diversified
- 20-30%: Moderate concentration
- >30%: High concentration risk

### Chain Risk
Exposure to specific blockchain networks.

**Considerations:**
- Multi-chain diversification reduces risk
- Consider chain security, decentralization
- Bridge risks for cross-chain strategies

### Curator Track Record
Historical performance and reliability of vault curator.

**Evaluation Criteria:**
- Past vault performance
- Strategy consistency
- Risk management history
- Transparency and communication

---

## Common Calculations

### Deposit Calculation
**Shares Received** = depositAmount / pricePerShare

**Example:**
- Deposit: 1000 USDC
- Current PPS: 1.05
- Shares Received: 1000 / 1.05 = 952.38 shares

### Withdrawal Calculation
**Assets Received** = sharesRedeemed * pricePerShare

**Example:**
- Redeem: 1000 shares
- Current PPS: 1.10
- Assets Received: 1000 * 1.10 = 1100 USDC

### Return Calculation
**Percent Return** = ((currentPPS / depositPPS) - 1) * 100

**Example:**
- Deposit PPS: 1.00
- Current PPS: 1.15
- Return: ((1.15 / 1.00) - 1) * 100 = 15%

### TVL Change
**Percent Change** = ((endTVL / startTVL) - 1) * 100

**Example:**
- Start TVL: $1M
- End TVL: $1.2M
- Change: ((1.2 / 1.0) - 1) * 100 = +20%

---

## Best Practices

### For Analysis
1. **Compare Time Periods**: Use multiple APR time windows for trend analysis
2. **Check Capacity**: Ensure vault has room before recommending deposits
3. **Review Fees**: Factor in management and performance fees for net returns
4. **Assess Risk**: Consider curator track record, capacity utilization, chain risk
5. **Verify Liquidity**: Check safe asset balance for immediate withdrawal needs

### For Portfolio Management
1. **Diversify**: Spread across multiple vaults, assets, and chains
2. **Monitor Performance**: Track PPS growth and APR consistency
3. **Rebalance**: Adjust allocations based on performance and risk
4. **Stay Informed**: Watch for state changes, fee updates, and integrations

### For Risk Management
1. **Capacity Awareness**: Avoid vaults >80% utilized
2. **Curator Due Diligence**: Research curator history and strategy
3. **Emergency Planning**: Understand settlement times for withdrawals
4. **Fee Impact**: Calculate net returns after all fees

---

*Last Updated: ${new Date().toISOString().split('T')[0]}*
*Version: Phase 3 - Lagoon MCP Server*
`;
}
