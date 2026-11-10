import { Transaction, BorrowerSummary, MonthlySummary, Totals, Product, SettlementRecord } from './types';

/**
 * Validates that an amount is a safe, whole integer without decimal fractions.
 */
export function isSafeIntegerAmount(amount: unknown): amount is number {
  if (typeof amount !== 'number') return false;
  return Number.isSafeInteger(amount) && amount >= 0;
}

/**
 * Core business formula:
 * Balance = Lend - Repay - ProductValue + Refund
 */
export function calculateBalance(params: {
  lent?: number;
  repaid?: number;
  productValue?: number;
  refunded?: number;
}): number {
  const l = Number(params.lent) || 0;
  const r = Number(params.repaid) || 0;
  const p = Number(params.productValue) || 0;
  const ref = Number(params.refunded) || 0;
  return Math.round(l - r - p + ref);
}

/**
 * Calculates overall totals from a list of transactions (and optional products) using exact integer arithmetic.
 */
export function calculateTotals(transactions: Transaction[], products: Product[] = []): Totals {
  let totalLent = 0;
  let totalRepaid = 0;
  let totalRefunded = 0;

  for (const t of transactions) {
    if (!Number.isSafeInteger(t.amount) || t.amount < 0) {
      continue;
    }
    if (t.type === 'Lend') {
      totalLent += t.amount;
    } else if (t.type === 'Repay') {
      totalRepaid += t.amount;
    } else if (t.type === 'Refund') {
      totalRefunded += t.amount;
    }
  }

  let totalProducts = 0;
  for (const p of products) {
    const itemTotal = p.total != null ? p.total : Math.round((p.quantity || 0) * (p.unitPrice || 0));
    totalProducts += itemTotal;
  }

  const res: Totals = {
    totalLent,
    totalRepaid,
    netOutstanding: totalLent - totalRepaid,
  };

  if (products.length > 0 || totalRefunded > 0) {
    res.totalRefunded = totalRefunded;
    res.totalProducts = totalProducts;
    res.balance = calculateBalance({
      lent: totalLent,
      repaid: totalRepaid,
      productValue: totalProducts,
      refunded: totalRefunded,
    });
  }

  return res;
}

/**
 * Computes per-borrower balances, tracking borrowed, repaid, products, refunds, and final settlement.
 */
export function calculateBorrowerSummaries(
  transactions: Transaction[],
  products: Product[] = []
): BorrowerSummary[] {
  const map = new Map<
    string,
    { totalBorrowed: number; totalRepaid: number; totalRefunded: number; totalProducts: number; count: number }
  >();

  for (const t of transactions) {
    if (!t.borrower || !Number.isSafeInteger(t.amount) || t.amount < 0) continue;

    const existing = map.get(t.borrower) || {
      totalBorrowed: 0,
      totalRepaid: 0,
      totalRefunded: 0,
      totalProducts: 0,
      count: 0,
    };
    if (t.type === 'Lend') {
      existing.totalBorrowed += t.amount;
    } else if (t.type === 'Repay') {
      existing.totalRepaid += t.amount;
    } else if (t.type === 'Refund') {
      existing.totalRefunded += t.amount;
    }
    existing.count += 1;
    map.set(t.borrower, existing);
  }

  for (const p of products) {
    if (!p.borrower) continue;
    const existing = map.get(p.borrower) || {
      totalBorrowed: 0,
      totalRepaid: 0,
      totalRefunded: 0,
      totalProducts: 0,
      count: 0,
    };
    const itemTotal = p.total != null ? p.total : Math.round((p.quantity || 0) * (p.unitPrice || 0));
    existing.totalProducts += itemTotal;
    map.set(p.borrower, existing);
  }

  const summaries: BorrowerSummary[] = [];
  for (const [borrower, data] of map.entries()) {
    const outstanding = data.totalBorrowed - data.totalRepaid;
    const balance = calculateBalance({
      lent: data.totalBorrowed,
      repaid: data.totalRepaid,
      productValue: data.totalProducts,
      refunded: data.totalRefunded,
    });
    summaries.push({
      borrower,
      totalBorrowed: data.totalBorrowed,
      totalRepaid: data.totalRepaid,
      totalRefunded: data.totalRefunded,
      totalProducts: data.totalProducts,
      outstanding,
      balance,
      settlement: balance,
      status: outstanding === 0 ? 'paid' : 'owing',
      settlementStatus: balance > 0 ? 'borrower_owes' : balance < 0 ? 'dad_owes' : 'cleared',
      transactionCount: data.count,
    });
  }

  return summaries;
}

/**
 * Computes monthly breakdown sorted descending (newest month first).
 */
export function calculateMonthlyTable(
  transactions: Transaction[],
  products: Product[] = [],
  settlements: SettlementRecord[] = [],
  activeBorrower?: string
): MonthlySummary[] {
  const map = new Map<string, { lent: number; repaid: number; products: number; refunded: number }>();
  const targetBorrower = activeBorrower ? activeBorrower.trim().toLowerCase() : null;

  for (const t of transactions) {
    if (!t.date || !Number.isSafeInteger(t.amount) || t.amount < 0) continue;
    if (targetBorrower && t.borrower.trim().toLowerCase() !== targetBorrower) continue;

    const month = t.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const existing = map.get(month) || { lent: 0, repaid: 0, products: 0, refunded: 0 };
    if (t.type === 'Lend') {
      existing.lent += t.amount;
    } else if (t.type === 'Repay') {
      existing.repaid += t.amount;
    } else if (t.type === 'Refund') {
      existing.refunded += t.amount;
    }
    map.set(month, existing);
  }

  for (const p of products) {
    if (!p.date) continue;
    if (targetBorrower && p.borrower.trim().toLowerCase() !== targetBorrower) continue;

    const month = p.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const existing = map.get(month) || { lent: 0, repaid: 0, products: 0, refunded: 0 };
    const itemTotal = p.total != null ? p.total : Math.round((p.quantity || 0) * (p.unitPrice || 0));
    existing.products += itemTotal;
    map.set(month, existing);
  }

  const settledMap = new Map<string, SettlementRecord>();
  for (const s of settlements) {
    if (!targetBorrower || s.borrower.trim().toLowerCase() === targetBorrower) {
      settledMap.set(s.month, s);
    }
  }

  const ascendingMonths = Array.from(map.keys()).sort();
  let cumulative = 0;
  const list: MonthlySummary[] = [];

  for (const month of ascendingMonths) {
    const data = map.get(month)!;
    const net = calculateBalance({
      lent: data.lent,
      repaid: data.repaid,
      productValue: data.products,
      refunded: data.refunded,
    });
    cumulative += net;
    const sRec = settledMap.get(month);

    list.push({
      month,
      lent: data.lent,
      repaid: data.repaid,
      products: data.products,
      refunded: data.refunded,
      netBalance: net,
      runningBalance: cumulative,
      balance: data.lent - data.repaid, // backward compatibility
      isSettled: !!sRec,
      status: sRec ? 'Settled' : 'Open',
      settlementRecord: sRec || null,
    });
  }

  return list.sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Checks if a proposed repayment will exceed the borrower's current net debt.
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
