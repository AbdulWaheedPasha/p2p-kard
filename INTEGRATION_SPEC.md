# ReCircle Integration Specification
**Qard Hasan Advance Validation System**

Version: 1.0 | Date: 2026-01-17

---

## System Overview

```
┌──────────┐      ┌─────────────────┐      ┌─────────────────────┐
│ React FE │ ───► │ Django Backend  │ ───► │ Validation Service  │
│          │      │                 │      │ (Node.js/TypeScript)│
└──────────┘      └────────┬────────┘      └──────────┬──────────┘
                           │                          │
                           ▼                          ▼
                    ┌────────────┐            ┌──────────────┐
                    │ PostgreSQL │            │ Open Banking │
                    └────────────┘            │ IDV, Sanctions│
                                              └──────────────┘
```

| Component | Owner | Responsibilities |
|-----------|-------|------------------|
| React Frontend | FE Colleague | UI, forms, document upload, status display |
| Django Backend | Backend Colleague | Auth, user mgmt, DB operations, FE API |
| Validation Service | Mohammed | Decision engine, affordability, provider calls |
| PostgreSQL | Backend Colleague | Schema, migrations, data persistence |

---

## 1. Database Schema Requirements

### Tables Needed

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique |
| email_verified | BOOLEAN | Required for advance eligibility |
| created_at | TIMESTAMP | For account age calculation |

#### `advances`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users (the borrower) |
| amount | INTEGER | In minor units (pence/cents) |
| currency | VARCHAR(3) | 'GBP', 'EUR', 'USD' |
| term_months | INTEGER | 1-24 |
| purpose_category | VARCHAR(50) | 'rent', 'medical', 'education', 'utilities', 'emergency', 'other' |
| purpose_note | TEXT | Optional free text |
| payout_method | VARCHAR(50) | 'bank_transfer', 'card', 'wallet', 'pay_to_provider' |
| status | VARCHAR(50) | See status enum below |
| risk_score | INTEGER | 0-100, from validation service |
| risk_reasons | JSONB | Array of reason codes |
| risk_model_version | VARCHAR(20) | e.g., '1.0.0' |
| **funding_status** | VARCHAR(20) | 'seeking', 'partially_funded', 'fully_funded', 'disbursed' |
| **amount_pledged** | INTEGER | Sum of all supporter pledges (pence) |
| **amount_confirmed** | INTEGER | Sum of confirmed/transferred pledges (pence) |
| **funded_at** | TIMESTAMP | When fully funded |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Status Enum (validation flow):**
```
Draft → PendingChecks → NeedsAction → ManualReview → Approved → Funded → Repaid/Closed/Defaulted
```

**Funding Status Enum (P2P flow):**
```
seeking → partially_funded → fully_funded → disbursed
```

#### `advance_documents`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| advance_id | UUID | FK → advances |
| type | VARCHAR(50) | 'payslip', 'bank_statement', 'utility_bill', 'medical_bill', etc. |
| file_url | TEXT | S3/storage URL |
| uploaded_at | TIMESTAMP | |

#### `advance_audit_log`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| advance_id | UUID | FK → advances |
| timestamp | TIMESTAMP | |
| stage | VARCHAR(50) | 'preconditions', 'idv', 'sanctions', 'evidence', 'affordability' |
| validator | VARCHAR(100) | e.g., 'PreconditionValidator' |
| decision | VARCHAR(20) | 'PASS', 'NEEDS_ACTION', 'MANUAL_REVIEW', 'COUNTER_OFFER', 'DECLINE' |
| reasons | JSONB | Array of reason strings |
| data | JSONB | Optional supporting data |

#### `bank_links`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| provider | VARCHAR(50) | 'plaid', 'truelayer' |
| access_token | TEXT | Encrypted |
| status | VARCHAR(20) | 'pending', 'connected', 'expired', 'revoked' |
| connected_at | TIMESTAMP | |

#### `idv_verifications`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| provider | VARCHAR(50) | 'onfido', 'sumsub' |
| status | VARCHAR(20) | 'pending', 'verified', 'failed' |
| external_id | VARCHAR(255) | Provider's reference |
| completed_at | TIMESTAMP | |

