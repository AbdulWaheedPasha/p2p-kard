// External provider types (Open Banking, IDV, Sanctions)

// ============================================
// Open Banking Types (Plaid/TrueLayer agnostic)
// ============================================

export interface BankAccount {
  accountId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'other';
  currency: string;
  balance: number;          // Current balance in minor units
  availableBalance?: number;
}

export interface Transaction {
  transactionId: string;
  accountId: string;
  amount: number;           // Negative = outgoing, Positive = incoming
  currency: string;
  date: string;             // ISO date
  description: string;
  category?: TransactionCategory;
  merchantName?: string;
  pending: boolean;
}

export type TransactionCategory =
  | 'income_salary'
  | 'income_benefits'
  | 'income_other'
  | 'housing_rent'
  | 'housing_mortgage'
  | 'utilities'
  | 'groceries'
  | 'transport'
  | 'healthcare'
  | 'debt_repayment'
  | 'entertainment'
  | 'shopping'
  | 'transfer'
  | 'other';

export interface BankData {
  accounts: BankAccount[];
  transactions: Transaction[];
  fetchedAt: string;        // When data was retrieved
  daysOfHistory: number;    // How many days of transactions
}

// ============================================
// IDV Types (Onfido/Sumsub agnostic)
// ============================================

export interface IdvResult {
  status: 'verified' | 'failed' | 'pending';
  checkId: string;
  fullName?: string;
  dateOfBirth?: string;
  address?: string;
  documentType?: 'passport' | 'driving_license' | 'national_id';
  documentCountry?: string;
  completedAt?: string;
  failureReasons?: string[];
}

// ============================================
// Sanctions/PEP Types
// ============================================

export interface SanctionsResult {
  clear: boolean;           // true = not on any list
  isPep: boolean;           // Politically Exposed Person
  matches: SanctionsMatch[];
  checkedAt: string;
}

export interface SanctionsMatch {
  listName: string;         // e.g., 'OFAC', 'EU Sanctions', 'UN'
  matchScore: number;       // 0-100 confidence
  matchedName: string;
  matchType: 'exact' | 'partial' | 'fuzzy';
}

// ============================================
// Provider Interfaces
// ============================================

export interface IOpenBankingProvider {
  fetchBankData(accessToken: string): Promise<BankData>;
}

export interface IIdvProvider {
  getVerificationResult(userId: string): Promise<IdvResult>;
}

export interface ISanctionsProvider {
  checkSanctions(fullName: string, dateOfBirth?: string): Promise<SanctionsResult>;
}
