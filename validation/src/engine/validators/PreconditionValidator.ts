// Validates preconditions: email verified, no active advance, account age, etc.

import type { ValidationRequest, ValidatorResult, RequiredAction } from '../../types/index.js';
import { ValidationConfig } from '../../config/validation.config.js';

export class PreconditionValidator {
  validate(request: ValidationRequest): ValidatorResult {
    const reasons: string[] = [];
    const requiredActions: RequiredAction[] = [];

    // Check email verified
    if (ValidationConfig.user.requireEmailVerified && !request.user.emailVerified) {
      reasons.push('email_not_verified');
      requiredActions.push({
        type: 'VERIFY_EMAIL',
        description: 'Please verify your email address to continue',
      });
    }

    // Check no active advance
    if (request.user.hasActiveAdvance) {
      reasons.push('active_advance_exists');
      // No action - they need to repay existing first
    }

    // Check account age
    if (request.user.accountAgeDays < ValidationConfig.user.minAccountAgeDays) {
      reasons.push('account_too_new');
      // No action - just need to wait
    }

    // Check amount limits
    if (request.amount < ValidationConfig.limits.minAmount) {
      reasons.push('amount_below_minimum');
    }
    if (request.amount > ValidationConfig.limits.maxAmount) {
      reasons.push('amount_above_maximum');
    }

    // Check term limits
    if (request.termMonths < ValidationConfig.limits.minTermMonths) {
      reasons.push('term_below_minimum');
    }
    if (request.termMonths > ValidationConfig.limits.maxTermMonths) {
      reasons.push('term_above_maximum');
    }

    // Check IDV status
    if (ValidationConfig.user.requireIdvVerified && request.evidence.idvStatus !== 'verified') {
      reasons.push('idv_not_verified');
      requiredActions.push({
        type: 'COMPLETE_IDV',
        description: 'Please complete identity verification',
      });
    }

    const passed = reasons.length === 0;

    return {
      passed,
      decision: passed ? 'PASS' : 'NEEDS_ACTION',
      reasons: passed ? ['all_preconditions_met'] : reasons,
      requiredActions: passed ? undefined : requiredActions,
    };
  }
}