#### `advance_supports` (P2P Funding - Multiple Supporters per Advance)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| advance_id | UUID | FK → advances |
| supporter_id | UUID | FK → users (the person giving qard hasan) |
| amount | INTEGER | Contribution amount in pence/cents |
| status | VARCHAR(20) | 'pledged', 'confirmed', 'transferred', 'repaid', 'cancelled' |
| pledged_at | TIMESTAMP | When supporter committed |
| confirmed_at | TIMESTAMP | When funds confirmed in escrow/holding |
| transferred_at | TIMESTAMP | When funds sent to borrower |
| repaid_at | TIMESTAMP | When borrower repaid this portion |

**Support Status Flow:**
```
pledged → confirmed → transferred → repaid
    ↓
 cancelled (supporter can cancel before confirmed)
```

**Example: £600 Advance with Multiple Supporters**
```
Advance ID: adv_123 (borrower needs £600 for rent)
├── Support 1: Supporter A pledges £200 (status: confirmed)
├── Support 2: Supporter B pledges £250 (status: pledged)
└── Support 3: Supporter C pledges £150 (status: pledged)
    ────────────────────────────────────────────────────
    Total pledged: £600 | Confirmed: £200 | Remaining: £400
```

#### `repayments` (Tracking Borrower Repayments)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| advance_id | UUID | FK → advances |
| amount | INTEGER | Repayment amount in pence |
| due_date | DATE | Expected payment date |
| paid_at | TIMESTAMP | Actual payment timestamp (null if unpaid) |
| status | VARCHAR(20) | 'upcoming', 'paid', 'late', 'missed' |

#### `repayment_distributions` (Splitting Repayments to Supporters)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| repayment_id | UUID | FK → repayments |
| support_id | UUID | FK → advance_supports |
| amount | INTEGER | Portion going to this supporter (pence) |
| transferred_at | TIMESTAMP | When sent to supporter |

---

## P2P Funding Flow

```
1. BORROWER APPLIES
   └── Borrower requests £600 advance for rent
   └── Validation service approves → status: 'Approved', funding_status: 'seeking'

2. SUPPORTERS BROWSE & PLEDGE
   └── Advance appears in "seeking funding" list
   └── Supporter A pledges £200 → funding_status: 'partially_funded'
   └── Supporter B pledges £250
   └── Supporter C pledges £150 → amount_pledged = £600

3. FUNDS CONFIRMED
   └── Supporters transfer to platform escrow
   └── When amount_confirmed >= amount → funding_status: 'fully_funded'

4. DISBURSEMENT
   └── Platform sends £600 to borrower
   └── status: 'Funded', funding_status: 'disbursed'

5. REPAYMENTS (Monthly)
   └── Borrower pays £100/month (6 month term)
   └── Platform distributes proportionally:
       ├── Supporter A: £33.33 (200/600 = 33.3%)
       ├── Supporter B: £41.67 (250/600 = 41.7%)
       └── Supporter C: £25.00 (150/600 = 25.0%)

6. COMPLETION
   └── After 6 payments, all supporters repaid
   └── status: 'Repaid', all support statuses: 'repaid'
```

---

## 2. Django Backend API Requirements

### User Roles

| Role | Description |
|------|-------------|
| **Supporter** | Donates to loan requests, tracks donations, receives repayments. Can also be a borrower. |
| **Applicant** | Requests loans, receives funds, repays the loan. |
| **Admin** | Verifies users, approves/rejects loans, releases funds, manages platform. |

*Note: A single user can be both Supporter and Applicant (same account).*

---

### Common Endpoints (All Users)

```
# Authentication
POST   /api/auth/register              → Common registration form
POST   /api/auth/login                 → Request email OTP
POST   /api/auth/verify-otp            → Verify OTP, receive token

# Profile Management
GET    /api/users/me                   → Get my profile
PATCH  /api/users/me                   → Update my profile
DELETE /api/users/me                   → Delete account

# Notifications
GET    /api/notifications              → List my notifications
PATCH  /api/notifications/:id/read     → Mark as read
POST   /api/notifications/read-all     → Mark all as read
```

