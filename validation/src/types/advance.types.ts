// Core domain types for Advance requests

export type Currency = 'GBP' | 'EUR' | 'USD';

export type PurposeCategory =
  | 'rent'
  | 'medical'
  | 'education'
  | 'utilities'
  | 'emergency'
  | 'other';

export type PayoutMethod =
  | 'bank_transfer'
  | 'card'
  | 'wallet'
  | 'pay_to_provider';

export type AdvanceStatus =
  | 'Draft'
  | 'Submitted'
  | 'UnderReview'
  | 'NeedsAction'
  | 'ManualReview'
  | 'Approved'
  | 'Rejected'
  | 'SeekingFunding'
  | 'Funded'
  | 'Repaying'
  | 'Repaid'
  | 'Closed'
  | 'Defaulted';

export type FundingStatus =
  | 'seeking'
  | 'partially_funded'
  | 'fully_funded'
  | 'disbursed';

export type BankLinkStatus =
  | 'not_linked'
  | 'pending'
  | 'connected'
  | 'expired'
  | 'revoked';

export type IdvStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed';

export type DocumentType =
  | 'payslip'
  | 'bank_statement'
  | 'utility_bill'
  | 'medical_bill'
  | 'tenancy_agreement'
  | 'other';

// Document evidence
export interface Document {
  type: DocumentType;
  uploadedAt: string; // ISO date string
}

// Evidence collected for validation
export interface Evidence {
  documents: Document[];
  bankLinkStatus: BankLinkStatus;
  bankLinkToken?: string; // Plaid/TrueLayer access token
  idvStatus: IdvStatus;
}

// User context for validation
export interface UserContext {
  emailVerified: boolean;
  hasActiveAdvance: boolean;
  accountAgeDays: number;
}

// The request payload Django sends to validation service
export interface ValidationRequest {
  advanceId: string;
  userId: string;
  amount: number;        // In minor units (pence/cents)
  currency: Currency;
  termMonths: number;
  purposeCategory: PurposeCategory;
  purposeNote?: string;
  payoutMethod: PayoutMethod;
  user: UserContext;
  evidence: Evidence;
}

// Risk assessment result
export interface RiskAssessment {
  score: number;         // 0-100, lower is better
  reasons: string[];     // Risk factor codes
  modelVersion: string;
}
