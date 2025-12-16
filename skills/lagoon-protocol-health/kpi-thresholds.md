# KPI Thresholds Reference

## TVL Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| Protocol TVL Growth (7d) | >0% | -5% to 0% | <-5% |
| Protocol TVL Growth (30d) | >5% | 0% to 5% | <0% |
| Single Vault TVL Drop (24h) | <-5% | -5% to -15% | >-15% |
| Single Vault TVL Drop (7d) | <-10% | -10% to -30% | >-30% |
| Vault TVL Minimum | >$100K | $50K-$100K | <$50K |

## Risk Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| Avg Protocol Risk Score | <40 | 40-60 | >60 |
| High-Risk Vault % (score >60) | <10% | 10-20% | >20% |
| Risk Score Change (7d) | <+10 | +10 to +20 | >+20 |
| Max Single Vault Risk | <70 | 70-80 | >80 |

## Performance Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| APR Delivery Rate | >90% | 70-90% | <70% |
| APR Volatility (30d CV) | <20% | 20-40% | >40% |
| Vaults with APR = 0 | 0 | 1-2 | >2 |

## Activity Thresholds

| Metric | Healthy (Green) | Warning (Yellow) | Critical (Red) |
|--------|-----------------|------------------|----------------|
| Daily Active Vaults | >80% | 60-80% | <60% |
| Weekly New Deposits | >10 | 5-10 | <5 |
| Deposit/Redemption Ratio | >0.8 | 0.5-0.8 | <0.5 |

## Escalation Procedures

### Red Alert Actions
1. Notify ops lead immediately via Slack #lagoon-alerts
2. Identify affected vaults and users
3. Prepare incident report within 1 hour
4. Schedule emergency review if systemic issue

### Yellow Warning Actions
1. Add to daily standup agenda
2. Monitor for escalation over 24-48 hours
3. Document in weekly report
4. Consider proactive user communication
