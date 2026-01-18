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
| user_id | UUID | FK → users |
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
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Status Enum:**
```
Draft → PendingChecks → NeedsAction → ManualReview → Approved → Funded → Repaid/Closed/Defaulted
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

---

## 2. Django Backend API Requirements

### User-Facing Endpoints (FE consumes these)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-otp

GET    /api/users/me
GET    /api/users/me/bank-link-status
POST   /api/users/me/initiate-bank-link      → Returns redirect URL for Open Banking
POST   /api/users/me/initiate-idv            → Returns redirect URL for IDV

POST   /api/advances                          → Create draft advance
GET    /api/advances                          → List user's advances
GET    /api/advances/:id                      → Get advance details + status
POST   /api/advances/:id/documents            → Upload supporting document
DELETE /api/advances/:id/documents/:docId     → Remove document
POST   /api/advances/:id/submit               → Submit for validation (calls Validation Service)
POST   /api/advances/:id/accept-counter-offer → Accept counter-offer terms
POST   /api/advances/:id/withdraw             → User cancels request
```

### Admin Endpoints

```
GET    /api/admin/advances/pending-review     → List advances needing manual review
POST   /api/admin/advances/:id/approve        → Calls Validation Service
POST   /api/admin/advances/:id/reject         → Calls Validation Service
```

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
