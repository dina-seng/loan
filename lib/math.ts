import { Transaction, BorrowerSummary, MonthlySummary, Totals } from './types';

/**
 * Validates that an amount is a safe, whole integer without decimal fractions.
 * Throws or returns false if floating-point decimals or unsafe numbers are passed.
 */
export function isSafeIntegerAmount(amount: unknown): amount is number {
  if (typeof amount !== 'number') return false;
  return Number.isSafeInteger(amount) && amount >= 0;
}

/**
 * Calculates overall totals from a list of transactions using exact integer arithmetic.
 * Ensures zero rounding errors even with billions of Riel (e.g. 50,000,000,000 KHR).
 */
export function calculateTotals(transactions: Transaction[]): Totals {
  let totalLent = 0;
  let totalRepaid = 0;

  for (const t of transactions) {
    if (!Number.isSafeInteger(t.amount) || t.amount < 0) {
      continue; // Skip or reject invalid values
    }
    if (t.type === 'Lend') {
      totalLent += t.amount;
    } else if (t.type === 'Repay') {
      totalRepaid += t.amount;
    }
  }

  return {
    totalLent,
    totalRepaid,
    netOutstanding: totalLent - totalRepaid,
  };
}

/**
 * Computes per-borrower balances, tracking borrowed, repaid, and outstanding debts.
 */
export function calculateBorrowerSummaries(transactions: Transaction[]): BorrowerSummary[] {
  const map = new Map<string, { totalBorrowed: number; totalRepaid: number; count: number }>();

  for (const t of transactions) {
    if (!t.borrower || !Number.isSafeInteger(t.amount) || t.amount < 0) continue;

    const existing = map.get(t.borrower) || { totalBorrowed: 0, totalRepaid: 0, count: 0 };
    if (t.type === 'Lend') {
      existing.totalBorrowed += t.amount;
    } else if (t.type === 'Repay') {
      existing.totalRepaid += t.amount;
    }
    existing.count += 1;
    map.set(t.borrower, existing);
  }

  const summaries: BorrowerSummary[] = [];
  for (const [borrower, data] of map.entries()) {
    const outstanding = data.totalBorrowed - data.totalRepaid;
    summaries.push({
      borrower,
      totalBorrowed: data.totalBorrowed,
      totalRepaid: data.totalRepaid,
      outstanding,
      status: outstanding === 0 ? 'paid' : 'owing',
      transactionCount: data.count,
    });
  }

  return summaries;
}

/**
 * Computes monthly breakdown sorted descending (newest month first).
 */
export function calculateMonthlyTable(transactions: Transaction[]): MonthlySummary[] {
  const map = new Map<string, { lent: number; repaid: number }>();

  for (const t of transactions) {
    if (!t.date || !Number.isSafeInteger(t.amount) || t.amount < 0) continue;
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const existing = map.get(month) || { lent: 0, repaid: 0 };
    if (t.type === 'Lend') {
      existing.lent += t.amount;
    } else if (t.type === 'Repay') {
      existing.repaid += t.amount;
    }
    map.set(month, existing);
  }

  return Array.from(map.entries())
    .map(([month, data]) => ({
      month,
      lent: data.lent,
      repaid: data.repaid,
      balance: data.lent - data.repaid,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Checks if a proposed repayment will exceed the borrower's current net debt.
 * If overpayment is detected, returns warning details requiring explicit user confirmation.
 */
export function checkOverpayment(
  borrower: string,
  repaymentAmount: number,
  existingTransactions: Transaction[]
): { isOverpayment: boolean; currentDebt: number; excessAmount: number; warningMessage?: string } {
  const summaries = calculateBorrowerSummaries(existingTransactions);
  const borrowerData = summaries.find(s => s.borrower.toLowerCase() === borrower.trim().toLowerCase());
  const currentDebt = borrowerData ? borrowerData.outstanding : 0;

  if (repaymentAmount > currentDebt) {
    const excess = repaymentAmount - currentDebt;
    return {
      isOverpayment: true,
      currentDebt,
      excessAmount: excess,
      warningMessage: `ការសងចំនួន ${repaymentAmount.toLocaleString('en-US')}៛ លើសពីបំណុលបច្ចុប្បន្ន (${currentDebt.toLocaleString('en-US')}៛) ចំនួន ${excess.toLocaleString('en-US')}៛! តើអ្នកប្រាកដថាចង់បន្ត?`,
    };
  }

  return { isOverpayment: false, currentDebt, excessAmount: 0 };
}