---

### Applicant (Borrower) Endpoints

```
# Advance Request Management
POST   /api/advances                      → Create advance request (draft)
GET    /api/advances/my-requests          → List my advance requests
GET    /api/advances/:id                  → Get advance details + status
PATCH  /api/advances/:id                  → Update draft advance request
DELETE /api/advances/:id                  → Cancel/withdraw advance request

# Supporting Documents
POST   /api/advances/:id/documents        → Upload supporting document
DELETE /api/advances/:id/documents/:docId → Remove document

# Submission
POST   /api/advances/:id/submit           → Submit for review (→ calls Validation Service)
POST   /api/advances/:id/accept-counter   → Accept counter-offer terms

# Receiving Funds
GET    /api/advances/:id/funding-status   → Check funding progress
POST   /api/advances/:id/confirm-receipt  → Confirm funds received

# Repayments
GET    /api/advances/:id/repayments       → View repayment schedule
POST   /api/advances/:id/repayments/:repaymentId/pay → Make a repayment
GET    /api/advances/:id/repayment-history → View payment history
```

**Advance Status Flow (Applicant perspective):**
```
Draft → Submitted → UnderReview → Approved/Rejected → SeekingFunding → Funded → Repaying → Repaid
```

---

### Supporter (Donor) Endpoints

```
# Browse Advance Requests
GET    /api/advances/available         → List approved advances seeking funding
GET    /api/advances/:id               → View advance details (public info)

# Donate / Support
POST   /api/advances/:id/support       → Pledge support (full or partial amount)
DELETE /api/advances/:id/support/:supportId → Cancel my pledge (before confirmed)
POST   /api/advances/:id/support/:supportId/confirm → Confirm funds transferred

# My Donations Dashboard
GET    /api/my-supports                → List all advances I'm supporting
GET    /api/my-supports/active         → Currently active (not yet repaid)
GET    /api/my-supports/completed      → Fully repaid advances
GET    /api/my-supports/stats          → Total donated, total returned, etc.

# Repayment Tracking
GET    /api/my-supports/:supportId/repayments → View repayment status for this advance
GET    /api/my-returns                 → All repayment distributions I've received
```

---

### Platform Admin Endpoints

```
# User Management
GET    /api/admin/users                → List all users
GET    /api/admin/users/:id            → View user details
POST   /api/admin/users/:id/verify     → Mark user as verified
POST   /api/admin/users/:id/suspend    → Suspend user account
POST   /api/admin/users/:id/unsuspend  → Reactivate user

# Advance Management
GET    /api/admin/advances             → List all advances (with filters)
GET    /api/admin/advances/pending-review → Advances awaiting admin review
GET    /api/admin/advances/:id         → View full advance details + audit log

# Advance Verification & Approval
POST   /api/admin/advances/:id/verify  → Mark documents as verified
POST   /api/admin/advances/:id/approve → Approve advance (→ calls Validation Service)
POST   /api/admin/advances/:id/reject  → Reject advance with reason
POST   /api/admin/advances/:id/request-info → Request more info from applicant

# Fund Release
GET    /api/admin/advances/ready-to-release → Fully funded, pending release
POST   /api/admin/advances/:id/release → Release funds to applicant

# Repayment Verification
GET    /api/admin/repayments/pending   → Repayments pending verification
POST   /api/admin/repayments/:id/verify → Verify repayment received

# Advertisements (optional - if admin creates featured listings)
POST   /api/admin/advertisements       → Create donation advertisement
GET    /api/admin/advertisements       → List all ads
PATCH  /api/admin/advertisements/:id   → Update ad
DELETE /api/admin/advertisements/:id   → Remove ad

# Notifications (Broadcast)
POST   /api/admin/notifications/broadcast → Notify all supporters of new advance
POST   /api/admin/notifications/send   → Send notification to specific user

# Platform Stats
GET    /api/admin/stats                → Dashboard stats (total advances, amounts, etc.)
GET    /api/admin/stats/advances       → Advance statistics
GET    /api/admin/stats/users          → User statistics
```

