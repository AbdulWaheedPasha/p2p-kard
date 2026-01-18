import 'dotenv/config';
import express from 'express';
import { ValidationEngine } from './engine/index.js';
import type { ValidationRequest } from './types/index.js';
import { ValidationConfig } from './config/validation.config.js';
import { TrueLayerAdapter } from './providers/openbanking/index.js';

// TrueLayer config
const TRUELAYER_CLIENT_ID = process.env.TRUELAYER_CLIENT_ID;
const TRUELAYER_CLIENT_SECRET = process.env.TRUELAYER_CLIENT_SECRET;
const TRUELAYER_REDIRECT_URI = 'http://localhost:3001/callback';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize providers and validation engine
const trueLayerAdapter = new TrueLayerAdapter();
const validationEngine = new ValidationEngine({
  openBankingProvider: trueLayerAdapter,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: ValidationConfig.modelVersion });
});

// TrueLayer OAuth callback - receives auth code and exchanges for access token
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[CALLBACK] TrueLayer error:', error);
    return res.status(400).json({ error: error });
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received' });
  }

  console.log(`[CALLBACK] Received auth code: ${(code as string).slice(0, 20)}...`);
  console.log(`[CALLBACK] State: ${state}`);

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://auth.truelayer-sandbox.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: TRUELAYER_CLIENT_ID!,
        client_secret: TRUELAYER_CLIENT_SECRET!,
        redirect_uri: TRUELAYER_REDIRECT_URI,
        code: code as string,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[CALLBACK] Token exchange failed:', tokenData);
      return res.status(400).json({ error: 'Token exchange failed', details: tokenData });
    }

    console.log('[CALLBACK] Token exchange successful!');
    console.log(`[CALLBACK] Access token: ${tokenData.access_token?.slice(0, 30)}...`);

    // Fetch bank data using the token
    console.log('[CALLBACK] Fetching bank data...');
    const bankData = await trueLayerAdapter.fetchBankData(tokenData.access_token);
    console.log(`[CALLBACK] Fetched ${bankData.accounts.length} accounts, ${bankData.transactions.length} transactions`);

    // Calculate some summary stats
    const totalBalance = bankData.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const incomeTransactions = bankData.transactions.filter(t => t.amount > 0);
    const expenseTransactions = bankData.transactions.filter(t => t.amount < 0);
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + t.amount, 0));

    // Return success page with bank data
    res.send(`
      <html>
        <head>
          <title>TrueLayer Connected</title>
          <style>
            body { font-family: sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
            h1 { color: #2e7d32; }
            .card { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .stat { display: inline-block; margin-right: 30px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #1976d2; }
            .stat-label { color: #666; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #e3f2fd; }
            .income { color: #2e7d32; }
            .expense { color: #c62828; }
            .token-box { background: #fff3e0; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Bank Connected Successfully!</h1>

          <div class="card">
            <h3>Summary</h3>
            <div class="stat">
              <div class="stat-value">${bankData.accounts.length}</div>
              <div class="stat-label">Accounts</div>
            </div>
            <div class="stat">
              <div class="stat-value">&pound;${(totalBalance / 100).toFixed(2)}</div>
              <div class="stat-label">Total Balance</div>
            </div>
            <div class="stat">
              <div class="stat-value">${bankData.transactions.length}</div>
              <div class="stat-label">Transactions</div>
            </div>
          </div>

          <div class="card">
            <h3>Accounts</h3>
            <table>
              <tr><th>Name</th><th>Type</th><th>Balance</th></tr>
              ${bankData.accounts.map(acc => `
                <tr>
                  <td>${acc.name}</td>
                  <td>${acc.type}</td>
                  <td>&pound;${(acc.balance / 100).toFixed(2)}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="card">
            <h3>Transaction Analysis</h3>
            <div class="stat">
              <div class="stat-value income">&pound;${(totalIncome / 100).toFixed(2)}</div>
              <div class="stat-label">Total Income</div>
            </div>
            <div class="stat">
              <div class="stat-value expense">&pound;${(totalExpenses / 100).toFixed(2)}</div>
              <div class="stat-label">Total Expenses</div>
            </div>
          </div>

          <div class="card">
            <h3>Recent Transactions (last 10)</h3>
            <table>
              <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
              ${bankData.transactions.slice(0, 10).map(tx => `
                <tr>
                  <td>${tx.date.substring(0, 10)}</td>
                  <td>${tx.description.substring(0, 40)}</td>
                  <td>${tx.category || 'other'}</td>
                  <td class="${tx.amount > 0 ? 'income' : 'expense'}">
                    ${tx.amount > 0 ? '+' : ''}&pound;${(tx.amount / 100).toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="card">
            <h3>Access Token (for testing)</h3>
            <div class="token-box">${tokenData.access_token}</div>
            <p style="margin-top: 10px; color: #666; font-size: 12px;">
              Expires in: ${tokenData.expires_in} seconds |
              Refresh token: ${tokenData.refresh_token ? 'Yes' : 'No'}
            </p>
          </div>

          <div class="card" style="background: #e8f5e9;">
            <h3>Next: Test Validation</h3>
            <p>Use this curl command to test validation with this bank data:</p>
            <pre style="background: #333; color: #fff; padding: 15px; border-radius: 4px; overflow-x: auto;">
curl -X POST http://localhost:${PORT}/api/v1/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "advanceId": "test-001",
    "userId": "user-001",
    "amount": 50000,
    "currency": "GBP",
    "termMonths": 6,
    "purposeCategory": "rent",
    "payoutMethod": "bank_transfer",
    "user": {
      "emailVerified": true,
      "hasActiveAdvance": false,
      "accountAgeDays": 45
    },
    "evidence": {
      "documents": [{"type": "payslip", "uploadedAt": "2024-01-15"}],
      "bankLinkStatus": "connected",
      "bankLinkToken": "${tokenData.access_token}",
      "idvStatus": "verified"
    }
  }'
            </pre>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[CALLBACK] Error:', err);
    res.status(500).json({ error: 'Failed to exchange token', message: (err as Error).message });
  }
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
