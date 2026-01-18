// Validation engine output types

import type { AdvanceStatus } from './advance.types.js';

// Decision outcomes
export type Decision =
  | 'PASS'           // All checks passed, proceed
  | 'NEEDS_ACTION'   // User must complete something
  | 'MANUAL_REVIEW'  // Requires human review
  | 'COUNTER_OFFER'  // Approved with modified terms
  | 'DECLINE';       // Rejected

// Types of actions user may need to take
export type ActionType =
  | 'VERIFY_EMAIL'
  | 'LINK_BANK_ACCOUNT'
  | 'COMPLETE_IDV'
  | 'UPLOAD_DOCUMENT'
  | 'WAIT_FOR_REVIEW';

// Required action for user
export interface RequiredAction {
  type: ActionType;
  description: string;
  deadline?: string; // ISO date string
}

// Counter-offer when full amount not affordable
export interface CounterOffer {
  suggestedAmount: number;      // In minor units
  suggestedTermMonths: number;
  reason: string;
}

// Audit trail entry - immutable record of each decision
export interface AuditEntry {
  timestamp: string;            // ISO date string
  stage: string;                // Which validation stage
  validator: string;            // Which validator made decision
  decision: Decision;
  reasons: string[];            // Why this decision
  data?: Record<string, unknown>; // Supporting data
}

// Affordability calculation result
export interface AffordabilityResult {
  // Computed from bank data
  monthlyNetIncome: number;
  essentialOutgoings: number;
  disposableIncome: number;
  volatilityScore: number;      // 0-1, higher = more volatile
  negativeDaysCount: number;    // Days overdrawn
  existingDebtPayments: number;

  // Proposed repayment analysis
  proposedRepayment: number;
  repaymentToIncomeRatio: number;
  bufferAfterRepayment: number;

  // Decision
  meetsAffordability: boolean;
  maxAffordableAmount: number;
  suggestedTermMonths?: number;
  flags: AffordabilityFlag[];
}

export type AffordabilityFlag =
  | 'HIGH_VOLATILITY'
  | 'FREQUENT_OVERDRAFT'
  | 'LOW_BUFFER'
  | 'HIGH_DEBT_RATIO'
  | 'INSUFFICIENT_HISTORY';

// Risk assessment
export interface RiskAssessment {
  score: number;
  reasons: string[];
  modelVersion: string;
}

// Final validation result returned to Django
export interface ValidationResult {
  decision: Decision;
  newStatus: AdvanceStatus;
  requiredActions: RequiredAction[];
  counterOffer?: CounterOffer;
  affordability?: AffordabilityResult;
  risk: RiskAssessment;
  auditEntries: AuditEntry[];
}

// Individual validator result (internal use)
export interface ValidatorResult {
  passed: boolean;
  decision: Decision;
  reasons: string[];
  requiredActions?: RequiredAction[];
  data?: Record<string, unknown>;
}
