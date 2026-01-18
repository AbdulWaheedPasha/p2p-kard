// Validates evidence requirements based on amount tier

import type { ValidationRequest, ValidatorResult, RequiredAction } from '../../types/index.js';
import { ValidationConfig } from '../../config/validation.config.js';

interface EvidenceTier {
  maxAmount: number;
  documentsRequired: number;
  requireStableIncome: boolean;
  requireCleanHistory: boolean;
  allowPayToProvider: boolean;
  requirePayToProvider: boolean;
  requireManualReview: boolean;
}

export class EvidenceValidator {
  validate(request: ValidationRequest): ValidatorResult {
    const tier = this.getTierForAmount(request.amount);
    const reasons: string[] = [];
    const requiredActions: RequiredAction[] = [];

    const docCount = request.evidence.documents.length;

    // Check minimum document requirement (1 doc for all tiers)
    if (docCount < tier.documentsRequired) {
      reasons.push(`documents_required_${tier.documentsRequired}`);
      requiredActions.push({
        type: 'UPLOAD_DOCUMENT',
        description: `Please upload at least ${tier.documentsRequired} supporting document(s) such as payslip, bank statement, or utility bill`,
      });
    }

    // Check if manual review required for this tier (large amounts)
    if (tier.requireManualReview && reasons.length === 0) {
      return {
        passed: false,
        decision: 'MANUAL_REVIEW',
        reasons: ['manual_review_required_for_amount'],
        data: {
          tier: this.getTierName(request.amount),
          amount: request.amount,
          documentsProvided: docCount,
          documentsRequired: tier.documentsRequired,
        },
      };
    }

    const passed = reasons.length === 0;

    return {
      passed,
      decision: passed ? 'PASS' : 'NEEDS_ACTION',
      reasons: passed ? ['evidence_requirements_met'] : reasons,
      requiredActions: passed ? undefined : requiredActions,
      data: {
        tier: this.getTierName(request.amount),
        documentsProvided: docCount,
        documentsRequired: tier.documentsRequired,
      },
    };
  }

  private getTierForAmount(amount: number): EvidenceTier {
    const { tier1, tier2, tier3 } = ValidationConfig.evidenceTiers;

    if (amount <= tier1.maxAmount) {
      return tier1;
    } else if (amount <= tier2.maxAmount) {
      return tier2;
    } else {
      return tier3;
    }
  }

  private getTierName(amount: number): string {
    const { tier1, tier2 } = ValidationConfig.evidenceTiers;

    if (amount <= tier1.maxAmount) {
      return 'tier1_small';
    } else if (amount <= tier2.maxAmount) {
      return 'tier2_medium';
    } else {
      return 'tier3_large';
    }
  }
}