---

### Which Endpoints Call Validation Service?

| Endpoint | Calls Validation? | Purpose |
|----------|-------------------|---------|
| `POST /api/advances/:id/submit` | **YES** | Applicant submits advance for review |
| `POST /api/admin/advances/:id/approve` | **YES** | Admin final approval (after manual review) |
| `POST /api/admin/advances/:id/reject` | **YES** | Admin rejection (logs to audit) |

All other endpoints are handled entirely by Django.

### Internal: Calling Validation Service

When Django receives `POST /api/advances/:id/submit`:

```python
# Django pseudo-code
def submit_advance(request, advance_id):
    advance = Advance.objects.get(id=advance_id)
    user = advance.user
    documents = advance.documents.all()
    bank_link = user.bank_links.filter(status='connected').first()
    idv = user.idv_verifications.filter(status='verified').first()

    # Call Validation Service
    response = requests.post(
        'http://validation-service:3000/api/v1/validate',
        json={
            'advanceId': str(advance.id),
            'userId': str(user.id),
            'amount': advance.amount,
            'currency': advance.currency,
            'termMonths': advance.term_months,
            'purposeCategory': advance.purpose_category,
            'purposeNote': advance.purpose_note,
            'payoutMethod': advance.payout_method,
            'user': {
                'emailVerified': user.email_verified,
                'hasActiveAdvance': Advance.objects.filter(
                    user=user,
                    status__in=['PendingChecks', 'NeedsAction', 'ManualReview', 'Approved', 'Funded']
                ).exists(),
                'accountAgeDays': (now() - user.created_at).days
            },
            'evidence': {
                'documents': [{'type': d.type, 'uploadedAt': d.uploaded_at.isoformat()} for d in documents],
                'bankLinkStatus': bank_link.status if bank_link else 'not_linked',
                'bankLinkToken': bank_link.access_token if bank_link else None,
                'idvStatus': idv.status if idv else 'not_started'
            }
        },
        timeout=30
    )

    result = response.json()

    # Update database with results
    advance.status = result['newStatus']
    advance.risk_score = result['risk']['score']
    advance.risk_reasons = result['risk']['reasons']
    advance.risk_model_version = result['risk']['modelVersion']
    advance.save()

    # Append audit log entries
    for entry in result['auditEntries']:
        AdvanceAuditLog.objects.create(
            advance=advance,
            timestamp=entry['timestamp'],
            stage=entry['stage'],
            validator=entry['validator'],
            decision=entry['decision'],
            reasons=entry['reasons'],
            data=entry.get('data')
        )

    return JsonResponse(result)
```

---

## 3. Validation Service API (Mohammed provides)

Base URL: `http://validation-service:3000`

### POST /api/v1/validate

**Request:**
```json
{
  "advanceId": "uuid",
  "userId": "uuid",
  "amount": 80000,
  "currency": "GBP",
  "termMonths": 6,
  "purposeCategory": "rent",
  "purposeNote": "Monthly rent",
  "payoutMethod": "bank_transfer",
  "user": {
    "emailVerified": true,
    "hasActiveAdvance": false,
    "accountAgeDays": 45
  },
  "evidence": {
    "documents": [{ "type": "payslip", "uploadedAt": "2024-01-15T00:00:00Z" }],
    "bankLinkStatus": "connected",
    "bankLinkToken": "access_token_xxx",
    "idvStatus": "verified"
  }
}
```

