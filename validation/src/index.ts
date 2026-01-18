import express from 'express';
import { ValidationEngine } from './engine/index.js';
import type { ValidationRequest } from './types/index.js';
import { ValidationConfig } from './config/validation.config.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize validation engine
const validationEngine = new ValidationEngine();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: ValidationConfig.modelVersion });
});

// Main validation endpoint
app.post('/api/v1/validate', async (req, res) => {
  try {
    const request = req.body as ValidationRequest;

    console.log(`[VALIDATE] advanceId=${request.advanceId} userId=${request.userId} amount=${request.amount}`);

    const result = await validationEngine.validate(request);

    console.log(`[VALIDATE] advanceId=${request.advanceId} → ${result.decision} (risk: ${result.risk.score})`);

    res.json(result);
  } catch (error) {
    console.error('[VALIDATE] Error:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Quick eligibility check
app.post('/api/v1/check-eligibility', async (req, res) => {
  try {
    const { amount, termMonths, bankLinkToken } = req.body;

    // Create a minimal request for eligibility check
    const request: ValidationRequest = {
      advanceId: 'eligibility-check',
      userId: 'eligibility-check',
      amount: amount || 0,
      currency: 'GBP',
      termMonths: termMonths || 6,
      purposeCategory: 'other',
      payoutMethod: 'bank_transfer',
      user: {
        emailVerified: true,
        hasActiveAdvance: false,
        accountAgeDays: 30,
      },
      evidence: {
        documents: [],
        bankLinkStatus: bankLinkToken ? 'connected' : 'not_linked',
        bankLinkToken,
        idvStatus: 'verified',
      },
    };

    const result = await validationEngine.validate(request);

    res.json({
      eligible: result.decision === 'PASS' || result.decision === 'COUNTER_OFFER',
      maxAmount: result.affordability?.maxAffordableAmount || amount,
      suggestedTermMonths: result.affordability?.suggestedTermMonths || termMonths,
      flags: result.affordability?.flags || [],
    });
  } catch (error) {
    console.error('[ELIGIBILITY] Error:', error);
    res.status(500).json({
      error: 'Eligibility check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Admin approve
app.post('/api/v1/admin/approve', (req, res) => {
  const { advanceId, reviewerId, notes } = req.body;

  // Admin approval bypasses automated checks
  res.json({
    decision: 'PASS',
    newStatus: 'Approved',
    requiredActions: [],
    risk: {
      score: 0,
      reasons: ['admin_approved'],
      modelVersion: ValidationConfig.modelVersion,
    },
    auditEntries: [
      {
        timestamp: new Date().toISOString(),
        stage: 'manual_review',
        validator: 'AdminReview',
        decision: 'PASS',
        reasons: ['manually_approved'],
        data: { reviewerId, notes, advanceId },
      },
    ],
  });
});

// Admin reject
app.post('/api/v1/admin/reject', (req, res) => {
  const { advanceId, reviewerId, reason } = req.body;

  res.json({
    decision: 'DECLINE',
    newStatus: 'Rejected',
    requiredActions: [],
    risk: {
      score: 100,
      reasons: ['admin_rejected'],
      modelVersion: ValidationConfig.modelVersion,
    },
    auditEntries: [
      {
        timestamp: new Date().toISOString(),
        stage: 'manual_review',
        validator: 'AdminReview',
        decision: 'DECLINE',
        reasons: [reason || 'Rejected by admin'],
        data: { reviewerId, advanceId },
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`Validation service running on port ${PORT}`);
  console.log(`Version: ${ValidationConfig.modelVersion}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Validate: POST http://localhost:${PORT}/api/v1/validate`);
});
