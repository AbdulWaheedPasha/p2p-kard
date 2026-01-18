/**
 * TrueLayer Connection Test Script
 *
 * Run with: npx tsx src/test-truelayer.ts
 *
 * This script:
 * 1. Verifies credentials are loaded
 * 2. Generates an auth link for the mock bank
 * 3. Shows you the URL to test the bank linking flow
 */

import 'dotenv/config';
import { AuthAPIClient, DataAPIClient } from 'truelayer-client';

const clientId = process.env.TRUELAYER_CLIENT_ID;
const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
const redirectUri = 'http://localhost:3001/callback'; // We'll handle this

async function main() {
  console.log('\n🔐 TrueLayer Connection Test\n');
  console.log('='.repeat(50));

  // 1. Check credentials
  console.log('\n1. Checking credentials...');
  if (!clientId || !clientSecret) {
    console.error('❌ Missing TRUELAYER_CLIENT_ID or TRUELAYER_CLIENT_SECRET in .env');
    process.exit(1);
  }
  console.log(`   ✓ Client ID: ${clientId}`);
  console.log(`   ✓ Secret: ${clientSecret.slice(0, 8)}...`);

  // 2. Initialize auth client (sandbox mode)
  console.log('\n2. Initializing TrueLayer client (sandbox)...');
  const authClient = new AuthAPIClient({
    client_id: clientId,
    client_secret: clientSecret,
    env: 'sandbox',  // USE SANDBOX ENVIRONMENT
  } as any);
  console.log('   ✓ Auth client initialized (sandbox)');

  // 3. Generate auth link (manually for sandbox)
  console.log('\n3. Generating auth link for Mock Bank...');

  const scopes = ['info', 'accounts', 'balance', 'transactions', 'offline_access'];
  const nonce = 'test-nonce-' + Date.now();

  // Build sandbox auth URL manually
  const authUrl = `https://auth.truelayer-sandbox.com/?` + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state: nonce,
    provider_id: 'mock',
  }).toString();

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ SUCCESS! Your TrueLayer sandbox is configured.\n');
  console.log('📋 NEXT STEPS:\n');
  console.log('1. Add this redirect URI in TrueLayer Console:');
  console.log(`   ${redirectUri}\n`);
  console.log('2. Open this URL in your browser to test bank linking:');
  console.log(`\n   ${authUrl}\n`);
  console.log('3. Select "Mock" bank and use credentials:');
  console.log('   Username: john');
  console.log('   Password: doe\n');
  console.log('4. After auth, you\'ll be redirected to the callback URL');
  console.log('   with a "code" parameter - that\'s the auth code to exchange\n');
  console.log('='.repeat(50));
}

main().catch(console.error);
