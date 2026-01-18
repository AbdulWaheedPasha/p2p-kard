import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Main validation endpoint - skeleton that returns mock response
app.post('/api/v1/validate', (req, res) => {
  const { advanceId, userId, amount, termMonths } = req.body;

  // TODO: Replace with actual validation logic
  // For now, return a mock "approved" response so Django can integrate

  const mockResponse = {
    decision: 'PASS',
    newStatus: 'Approved',
    requiredActions: [],
    counterOffer: null,
    affordability: {
      monthlyNetIncome: 250000,
      disposableIncome: 85000,
      proposedRepayment: Math.round(amount / termMonths),
      meetsAffordability: true,
      maxAffordableAmount: amount,
      flags: [],
    },
    risk: {
      score: 25,
      reasons: [],
      modelVersion: '1.0.0',
    },
    auditEntries: [
      {
        timestamp: new Date().toISOString(),
        stage: 'validation',
        validator: 'MockValidator',
        decision: 'PASS',
        reasons: ['mock_validation_passed'],
        data: { advanceId, userId, amount, termMonths },
      },
    ],
  };

  console.log(`[VALIDATE] advanceId=${advanceId} amount=${amount} → ${mockResponse.decision}`);
  res.json(mockResponse);
});

// Quick eligibility check - skeleton
app.post('/api/v1/check-eligibility', (req, res) => {
  const { amount } = req.body;

  // TODO: Replace with actual eligibility logic
  res.json({
    eligible: true,
    maxAmount: amount,
    suggestedTermMonths: 6,
    flags: [],
  });
});

// Admin approve - skeleton
app.post('/api/v1/admin/approve', (req, res) => {
  const { advanceId, reviewerId, notes } = req.body;

  // TODO: Replace with actual approval logic
  res.json({
    decision: 'PASS',
    newStatus: 'Approved',
    auditEntries: [
      {
        timestamp: new Date().toISOString(),
        stage: 'manual_review',
        validator: 'AdminReview',
        decision: 'PASS',
        reasons: ['manually_approved'],
        data: { reviewerId, notes },
      },
    ],
  });
});

// Admin reject - skeleton
app.post('/api/v1/admin/reject', (req, res) => {
  const { advanceId, reviewerId, reason } = req.body;

  // TODO: Replace with actual rejection logic
  res.json({
    decision: 'DECLINE',
    newStatus: 'Closed',
    auditEntries: [
      {
        timestamp: new Date().toISOString(),
        stage: 'manual_review',
        validator: 'AdminReview',
        decision: 'DECLINE',
        reasons: [reason],
        data: { reviewerId },
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`Validation service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Validate: POST http://localhost:${PORT}/api/v1/validate`);
});
