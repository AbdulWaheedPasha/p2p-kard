# Advance Request Validation Process

## Overview

When a user requests an advance (Qard Hasan), we validate their request through a multi-stage process combining automated checks and human review where necessary.

---

## Stage 1: Preconditions (Automated)

Before any financial assessment, we verify basic eligibility:

| Check | Requirement | Failure Action |
|-------|-------------|----------------|
| Email verified | User must have verified email | Block until verified |
| No active advance | User cannot have an existing unpaid advance | Block until repaid |
| Amount limits | Request between £50 - £5,000 | Reject if outside range |
| Term limits | Repayment term 1-24 months | Reject if outside range |
| Identity verified | IDV check passed | Block until verified |

---

## Stage 2: Evidence Requirements (Automated)

Based on the requested amount, we require supporting documentation:

| Amount | Documents Required | Additional Requirements |
|--------|-------------------|------------------------|
| Up to £200 | 1 document | - |
| £200 - £1,000 | 1 document | - |
| Over £1,000 | 1 document | Requires manual review |

**Acceptable documents:** Payslip, bank statement, utility bill, employment letter, benefits letter

---

## Stage 3: Affordability Assessment (Automated)

We connect to the user's bank via Open Banking to analyse their financial situation:

### What We Calculate

1. **Monthly Net Income** - Median income over last 2-3 months (salary, benefits, regular income)
2. **Essential Outgoings** - Rent/mortgage, utilities, groceries, transport
3. **Disposable Income** - Net income minus essential outgoings
4. **Proposed Repayment** - Advance amount divided by term months

### Affordability Rules

- Monthly repayment must be ≤ 30% of disposable income
- User must retain ≥ £200 buffer after repayment
- Volatility penalty applied if income varies significantly

### Risk Flags Detected

| Flag | Trigger | Impact |
|------|---------|--------|
| HIGH_VOLATILITY | Income varies >40% month-to-month | +20 risk points |
| FREQUENT_OVERDRAFT | >5 days negative balance in period | +15 risk points |
| LOW_BUFFER | <£200 remaining after repayment | +10 risk points |
| HIGH_DEBT_RATIO | Existing debt payments >30% of disposable | +15 risk points |
| INSUFFICIENT_HISTORY | <60 days of bank history | +10 risk points |

---

## Stage 4: Decision (Automated)

Based on risk score (0-100):

| Risk Score | Decision | What Happens |
|------------|----------|--------------|
| 0-30 | **AUTO-APPROVE** | Advance approved, funds released |
| 31-70 | **MANUAL REVIEW** | Sent to human reviewer |
| 71-100 | **DECLINE** | Rejected with reason provided |

If affordable but amount too high → **COUNTER-OFFER** with suggested lower amount/longer term

---

## Stage 5: Manual Review (Human)

When a request needs manual review, a human reviewer checks:

### Document Verification
- [ ] Payslip matches stated employer and income
- [ ] Bank statement matches linked bank data
- [ ] Documents are recent (within 3 months)
- [ ] No signs of document tampering

### Income Verification
- [ ] Salary deposits are consistent and from legitimate employer
- [ ] Self-employed: invoices/contracts support stated income
- [ ] Benefits: official letters confirm entitlement

### Spending Pattern Review
- [ ] No signs of gambling addiction (frequent betting transactions)
- [ ] No signs of financial distress beyond stated purpose
- [ ] Spending aligns with stated circumstances

### Purpose Verification
- [ ] Stated purpose is genuine (rent arrears, medical, education, etc.)
- [ ] For pay-to-provider: verify provider is legitimate
- [ ] Amount requested aligns with stated purpose

### Identity & Fraud Checks
- [ ] Name on bank account matches application
- [ ] No duplicate applications from same household
- [ ] Address verification if concerns exist

### Reviewer Decision

| Decision | When to Use |
|----------|-------------|
| **APPROVE** | All checks pass, genuine need confirmed |
| **APPROVE WITH CONDITIONS** | Approve but require pay-to-provider |
| **REQUEST MORE INFO** | Need additional documents or clarification |
| **DECLINE** | Red flags found, unverifiable information, or unaffordable |

---

## Audit Trail

Every decision (automated or manual) is logged with:
- Timestamp
- Decision made
- Reasons/flags
- Reviewer ID (if manual)
- Supporting data

This ensures full traceability for compliance and dispute resolution.

---

## Summary Flow

```
User Submits Request
        ↓
[Preconditions] ──FAIL──→ Block + Tell user why
        ↓ PASS
[Evidence Check] ──MISSING──→ Request documents
        ↓ COMPLETE
[Bank Link] ──NOT LINKED──→ Request bank connection
        ↓ LINKED
[Affordability] ──UNAFFORDABLE──→ Counter-offer or Decline
        ↓ AFFORDABLE
[Risk Score] ──LOW──→ Auto-Approve
        ↓ MEDIUM/HIGH
[Manual Review] → Human Decision → Approve/Decline
```
