# Risk Interpretation Guide for Beginners

How to explain risk concepts to first-time DeFi users.

## Risk Score Explained Simply

The overall risk score (0-100) is a composite measure of five factors. Lower is safer.

### Visual Risk Scale

```
0    20    40    60    80    100
|-----|-----|-----|-----|-----|
 Very  Low   Med  High  Very
 Low               High

Conservative users: Stay under 40
Moderate users: 30-60 acceptable
Aggressive users: Up to 80 with awareness
```

## Factor-by-Factor Explanations

### TVL Risk (Total Value Locked)

**What it means**: How much money is deposited in the vault.

**Why it matters**:
- Higher TVL = more people trust this vault
- Higher TVL = easier to withdraw without impact
- Very low TVL = potential liquidity issues

**User-friendly explanation**:
> "Think of TVL like a swimming pool. A bigger pool (higher TVL) means more room for swimmers and easier to get in and out. A small pool can get crowded quickly."

**Thresholds for beginners**:
| TVL | Risk Level | Recommendation |
|-----|------------|----------------|
| >$10M | Very Low | Excellent liquidity |
| $5M-$10M | Low | Good for most users |
| $1M-$5M | Medium | Acceptable with awareness |
| $500K-$1M | Higher | Caution advised |
| <$500K | High | Not recommended for beginners |

### Concentration Risk

**What it means**: Whether a few large depositors dominate the vault.

**Why it matters**:
- High concentration = if one whale exits, it affects everyone
- Low concentration = more distributed, more stable

**User-friendly explanation**:
> "Imagine a bus. If one person takes up half the seats, when they leave, the bus feels much emptier. We prefer vaults where no single person dominates."

**Warning signs**:
- Top 5 depositors hold >50% of TVL
- Any single depositor >20% of TVL

### Volatility Risk

**What it means**: How much the vault's returns fluctuate.

**Why it matters**:
- High volatility = unpredictable returns
- Low volatility = more consistent, easier to plan

**User-friendly explanation**:
> "Volatility is like weather predictability. Some places have consistent weather (low volatility), others have wild swings (high volatility). For beginners, consistent weather is easier to plan around."

**Interpretation**:
| APR Variation | Risk Level | Suitable For |
|---------------|------------|--------------|
| <5% range | Low | Conservatives |
| 5-15% range | Medium | Most users |
| >15% range | High | Risk-tolerant only |

### Age Risk

**What it means**: How long the vault has been operating.

**Why it matters**:
- Older vaults have proven their strategy works
- Newer vaults are unproven, even if promising

**User-friendly explanation**:
> "Age is like a restaurant track record. A restaurant open for 5 years has proven it can stay in business. A new restaurant might be great, but it's less proven."

**Guidelines**:
| Vault Age | Risk Level | Recommendation |
|-----------|------------|----------------|
| >12 months | Very Low | Well-established |
| 6-12 months | Low | Good track record |
| 3-6 months | Medium | Monitor closely |
| 1-3 months | Higher | Small amounts only |
| <1 month | High | Not for beginners |

### Curator Risk

**What it means**: The reputation and experience of the vault manager.

**Why it matters**:
- Experienced curators know how to handle market conditions
- New curators may lack experience during stress

**User-friendly explanation**:
> "The curator is like a fund manager. You want someone with a track record of managing money well, not their first day on the job."

**Evaluation criteria**:
- How long have they been curating?
- How much total value do they manage?
- What's their historical performance?
- Are they publicly known and accountable?

## Combining Risk Factors

### The Complete Picture

Don't look at factors in isolation. Consider:

1. **Factor interactions**: Low TVL + High concentration = Double caution
2. **Profile alignment**: High volatility might be okay for aggressive users
3. **Compensating factors**: New vault but established curator = mitigates age risk

### Risk Score Integration

Present the overall picture:

```
Overall Risk Assessment: [Score]/100 - [Category]

Strengths:
+ [Factor with good score]
+ [Another positive]

Areas of Concern:
- [Factor with concerning score]
- [Explanation of why it matters]

Profile Fit: [GOOD / ACCEPTABLE / CAUTION / MISMATCH]
```

## Red Flags Checklist

### Automatic Disqualifiers

- [ ] TVL under $100K
- [ ] Curator unverified or anonymous
- [ ] Recent security incident
- [ ] APR seems impossibly high (>50% without clear source)

### Yellow Flags (Proceed with Caution)

- [ ] Vault less than 90 days old
- [ ] Curator less than 6 months experience
- [ ] TVL declining rapidly (>30% in 30 days)
- [ ] Single depositor >30% of TVL
- [ ] Strategy documentation unclear

## User Communication Templates

### When Risk is Appropriate

> "This vault's risk score of [X] aligns well with your [profile] preferences. The main factors contributing to this score are [factors]. Based on the historical data, this appears suitable for your stated goals."

### When Risk is Higher Than Profile

> "This vault's risk score of [X] is higher than typically recommended for [profile] investors. The main concerns are [factors]. If you're still interested, consider: (1) reducing your deposit amount, (2) setting stricter monitoring triggers, or (3) exploring these lower-risk alternatives: [alternatives]."

### When Risk Data is Limited

> "This vault has limited historical data because it's relatively new ([X] days old). While the current metrics look [assessment], the limited track record means there's more uncertainty. For educational purposes, consider starting with a smaller amount than planned, and monitoring more frequently."

## Questions Users Should Ask

Help users develop critical thinking by suggesting questions:

1. "What could cause this vault's APR to drop significantly?"
2. "How quickly can I withdraw if I need to exit?"
3. "What happens to my funds if the underlying protocol has issues?"
4. "How does this curator handle market downturns?"
5. "What are the fees and how do they affect my returns?"

## Disclaimer Reminder

Always conclude risk discussions with:

> "Remember: All investments carry risk, including the potential loss of your entire deposit. This analysis is educational, not financial advice. Past performance does not guarantee future results. Consider consulting a financial advisor for personalized guidance."
