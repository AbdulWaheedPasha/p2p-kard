// TrueLayer Open Banking Provider
// Handles OAuth flow, token management, and bank data fetching

import { userStateManager } from '../../state/UserStateManager.js';
import type { BankData, BankAccount, Transaction, TransactionCategory } from '../../types/index.js';

export class TrueLayerProvider {
  private clientId = process.env.TRUELAYER_CLIENT_ID!;
  private clientSecret = process.env.TRUELAYER_CLIENT_SECRET!;
  private redirectUri = process.env.TRUELAYER_REDIRECT_URI || 'http://localhost:3001/api/v1/bank/callback';
  private isSandbox = process.env.TRUELAYER_ENV === 'sandbox';

  private get authBaseUrl() {
    return this.isSandbox
      ? 'https://auth.truelayer-sandbox.com'
      : 'https://auth.truelayer.com';
  }

  private get apiBaseUrl() {
    return this.isSandbox
      ? 'https://api.truelayer-sandbox.com'
      : 'https://api.truelayer.com';
  }

  /**
   * Generate TrueLayer auth URL for a user
   */
  generateAuthUrl(userId: string): string {
    const state = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Store state for callback verification
    userStateManager.update(userId, {
      bankStatus: 'pending',
      bankSessionState: state,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'info accounts balance transactions offline_access',
      state: state,
    });

    // Use mock provider in sandbox, real providers in production
    if (this.isSandbox) {
      params.set('providers', 'mock');
    } else {
      params.set('providers', 'uk-ob-all uk-oauth-all');
    }

    return `${this.authBaseUrl}/?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const response = await fetch(`${this.authBaseUrl}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const response = await fetch(`${this.authBaseUrl}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Get all accounts
   */
  async getAccounts(accessToken: string): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/data/v1/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Failed to get accounts: ${response.status}`);
    return response.json();
  }

  /**
   * Get transactions for an account
   */
  async getTransactions(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch(
      `${this.apiBaseUrl}/data/v1/accounts/${accountId}/transactions`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error(`Failed to get transactions: ${response.status}`);
    return response.json();
  }

  /**
   * Get balance for an account
   */
  async getBalance(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch(
      `${this.apiBaseUrl}/data/v1/accounts/${accountId}/balance`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error(`Failed to get balance: ${response.status}`);
    return response.json();
  }

  /**
   * Fetch all bank data (accounts, balances, transactions) formatted for validation
   */
  async fetchBankData(accessToken: string): Promise<BankData> {
    const accountsResponse = await this.getAccounts(accessToken);
    const accounts: BankAccount[] = [];
    const transactions: Transaction[] = [];

    for (const acc of accountsResponse.results || []) {
      const account: BankAccount = {
        accountId: acc.account_id,
        name: acc.display_name || acc.account_id,
        type: this.mapAccountType(acc.account_type),
        currency: acc.currency,
        balance: 0,
        availableBalance: 0,
      };

      // Fetch balance
      try {
        const balanceData = await this.getBalance(accessToken, acc.account_id);
        if (balanceData.results?.[0]) {
          account.balance = Math.round(balanceData.results[0].current * 100);
          account.availableBalance = Math.round(
            (balanceData.results[0].available || balanceData.results[0].current) * 100
          );
        }
      } catch (err) {
        console.error(`[TrueLayer] Error fetching balance for ${acc.account_id}:`, err);
      }

      accounts.push(account);

      // Fetch transactions
      try {
        const txData = await this.getTransactions(accessToken, acc.account_id);
        for (const tx of txData.results || []) {
          transactions.push({
            transactionId: tx.transaction_id,
            accountId: acc.account_id,
            amount: Math.round(tx.amount * 100),
            currency: tx.currency,
            date: tx.timestamp,
            description: tx.description || '',
            category: this.mapCategory(tx.transaction_category, tx.description, tx.amount),
            merchantName: tx.merchant_name,
            pending: tx.transaction_type === 'PENDING',
          });
        }
      } catch (err) {
        console.error(`[TrueLayer] Error fetching transactions for ${acc.account_id}:`, err);
      }
    }

    return {
      accounts,
      transactions,
      fetchedAt: new Date().toISOString(),
      daysOfHistory: 90,
    };
  }

  private mapAccountType(type: string): 'checking' | 'savings' | 'credit' | 'other' {
    switch (type?.toUpperCase()) {
      case 'TRANSACTION':
      case 'CHECKING':
        return 'checking';
      case 'SAVINGS':
        return 'savings';
      case 'CREDIT_CARD':
      case 'CREDIT':
        return 'credit';
      default:
        return 'other';
    }
  }

  private mapCategory(
    trueLayerCategory: string | undefined,
    description: string,
    amount: number
  ): TransactionCategory {
    const desc = description.toLowerCase();

    if (amount > 0) {
      if (desc.includes('salary') || desc.includes('wage') || desc.includes('payroll')) {
        return 'income_salary';
      }
      if (desc.includes('benefit') || desc.includes('dwp') || desc.includes('universal credit')) {
        return 'income_benefits';
      }
      return 'income_other';
    }

    if (desc.includes('rent') || desc.includes('landlord')) return 'housing_rent';
    if (desc.includes('mortgage')) return 'housing_mortgage';
    if (desc.includes('electric') || desc.includes('gas') || desc.includes('water') || desc.includes('energy')) {
      return 'utilities';
    }
    if (desc.includes('tesco') || desc.includes('sainsbury') || desc.includes('asda') || desc.includes('aldi')) {
      return 'groceries';
    }
    if (desc.includes('train') || desc.includes('bus') || desc.includes('uber') || desc.includes('petrol')) {
      return 'transport';
    }
    if (desc.includes('loan') || desc.includes('repayment') || desc.includes('credit card')) {
      return 'debt_repayment';
    }
    if (desc.includes('transfer')) return 'transfer';

    return 'other';
  }
}

export const trueLayerProvider = new TrueLayerProvider();
