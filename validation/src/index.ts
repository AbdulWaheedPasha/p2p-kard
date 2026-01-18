import 'dotenv/config';
import express from 'express';
import { ValidationEngine } from './engine/index.js';
import type { ValidationRequest } from './types/index.js';
import { ValidationConfig } from './config/validation.config.js';
import { TrueLayerAdapter } from './providers/openbanking/index.js';
import { userStateManager } from './state/UserStateManager.js';
import { trueLayerProvider } from './providers/truelayer/TrueLayerProvider.js';
import { diditProvider } from './providers/idv/DiditProvider.js';
import { ofacProvider } from './providers/sanctions/OfacProvider.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Initialize providers and validation engine
const trueLayerAdapter = new TrueLayerAdapter();
const validationEngine = new ValidationEngine({
  openBankingProvider: trueLayerAdapter,
});

// ============================================
// Health & Status Endpoints
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: ValidationConfig.modelVersion });
});

// Get user verification status
app.get('/api/v1/users/:userId/status', (req, res) => {
  const state = userStateManager.get(req.params.userId);
  res.json({
    userId: state.userId,
    bankStatus: state.bankStatus,
    idvStatus: state.idvStatus,
    sanctionsChecked: state.sanctionsChecked,
    sanctionsClear: state.sanctionsClear,
    updatedAt: state.updatedAt,
  });
});

// ============================================
// Bank Linking (TrueLayer)
// ============================================

// Generate auth URL for bank linking
app.post('/api/v1/bank/auth-url', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const authUrl = trueLayerProvider.generateAuthUrl(userId);
  console.log(`[BANK] Generated auth URL for user ${userId}`);

  res.json({ authUrl });
});

// TrueLayer OAuth callback
app.get('/api/v1/bank/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error(`[BANK] OAuth error: ${error}`);
      return res.redirect(`${FRONTEND_URL}/bank-link?error=${error}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/bank-link?error=missing_params`);
    }

    // Find user by state
    const userState = userStateManager.findByBankSessionState(state as string);
    if (!userState) {
      console.error(`[BANK] Invalid state: ${state}`);
      return res.redirect(`${FRONTEND_URL}/bank-link?error=invalid_state`);
    }

    console.log(`[BANK] Callback received for user ${userState.userId}`);

    // Exchange code for tokens
    const tokens = await trueLayerProvider.exchangeCode(code as string);

    // Update user state
    userStateManager.update(userState.userId, {
      bankStatus: 'connected',
      bankAccessToken: tokens.accessToken,
      bankRefreshToken: tokens.refreshToken,
      bankTokenExpiresAt: tokens.expiresAt,
      bankSessionState: undefined,
    });

    console.log(`[BANK] User ${userState.userId} bank linked successfully`);

    res.redirect(`${FRONTEND_URL}/bank-link?success=true`);
  } catch (err) {
    console.error('[BANK] Callback error:', err);
    res.redirect(`${FRONTEND_URL}/bank-link?error=exchange_failed`);
  }
});

// Get bank data for a user (uses stored token)
app.get('/api/v1/bank/:userId/data', async (req, res) => {
  try {
    const state = userStateManager.get(req.params.userId);

    if (state.bankStatus !== 'connected' || !state.bankAccessToken) {
      return res.status(400).json({ error: 'Bank not connected' });
    }

    const bankData = await trueLayerProvider.fetchBankData(state.bankAccessToken);
    res.json(bankData);
  } catch (err) {
    console.error('[BANK] Error fetching bank data:', err);
    res.status(500).json({ error: 'Failed to fetch bank data' });
  }
});

// ============================================
// Identity Verification (Didit)
// ============================================

