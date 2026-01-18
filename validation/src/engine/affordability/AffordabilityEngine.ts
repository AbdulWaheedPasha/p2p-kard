// Calculates affordability based on income, expenses, and proposed repayment

import type {
  ValidationRequest,
  AffordabilityResult,
  AffordabilityFlag,
  BankData,
  Transaction,
} from '../../types/index.js';
import { ValidationConfig } from '../../config/validation.config.js';

export class AffordabilityEngine {
  /**
   * Assess whether the user can afford the requested advance
   * If bank data is not available, uses conservative estimates
   */
  assess(request: ValidationRequest, bankData?: BankData): AffordabilityResult {
    if (!bankData) {
      // No bank data - use mock/conservative assessment
      return this.mockAssessment(request);
    }

    // Calculate income and outgoings from transactions
    const monthlyNetIncome = this.calculateMonthlyNetIncome(bankData.transactions);
    const essentialOutgoings = this.calculateEssentialOutgoings(bankData.transactions);
    const disposableIncome = monthlyNetIncome - essentialOutgoings;
    const existingDebtPayments = this.calculateDebtPayments(bankData.transactions);

    // Calculate volatility
    const volatilityScore = this.calculateVolatility(bankData.transactions);

    // Count negative balance days
    const negativeDaysCount = this.countNegativeBalanceDays(bankData.transactions);

    // Calculate proposed repayment
    const proposedRepayment = Math.round(request.amount / request.termMonths);
    const repaymentToIncomeRatio = disposableIncome > 0 ? proposedRepayment / disposableIncome : 1;
    const bufferAfterRepayment = disposableIncome - proposedRepayment;

    // Determine flags
    const flags: AffordabilityFlag[] = [];

    if (volatilityScore > ValidationConfig.affordability.volatilityThresholds.medium) {
      flags.push('HIGH_VOLATILITY');
    }
    if (negativeDaysCount > ValidationConfig.affordability.maxNegativeDays) {
      flags.push('FREQUENT_OVERDRAFT');
    }
    if (bufferAfterRepayment < ValidationConfig.affordability.minBufferAmount) {
      flags.push('LOW_BUFFER');
    }
    if (existingDebtPayments > disposableIncome * 0.3) {
      flags.push('HIGH_DEBT_RATIO');
    }
    if (bankData.daysOfHistory < ValidationConfig.affordability.incomeMonthsRequired * 30) {
      flags.push('INSUFFICIENT_HISTORY');
    }

    // Calculate adjusted max ratio based on volatility
    const volatilityPenalty = volatilityScore * ValidationConfig.affordability.volatilityPenaltyRate;
    const adjustedMaxRatio = ValidationConfig.affordability.maxRepaymentRatio * (1 - volatilityPenalty);

    // Check if meets affordability
    const meetsAffordability =
      repaymentToIncomeRatio <= adjustedMaxRatio &&
      bufferAfterRepayment >= ValidationConfig.affordability.minBufferAmount;

    // Calculate max affordable amount
    const maxMonthlyRepayment = Math.min(
      disposableIncome * adjustedMaxRatio,
      disposableIncome - ValidationConfig.affordability.minBufferAmount
    );
    const maxAffordableAmount = Math.max(0, Math.round(maxMonthlyRepayment * request.termMonths));

    // Suggest longer term if needed
    let suggestedTermMonths: number | undefined;
    if (!meetsAffordability && maxAffordableAmount < request.amount) {
      // Try to find a term that works
      for (let term = request.termMonths + 1; term <= ValidationConfig.limits.maxTermMonths; term++) {
        const monthlyAtTerm = request.amount / term;
        if (monthlyAtTerm / disposableIncome <= adjustedMaxRatio &&
            disposableIncome - monthlyAtTerm >= ValidationConfig.affordability.minBufferAmount) {
          suggestedTermMonths = term;
          break;
        }
      }
    }

    return {
      monthlyNetIncome,
      essentialOutgoings,
      disposableIncome,
      volatilityScore,
      negativeDaysCount,
      existingDebtPayments,
      proposedRepayment,
      repaymentToIncomeRatio,
      bufferAfterRepayment,
      meetsAffordability,
      maxAffordableAmount,
      suggestedTermMonths,
      flags,
    };
  }

