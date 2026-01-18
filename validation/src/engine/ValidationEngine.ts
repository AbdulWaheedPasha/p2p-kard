// Main orchestrator - runs all validators and returns final decision

import type {
  ValidationRequest,
  ValidationResult,
  AuditEntry,
  Decision,
  RiskAssessment,
  IOpenBankingProvider,
} from '../types/index.js';
import { ValidationConfig } from '../config/validation.config.js';
import { PreconditionValidator } from './validators/PreconditionValidator.js';
import { EvidenceValidator } from './validators/EvidenceValidator.js';
import { AffordabilityEngine } from './affordability/AffordabilityEngine.js';

interface ValidationEngineOptions {
  openBankingProvider?: IOpenBankingProvider;
}

export class ValidationEngine {
  private preconditionValidator: PreconditionValidator;
  private evidenceValidator: EvidenceValidator;
  private affordabilityEngine: AffordabilityEngine;
  private openBankingProvider?: IOpenBankingProvider;

  constructor(options: ValidationEngineOptions = {}) {
    this.preconditionValidator = new PreconditionValidator();
    this.evidenceValidator = new EvidenceValidator();
    this.affordabilityEngine = new AffordabilityEngine();
    this.openBankingProvider = options.openBankingProvider;
  }

  async validate(request: ValidationRequest): Promise<ValidationResult> {
    const auditEntries: AuditEntry[] = [];
    let riskScore = 0;
    const riskReasons: string[] = [];

    // ============================================
    // Stage 1: Preconditions
    // ============================================
    const preconditionResult = this.preconditionValidator.validate(request);
    auditEntries.push(this.createAuditEntry('preconditions', 'PreconditionValidator', preconditionResult.decision, preconditionResult.reasons));

    if (!preconditionResult.passed) {
      return this.buildResult('NEEDS_ACTION', 'NeedsAction', auditEntries, riskScore, riskReasons, preconditionResult.requiredActions);
    }

    // ============================================
    // Stage 2: Evidence Requirements
    // ============================================
    const evidenceResult = this.evidenceValidator.validate(request);
    auditEntries.push(this.createAuditEntry('evidence', 'EvidenceValidator', evidenceResult.decision, evidenceResult.reasons, evidenceResult.data));

    if (!evidenceResult.passed) {
      if (evidenceResult.decision === 'MANUAL_REVIEW') {
        return this.buildResult('MANUAL_REVIEW', 'ManualReview', auditEntries, riskScore, riskReasons);
      }
      return this.buildResult('NEEDS_ACTION', 'NeedsAction', auditEntries, riskScore, riskReasons, evidenceResult.requiredActions);
    }

    // Add risk for evidence tier
    if (request.amount >= ValidationConfig.evidenceTiers.tier3.maxAmount) {
      riskScore += ValidationConfig.risk.factors.largeAmount;
      riskReasons.push('large_amount');
    }

    // ============================================
    // Stage 3: Affordability (if bank linked)
    // ============================================
    let affordabilityResult = undefined;

    if (request.evidence.bankLinkStatus === 'connected' && request.evidence.bankLinkToken) {
      try {
        // Fetch bank data if provider available
        let bankData = undefined;
        if (this.openBankingProvider) {
          bankData = await this.openBankingProvider.fetchBankData(request.evidence.bankLinkToken);
        }

        affordabilityResult = this.affordabilityEngine.assess(request, bankData);
        auditEntries.push(this.createAuditEntry('affordability', 'AffordabilityEngine',
          affordabilityResult.meetsAffordability ? 'PASS' : 'COUNTER_OFFER',
          affordabilityResult.flags,
          {
            disposableIncome: affordabilityResult.disposableIncome,
            proposedRepayment: affordabilityResult.proposedRepayment,
            ratio: affordabilityResult.repaymentToIncomeRatio
          }
        ));

        // Add risk factors from affordability
        if (affordabilityResult.flags.includes('HIGH_VOLATILITY')) {
          riskScore += ValidationConfig.risk.factors.highVolatility;
          riskReasons.push('income_volatility');
        }
        if (affordabilityResult.flags.includes('FREQUENT_OVERDRAFT')) {
          riskScore += ValidationConfig.risk.factors.frequentOverdraft;
          riskReasons.push('overdraft_usage');
        }
        if (affordabilityResult.flags.includes('LOW_BUFFER')) {
          riskScore += ValidationConfig.risk.factors.lowBuffer;
          riskReasons.push('low_buffer');
        }

        // If doesn't meet affordability, return counter-offer
        if (!affordabilityResult.meetsAffordability) {
          return this.buildResult('COUNTER_OFFER', 'NeedsAction', auditEntries, riskScore, riskReasons, [], {
            suggestedAmount: affordabilityResult.maxAffordableAmount,
            suggestedTermMonths: affordabilityResult.suggestedTermMonths || request.termMonths,
            reason: 'Based on your income and expenses, we can offer a lower amount that fits your budget.',
          }, affordabilityResult);
        }
      } catch (error) {
        // Bank data fetch failed - log and continue with manual review
        auditEntries.push(this.createAuditEntry('affordability', 'AffordabilityEngine', 'MANUAL_REVIEW',
          ['bank_data_fetch_failed'], { error: String(error) }));
        return this.buildResult('MANUAL_REVIEW', 'ManualReview', auditEntries, riskScore, riskReasons);
      }
    } else {
      // No bank link - can't assess affordability automatically
      auditEntries.push(this.createAuditEntry('affordability', 'AffordabilityEngine', 'NEEDS_ACTION', ['bank_not_linked']));
      return this.buildResult('NEEDS_ACTION', 'NeedsAction', auditEntries, riskScore, riskReasons, [
        { type: 'LINK_BANK_ACCOUNT', description: 'Please link your bank account to verify income' }
      ]);
    }

    // ============================================
    // Stage 4: Risk Assessment & Final Decision
    // ============================================

    // Determine final decision based on risk score
    let finalDecision: Decision;
    let newStatus: ValidationResult['newStatus'];

    if (riskScore <= ValidationConfig.risk.thresholds.autoApprove) {
      finalDecision = 'PASS';
      newStatus = 'Approved';
    } else if (riskScore <= ValidationConfig.risk.thresholds.manualReview) {
      finalDecision = 'MANUAL_REVIEW';
      newStatus = 'ManualReview';
    } else {
      finalDecision = 'DECLINE';
      newStatus = 'Rejected';
    }

    auditEntries.push(this.createAuditEntry('final_decision', 'ValidationEngine', finalDecision,
      [`risk_score_${riskScore}`], { riskScore, riskReasons }));

    return this.buildResult(finalDecision, newStatus, auditEntries, riskScore, riskReasons, [], undefined, affordabilityResult);
  }

  private createAuditEntry(
    stage: string,
    validator: string,
    decision: Decision,
    reasons: string[],
    data?: Record<string, unknown>
  ): AuditEntry {
    return {
      timestamp: new Date().toISOString(),
      stage,
      validator,
      decision,
      reasons,
      data,
    };
  }

  private buildResult(
    decision: Decision,
    newStatus: ValidationResult['newStatus'],
    auditEntries: AuditEntry[],
    riskScore: number,
    riskReasons: string[],
    requiredActions: ValidationResult['requiredActions'] = [],
    counterOffer?: ValidationResult['counterOffer'],
    affordability?: ValidationResult['affordability']
  ): ValidationResult {
    return {
      decision,
      newStatus,
      requiredActions,
      counterOffer,
      affordability,
      risk: {
        score: riskScore,
        reasons: riskReasons,
        modelVersion: ValidationConfig.modelVersion,
      },
      auditEntries,
    };
  }
}