// Create IDV session
app.post('/api/v1/idv/session', async (req, res) => {
  try {
    const { userId, callbackUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const session = await diditProvider.createSession(userId, callbackUrl);
    res.json(session);
  } catch (err) {
    console.error('[IDV] Error creating session:', err);
    res.status(500).json({ error: 'Failed to create IDV session', message: (err as Error).message });
  }
});

// Get IDV session status
app.get('/api/v1/idv/session/:sessionId', async (req, res) => {
  try {
    const result = await diditProvider.getSessionResult(req.params.sessionId);
    res.json(result);
  } catch (err) {
    console.error('[IDV] Error getting session result:', err);
    res.status(500).json({ error: 'Failed to get IDV result' });
  }
});

// Didit webhook
app.post('/api/v1/webhooks/didit', (req, res) => {
  try {
    console.log('[IDV] Webhook received:', JSON.stringify(req.body).slice(0, 200));
    diditProvider.handleWebhook(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[IDV] Webhook error:', err);
    res.status(500).send('Error');
  }
});

// ============================================
// Sanctions Screening (OFAC)
// ============================================

// Check sanctions
app.post('/api/v1/sanctions/check', async (req, res) => {
  try {
    const { fullName, userId } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'fullName is required' });
    }

    const result = await ofacProvider.quickCheck(fullName);

    // Update user state if userId provided
    if (userId) {
      userStateManager.update(userId, {
        sanctionsChecked: true,
        sanctionsClear: result.clear,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[SANCTIONS] Error:', err);
    res.status(500).json({ error: 'Sanctions check failed', message: (err as Error).message });
  }
});

// ============================================
// Validation Endpoints
// ============================================

// Main validation endpoint
app.post('/api/v1/validate', async (req, res) => {
  try {
    const request = req.body as ValidationRequest;

    console.log(`[VALIDATE] advanceId=${request.advanceId} userId=${request.userId} amount=${request.amount}`);

    // If userId is provided and has stored bank token, use it
    if (request.userId && !request.evidence.bankLinkToken) {
      const state = userStateManager.get(request.userId);
      if (state.bankStatus === 'connected' && state.bankAccessToken) {
        request.evidence.bankLinkToken = state.bankAccessToken;
        request.evidence.bankLinkStatus = 'connected';
      }
    }

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
    const { userId, amount, termMonths } = req.body;

    // Get user's bank token if available
    let bankLinkToken: string | undefined;
    let bankLinkStatus: 'connected' | 'not_linked' = 'not_linked';

    if (userId) {
      const state = userStateManager.get(userId);
      if (state.bankStatus === 'connected' && state.bankAccessToken) {
        bankLinkToken = state.bankAccessToken;
        bankLinkStatus = 'connected';
      }
    }

    const request: ValidationRequest = {
      advanceId: 'eligibility-check',
      userId: userId || 'eligibility-check',
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
        bankLinkStatus,
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

// ============================================
// Admin Endpoints
// ============================================

app.post('/api/v1/admin/approve', (req, res) => {
  const { advanceId, reviewerId, notes } = req.body;

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

// Debug endpoint - get all user states (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/v1/debug/states', (req, res) => {
    res.json(userStateManager.getAll());
  });
}

// ============================================
// Legacy callback (for testing)
// ============================================

app.get('/callback', async (req, res) => {
  // Redirect to new callback path
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  res.redirect(`/api/v1/bank/callback?${queryString}`);
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`\nValidation service running on port ${PORT}`);
  console.log(`Version: ${ValidationConfig.modelVersion}`);
  console.log(`\nEndpoints:`);
  console.log(`  Health:     GET  http://localhost:${PORT}/health`);
  console.log(`  User Status: GET  http://localhost:${PORT}/api/v1/users/:userId/status`);
  console.log(`  Bank Auth:  POST http://localhost:${PORT}/api/v1/bank/auth-url`);
  console.log(`  IDV Session: POST http://localhost:${PORT}/api/v1/idv/session`);
  console.log(`  Sanctions:  POST http://localhost:${PORT}/api/v1/sanctions/check`);
  console.log(`  Validate:   POST http://localhost:${PORT}/api/v1/validate`);
  console.log('');
});