  /**
   * Mock assessment when no bank data available
   * Uses conservative estimates based on request amount
   */
  private mockAssessment(request: ValidationRequest): AffordabilityResult {
    // Assume average income and calculate if affordable
    const assumedMonthlyIncome = 250000; // £2,500
    const assumedOutgoings = 150000;     // £1,500
    const disposableIncome = assumedMonthlyIncome - assumedOutgoings;

    const proposedRepayment = Math.round(request.amount / request.termMonths);
    const repaymentToIncomeRatio = proposedRepayment / disposableIncome;
    const bufferAfterRepayment = disposableIncome - proposedRepayment;

    const meetsAffordability =
      repaymentToIncomeRatio <= ValidationConfig.affordability.maxRepaymentRatio &&
      bufferAfterRepayment >= ValidationConfig.affordability.minBufferAmount;

    const maxMonthlyRepayment = disposableIncome * ValidationConfig.affordability.maxRepaymentRatio;
    const maxAffordableAmount = Math.round(maxMonthlyRepayment * request.termMonths);

    return {
      monthlyNetIncome: assumedMonthlyIncome,
      essentialOutgoings: assumedOutgoings,
      disposableIncome,
      volatilityScore: 0,
      negativeDaysCount: 0,
      existingDebtPayments: 0,
      proposedRepayment,
      repaymentToIncomeRatio,
      bufferAfterRepayment,
      meetsAffordability,
      maxAffordableAmount,
      flags: [],
    };
  }

  private calculateMonthlyNetIncome(transactions: Transaction[]): number {
    // Filter income transactions (positive amounts with income categories)
    const incomeTransactions = transactions.filter(
      t => t.amount > 0 && (
        t.category?.startsWith('income_') ||
        t.description.toLowerCase().includes('salary') ||
        t.description.toLowerCase().includes('wage')
      )
    );

    // Get last 2-3 months of income
    const monthlyIncomes = this.groupByMonth(incomeTransactions);
    const incomeValues = Object.values(monthlyIncomes);

    if (incomeValues.length === 0) return 0;

    // Return median monthly income
    incomeValues.sort((a, b) => a - b);
    const mid = Math.floor(incomeValues.length / 2);
    return incomeValues.length % 2 === 0
      ? Math.round((incomeValues[mid - 1] + incomeValues[mid]) / 2)
      : incomeValues[mid];
  }

  private calculateEssentialOutgoings(transactions: Transaction[]): number {
    const essentialCategories = ['housing_rent', 'housing_mortgage', 'utilities', 'groceries'];

    const essentialTransactions = transactions.filter(
      t => t.amount < 0 && essentialCategories.includes(t.category || '')
    );

    const monthlyEssentials = this.groupByMonth(essentialTransactions);
    const values = Object.values(monthlyEssentials).map(v => Math.abs(v));

    if (values.length === 0) return 0;

    // Return average monthly essentials
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculateDebtPayments(transactions: Transaction[]): number {
    const debtTransactions = transactions.filter(
      t => t.amount < 0 && t.category === 'debt_repayment'
    );

    const monthlyDebt = this.groupByMonth(debtTransactions);
    const values = Object.values(monthlyDebt).map(v => Math.abs(v));

    if (values.length === 0) return 0;

    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculateVolatility(transactions: Transaction[]): number {
    const incomeTransactions = transactions.filter(t => t.amount > 0);
    const monthlyIncomes = Object.values(this.groupByMonth(incomeTransactions));

    if (monthlyIncomes.length < 2) return 0;

    // Calculate coefficient of variation
    const mean = monthlyIncomes.reduce((a, b) => a + b, 0) / monthlyIncomes.length;
    if (mean === 0) return 1;

    const variance = monthlyIncomes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / monthlyIncomes.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean; // CV
  }

  private countNegativeBalanceDays(transactions: Transaction[]): number {
    // This is a simplified check - in reality would need account balance data
    // For now, count days with more outgoing than incoming
    const dailyNet = new Map<string, number>();

    for (const t of transactions) {
      const date = t.date.substring(0, 10);
      dailyNet.set(date, (dailyNet.get(date) || 0) + t.amount);
    }

    return Array.from(dailyNet.values()).filter(net => net < 0).length;
  }

  private groupByMonth(transactions: Transaction[]): Record<string, number> {
    const monthly: Record<string, number> = {};

    for (const t of transactions) {
      const month = t.date.substring(0, 7); // YYYY-MM
      monthly[month] = (monthly[month] || 0) + t.amount;
    }

    return monthly;
  }
}
