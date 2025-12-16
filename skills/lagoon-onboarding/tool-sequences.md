# Lagoon Onboarding Tool Sequences

Detailed tool usage patterns for the onboarding workflow.

## Quick Reference: Tool Selection

| Analysis Need | Primary Tool | Fallback |
|--------------|--------------|----------|
| Find vaults matching profile | `search_vaults` | `query_graphql` |
| Assess vault risk | `analyze_risk` | Manual analysis |
| Check historical performance | `get_vault_performance` | `get_price_history` |
| Project future returns | `simulate_vault` | Manual calculation |
| Compare shortlisted vaults | `compare_vaults` | Side-by-side manual |

## Detailed Tool Parameters by Profile

### Conservative User Search

```json
{
  "filters": {
    "state_totalAssetsUsd_gte": 5000000,
    "isVisible_eq": true
  },
  "orderBy": "totalAssetsUsd",
  "orderDirection": "desc",
  "maxResults": 5,
  "responseFormat": "summary"
}
```

**Post-filter**: Only recommend vaults where `analyze_risk` returns score <40.

### Moderate User Search

```json
{
  "filters": {
    "state_totalAssetsUsd_gte": 1000000,
    "isVisible_eq": true
  },
  "orderBy": "totalAssetsUsd",
  "orderDirection": "desc",
  "maxResults": 5,
  "responseFormat": "summary"
}
```

**Post-filter**: Accept vaults with risk score 30-60.

### Aggressive User Search

```json
{
  "filters": {
    "state_totalAssetsUsd_gte": 500000,
    "isVisible_eq": true
  },
  "orderBy": "totalAssetsUsd",
  "orderDirection": "desc",
  "maxResults": 5,
  "responseFormat": "summary"
}
```

**Post-filter**: Accept higher risk scores but flag concerns.

## Risk Analysis Workflow

### Step 1: Call analyze_risk

```json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "responseFormat": "detailed"
}
```

### Step 2: Interpret Results

**Risk Score Mapping**:
| Score Range | Category | User Action |
|-------------|----------|-------------|
| 0-20 | Very Low | Excellent for conservatives |
| 21-40 | Low | Good for most profiles |
| 41-60 | Medium | Moderate profile appropriate |
| 61-80 | High | Aggressive only, with warnings |
| 81-100 | Very High | Discourage for beginners |

### Step 3: Factor-by-Factor Explanation

For each risk factor, explain in user-friendly terms:

- **TVL Risk**: "This measures how much total value is in the vault. Higher TVL generally means more stability and easier exits."

- **Concentration Risk**: "This shows if a few large depositors dominate the vault. High concentration means one large withdrawal could impact everyone."

- **Volatility Risk**: "This reflects how much the vault's returns have fluctuated. Lower volatility means more predictable returns."

- **Age Risk**: "Newer vaults have less track record. More established vaults have proven their strategy over time."

- **Curator Risk**: "This assesses the vault manager's experience and reputation. Established curators with good track records score lower risk."

## Performance Analysis Workflow

### Step 1: Get Historical Data

```json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "timeRange": "30d",
  "responseFormat": "summary"
}
```

### Step 2: Key Metrics to Highlight

1. **APR Trend**: Is it stable, increasing, or declining?
2. **Volatility**: High volatility = unpredictable returns
3. **Consistency**: Does APR stay within a reasonable range?

### Step 3: Interpretation Guidelines

| APR Behavior | Interpretation | Recommendation |
|--------------|----------------|----------------|
| Stable within 5% | Consistent strategy | Good sign |
| Gradual increase | Growing efficiency | Positive |
| Gradual decrease | Strategy underperforming | Monitor closely |
| High volatility | Unpredictable returns | Caution for beginners |

## Simulation Workflow

### Step 1: Gather User Inputs

- Deposit amount (in asset units)
- Expected APR (from performance analysis)
- Time horizon (from profile assessment)

### Step 2: Call simulate_vault

```json
{
  "vaultAddress": "0x...",
  "chainId": 1,
  "newTotalAssets": "current_tvl + user_deposit",
  "includeAPRCalculations": true
}
```

### Step 3: Present Scenarios

Always present multiple scenarios:
- **Expected**: Based on current APR
- **Conservative**: 20% lower APR
- **Optimistic**: 20% higher APR (if sustainable)

**Important**: Always caveat that these are projections, not guarantees.

## Comparison Workflow

When user has shortlisted 2-3 vaults:

### Step 1: Call compare_vaults

```json
{
  "vaultAddresses": ["0x...", "0x...", "0x..."],
  "chainId": 1,
  "responseFormat": "summary"
}
```

### Step 2: Create Comparison Matrix

| Metric | Vault A | Vault B | Vault C | Best For |
|--------|---------|---------|---------|----------|
| APR | | | | Highest yield |
| TVL | | | | Most liquidity |
| Risk Score | | | | Lowest risk |
| Age | | | | Most established |

### Step 3: Profile-Based Recommendation

Map comparison results back to user profile:
- Conservative: Prioritize lowest risk score
- Moderate: Balance APR and risk
- Aggressive: Prioritize APR with acceptable risk

## Error Handling

### Tool Fails

If a tool call fails:
1. Acknowledge the limitation
2. Explain what information is missing
3. Proceed with available data
4. Recommend user verify on-chain

### Insufficient Data

If vault has limited history:
1. Clearly state the data limitation
2. Increase caution recommendations
3. Suggest smaller initial deposit
4. Recommend more frequent monitoring

## Caching Considerations

Tool data has different freshness:
- `search_vaults`: 10 min cache (discovery is okay)
- `analyze_risk`: 15 min cache (relatively stable)
- `get_vault_performance`: 30 min cache (historical data)
- `simulate_vault`: No cache (real-time calculation)

For time-sensitive decisions, remind users to verify current on-chain data.
