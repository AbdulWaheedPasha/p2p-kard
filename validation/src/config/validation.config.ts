// Validation configuration - all thresholds and limits in one place
// Amounts are in minor units (pence/cents)

export const ValidationConfig = {
  // Model versioning for audit trail
  modelVersion: '1.0.0',

  // ============================================
  // Advance Limits
  // ============================================
  limits: {
    minAmount: 5000,          // £50 minimum
    maxAmount: 500000,        // £5,000 maximum
    minTermMonths: 1,
    maxTermMonths: 24,
  },

  // ============================================
  // Evidence Requirements by Amount Tier
  // ============================================
  evidenceTiers: {
    // Tier 1: Small amounts
    tier1: {
      maxAmount: 20000,       // Up to £200
      documentsRequired: 1,   // Minimum 1 doc for all tiers
      requireStableIncome: true,
      requireCleanHistory: true,
      allowPayToProvider: false,  // Disabled for now
      requirePayToProvider: false,
      requireManualReview: false,
    },
    // Tier 2: Medium amounts
    tier2: {
      maxAmount: 100000,      // £200 - £1,000
      documentsRequired: 1,   // Minimum 1 doc
      requireStableIncome: true,
      requireCleanHistory: true,
      allowPayToProvider: false,  // Disabled for now
      requirePayToProvider: false,
      requireManualReview: false,
    },
    // Tier 3: Large amounts - always manual review
    tier3: {
      maxAmount: Infinity,    // Above £1,000
      documentsRequired: 1,   // Minimum 1 doc
      requireStableIncome: true,
      requireCleanHistory: true,
      allowPayToProvider: false,  // Disabled for now
      requirePayToProvider: false,
      requireManualReview: true,  // Always manual review for large amounts
    },
  },

  // ============================================
  // Affordability Thresholds
  // ============================================
  affordability: {
    // Max percentage of disposable income for repayment
    maxRepaymentRatio: 0.30,        // 30%

    // Minimum buffer remaining after repayment
    minBufferAmount: 20000,         // £200

    // How much to reduce max ratio per volatility tier
    volatilityPenaltyRate: 0.15,    // 15% reduction per tier

    // Months of bank history required
    incomeMonthsRequired: 2,

    // Max days with negative balance allowed
    maxNegativeDays: 5,

    // Income volatility thresholds (coefficient of variation)
    volatilityThresholds: {
      low: 0.15,      // < 15% = stable
      medium: 0.30,   // 15-30% = moderate
      high: 0.50,     // > 30% = volatile
    },
  },

  // ============================================
  // User Account Requirements
  // ============================================
  user: {
    minAccountAgeDays: 7,           // Account must be at least 7 days old
    requireEmailVerified: true,
    requireIdvVerified: true,
    requireBankLinked: true,
  },

  // ============================================
  // Risk Scoring
  // ============================================
  risk: {
    // Score thresholds (0-100, lower is better)
    thresholds: {
      autoApprove: 30,      // Score <= 30: auto-approve
      manualReview: 60,     // Score 31-60: manual review
      autoDecline: 100,     // Score > 60: auto-decline
    },

    // Points added for various risk factors
    factors: {
      shortAccountAge: 10,       // Account < 30 days
      noDocuments: 15,           // No supporting docs uploaded
      highVolatility: 20,        // Income volatility > medium
      frequentOverdraft: 25,     // > 5 negative days in period
      lowBuffer: 15,             // Buffer close to minimum
      largeAmount: 10,           // Amount > £1000
      shortTerm: 5,              // Term < 3 months
    },
  },
} as const;

// Type for the config
export type ValidationConfigType = typeof ValidationConfig;
