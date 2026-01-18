// TrueLayer Open Banking Provider
// Fetches accounts and transactions from TrueLayer API

import type {
  IOpenBankingProvider,
  BankData,
  BankAccount,
  Transaction,
  TransactionCategory,
} from '../../types/index.js';

const TRUELAYER_API_BASE = 'https://api.truelayer-sandbox.com';

export class TrueLayerAdapter implements IOpenBankingProvider {
  /**
   * Fetch bank accounts and transactions using access token
   */
  async fetchBankData(accessToken: string): Promise<BankData> {
    const accounts = await this.fetchAccounts(accessToken);
    const transactions = await this.fetchTransactions(accessToken, accounts);

    return {
      accounts,
      transactions,
      fetchedAt: new Date().toISOString(),
      daysOfHistory: 90, // TrueLayer typically provides ~90 days
    };
  }

  /**
   * Fetch all bank accounts
   */
  private async fetchAccounts(accessToken: string): Promise<BankAccount[]> {
    const response = await fetch(`${TRUELAYER_API_BASE}/data/v1/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch accounts: ${response.status} - ${error}`);
    }

    const data = await response.json() as { results: any[] };

    return data.results.map((acc: any) => ({
      accountId: acc.account_id,
      name: acc.display_name || acc.account_id,
      type: this.mapAccountType(acc.account_type),
      currency: acc.currency,
      balance: 0, // Will be fetched separately
      availableBalance: 0,
    }));
  }

  /**
   * Fetch transactions for all accounts
   */
  private async fetchTransactions(
    accessToken: string,
    accounts: BankAccount[]
  ): Promise<Transaction[]> {
    const allTransactions: Transaction[] = [];

    // Fetch balances and transactions for each account
    for (const account of accounts) {
      try {
        // Fetch balance
        const balanceResponse = await fetch(
          `${TRUELAYER_API_BASE}/data/v1/accounts/${account.accountId}/balance`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json() as { results?: { current: number; available?: number }[] };
          if (balanceData.results?.[0]) {
            account.balance = Math.round(balanceData.results[0].current * 100); // Convert to pence
            account.availableBalance = Math.round(
              (balanceData.results[0].available || balanceData.results[0].current) * 100
            );
          }
        }

        // Fetch transactions
        const txResponse = await fetch(
          `${TRUELAYER_API_BASE}/data/v1/accounts/${account.accountId}/transactions`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (txResponse.ok) {
          const txData = await txResponse.json() as { results?: any[] };

          for (const tx of txData.results || []) {
            allTransactions.push({
              transactionId: tx.transaction_id,
              accountId: account.accountId,
              amount: Math.round(tx.amount * 100), // Convert to pence (negative = outgoing)
              currency: tx.currency,
              date: tx.timestamp,
              description: tx.description || '',
              category: this.mapCategory(tx.transaction_category, tx.description, tx.amount),
              merchantName: tx.merchant_name,
              pending: tx.transaction_type === 'PENDING',
            });
          }
        }
      } catch (err) {
        console.error(`[TrueLayer] Error fetching data for account ${account.accountId}:`, err);
      }
    }

    return allTransactions;
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

    // Check for income (positive amounts)
    if (amount > 0) {
      if (desc.includes('salary') || desc.includes('wage') || desc.includes('payroll')) {
        return 'income_salary';
      }
      if (desc.includes('benefit') || desc.includes('dwp') || desc.includes('universal credit')) {
        return 'income_benefits';
      }
      return 'income_other';
    }

    // Check for common expense categories
    if (desc.includes('rent') || desc.includes('landlord')) {
      return 'housing_rent';
    }
    if (desc.includes('mortgage')) {
      return 'housing_mortgage';
    }
    if (
      desc.includes('electric') ||
      desc.includes('gas') ||
      desc.includes('water') ||
      desc.includes('utility') ||
      desc.includes('energy')
    ) {
      return 'utilities';
    }
    if (
      desc.includes('tesco') ||
      desc.includes('sainsbury') ||
      desc.includes('asda') ||
      desc.includes('morrisons') ||
      desc.includes('aldi') ||
      desc.includes('lidl') ||
      desc.includes('groceries')
    ) {
      return 'groceries';
    }
    if (
      desc.includes('train') ||
      desc.includes('bus') ||
      desc.includes('tube') ||
      desc.includes('uber') ||
      desc.includes('petrol') ||
      desc.includes('fuel')
    ) {
      return 'transport';
    }
    if (desc.includes('loan') || desc.includes('repayment') || desc.includes('credit card')) {
      return 'debt_repayment';
    }
    if (desc.includes('transfer') || desc.includes('tfr')) {
      return 'transfer';
    }

    // Map TrueLayer categories
    switch (trueLayerCategory?.toUpperCase()) {
      case 'INCOME':
        return 'income_other';
      case 'BILLS_AND_SERVICES':
        return 'utilities';
      case 'EATING_OUT':
      case 'ENTERTAINMENT':
        return 'entertainment';
      case 'GROCERIES':
        return 'groceries';
      case 'SHOPPING':
        return 'shopping';
      case 'TRANSPORT':
        return 'transport';
      case 'HEALTH':
        return 'healthcare';
      default:
        return 'other';
    }
  }
}
