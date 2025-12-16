# Rebalancing Criteria Guide

## Trigger Thresholds

### Concentration Thresholds
| Level | Single Vault % | Action |
|-------|----------------|--------|
| Acceptable | <30% | No action |
| Monitor | 30-40% | Note for next review |
| Attention | 40-50% | Plan rebalancing |
| Urgent | >50% | Immediate consideration |

### Risk Score Thresholds
| Level | Score Change | Action |
|-------|--------------|--------|
| Stable | <10 points | No action |
| Drifting | 10-20 points | Monitor |
| Elevated | 20-30 points | Review position |
| Critical | >30 points | Consider reduction |

### Performance Thresholds
| Level | vs Expected APR | Duration | Action |
|-------|-----------------|----------|--------|
| Normal | >90% | - | No action |
| Underperforming | 70-90% | <30 days | Monitor |
| Underperforming | 70-90% | >30 days | Review |
| Significant | <70% | >30 days | Consider exit |
| Critical | <50% | >14 days | Urgent review |

## Rebalancing Strategies

### Conservative Approach
- Threshold: 50% concentration trigger
- Action: Gradual rebalancing over 2-4 transactions
- Goal: No single position >30%

### Moderate Approach
- Threshold: 40% concentration trigger
- Action: Rebalance when threshold crossed
- Goal: No single position >25%

### Active Approach
- Threshold: 30% concentration trigger
- Action: Regular optimization
- Goal: Target allocation maintained

## Cost Considerations

### Transaction Costs to Factor
1. **Gas fees**: Estimate based on current network conditions
2. **Slippage**: Larger positions may have higher slippage
3. **Exit fees**: Some vaults may have redemption fees

### Cost-Benefit Analysis
```
Net Benefit = Expected Improvement - Transaction Costs

Only rebalance if:
- Net Benefit > 0 for projected holding period
- Or risk reduction justifies the cost
```

## Rebalancing Process

### Step 1: Identify Opportunity
- Compare current vs target allocation
- Calculate deviation magnitude

### Step 2: Estimate Costs
- Get gas estimates for transactions
- Factor in any vault-specific fees

### Step 3: Calculate Net Benefit
- Project improvement in returns or risk
- Compare to transaction costs

### Step 4: Execute if Beneficial
- Start with largest deviations
- Consider batching transactions
- Monitor execution for slippage

### Step 5: Document
- Record rationale for change
- Note new allocation
- Set next review date