**Response:**
```json
{
  "decision": "PASS | NEEDS_ACTION | MANUAL_REVIEW | COUNTER_OFFER | DECLINE",
  "newStatus": "Approved | NeedsAction | ManualReview | ...",
  "requiredActions": [
    { "type": "LINK_BANK_ACCOUNT", "description": "Connect your bank account" },
    { "type": "UPLOAD_DOCUMENT", "description": "Upload a payslip or bank statement" }
  ],
  "counterOffer": {
    "suggestedAmount": 60000,
    "suggestedTermMonths": 8,
    "reason": "Based on income analysis..."
  },
  "affordability": {
    "monthlyNetIncome": 250000,
    "disposableIncome": 85000,
    "proposedRepayment": 13333,
    "meetsAffordability": true,
    "maxAffordableAmount": 90000,
    "flags": []
  },
  "risk": {
    "score": 25,
    "reasons": ["short_account_age"],
    "modelVersion": "1.0.0"
  },
  "auditEntries": [
    {
      "timestamp": "2024-01-20T10:30:00Z",
      "stage": "preconditions",
      "validator": "PreconditionValidator",
      "decision": "PASS",
      "reasons": ["email_verified", "no_active_advance"]
    }
  ]
}
```

### POST /api/v1/check-eligibility (optional - quick check)

**Request:**
```json
{
  "amount": 80000,
  "termMonths": 6,
  "bankLinkToken": "access_token_xxx"
}
```

**Response:**
```json
{
  "eligible": true,
  "maxAmount": 90000,
  "suggestedTermMonths": 6,
  "flags": []
}
```

### POST /api/v1/admin/approve

**Request:**
```json
{
  "advanceId": "uuid",
  "reviewerId": "admin_uuid",
  "notes": "Manually verified employment"
}
```

### POST /api/v1/admin/reject

**Request:**
```json
{
  "advanceId": "uuid",
  "reviewerId": "admin_uuid",
  "reason": "Unable to verify income"
}
```

### GET /health

**Response:**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## 4. Business Rules Summary

### Evidence Requirements by Amount

| Amount | Requirements |
|--------|-------------|
| < £200 | Stable income + clean history (no docs required) |
| £200 - £999 | 1 supporting document OR pay-to-provider |
| ≥ £1000 | 2 documents + pay-to-provider + manual review |

### Affordability Rules

| Rule | Threshold |
|------|-----------|
| Max repayment ratio | 30% of disposable income |
| Minimum buffer | £200 remaining after repayment |
| Volatility penalty | -15% cap per volatility tier |

### Required Checks

1. **Preconditions:** Email verified, no active advance, unique user
2. **IDV:** Identity verification completed
3. **Bank Link:** Open Banking connected
4. **Sanctions/PEP:** Not on sanctions list, PEP check passed
5. **Fraud:** No abuse signals detected
6. **Affordability:** Income-based assessment passed

---

## 5. Deployment

```yaml
# docker-compose.yml
services:
  django:
    build: ./django-backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgres://...
      - VALIDATION_SERVICE_URL=http://validation:3000

  validation:
    build: ./validation-service
    ports:
      - "3000:3000"
    environment:
      - PLAID_CLIENT_ID=xxx
      - PLAID_SECRET=xxx

  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data

  react:
    build: ./frontend
    ports:
      - "3001:80"
```

---

## 6. Timeline Coordination

| Phase | Django Backend | Validation Service | FE |
|-------|---------------|-------------------|-----|
| 1 | DB schema + migrations | Types + mock endpoints | Basic forms |
| 2 | User auth + advance CRUD | Core validation engine | Auth flow |
| 3 | Bank link integration | Open Banking adapter | Bank link UI |
| 4 | Submit flow + audit log | Affordability engine | Status display |
| 5 | Admin endpoints | Admin approve/reject | Admin panel |
| 6 | Integration testing | Integration testing | E2E testing |

---

## Questions / TBD

- [ ] Which Open Banking provider? (Plaid vs TrueLayer)
- [ ] Which IDV provider? (Onfido vs Sumsub)
- [ ] Notification system for status changes?
- [ ] Rate limiting per user?

### P2P Funding Questions
- [ ] **Escrow handling** - Do supporters transfer to platform wallet, or direct to borrower?
- [ ] **Partial funding** - Can borrower accept partial funding (e.g., £400 of £600 requested)?
- [ ] **Funding timeout** - How long can an advance stay in 'seeking' before expiring?
- [ ] **Supporter limits** - Max supporters per advance? Min/max pledge amount?
- [ ] **Supporter verification** - Do supporters need IDV/bank link too?
- [ ] **Late repayments** - How to handle missed payments? Grace period?
