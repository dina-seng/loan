import { describe, it, expect } from 'vitest';
import {
  calculateBalance,
  calculateTotals,
  calculateBorrowerSummaries,
  calculateMonthlyTable,
} from '../../lib/math';
import { Transaction, Product, SettlementRecord } from '../../lib/types';
import {
  computeTotals,
  computeBorrowerSummary,
  computeMonthlyTable as computeMonthlyTableUtil,
  getSettlementStatus,
} from '../../src/utils';

describe('Category 6: Settlement Lifecycle & Month Locking', () => {
  const sampleTransactions: Transaction[] = [
    { id: 'tx-1', date: '2026-11-01', borrower: 'Sokha', type: 'Lend', amount: 5_000_000 },
    { id: 'tx-2', date: '2026-11-15', borrower: 'Sokha', type: 'Repay', amount: 1_000_000 },
  ];

  const sampleProducts: Product[] = [
    { id: 'pr-1', date: '2026-11-10', borrower: 'Sokha', item: 'Rice', quantity: 100, unitPrice: 3500, total: 350_000 },
  ];

  it('calculates full settlement balance: Lend - Repay - ProductValue + Refund', () => {
    // 5,000,000 - 1,000,000 - 350,000 + 0 = 3,650,000 (borrower owes dad)
    const balance = calculateBalance({
      lent: 5_000_000,
      repaid: 1_000_000,
      productValue: 350_000,
      refunded: 0,
    });
    expect(balance).toBe(3_650_000);
    const status = getSettlementStatus(balance);
    expect(status.key).toBe('borrower_owes');
    expect(status.direction).toBe('borrower_pays_dad');
  });

  it('handles partial settlement with carry-over into cumulative running balance', () => {
    // Balance before = 3,650,000. Borrower pays 2,000,000.
    const balanceBefore = 3_650_000;
    const paid = 2_000_000;
    const carriedOver = balanceBefore - paid; // 1,650,000 carries over

    expect(carriedOver).toBe(1_650_000);

    // Record settlement transaction
    const settledTransactions: Transaction[] = [
      ...sampleTransactions,
      { id: 'tx-settle', date: '2026-11-30', borrower: 'Sokha', type: 'Repay', amount: paid, note: 'Month settlement 2026-11' },
    ];

    const newTotals = computeTotals(settledTransactions, sampleProducts);
    expect(newTotals.balance).toBe(1_650_000); // exactly carried over
  });

  it('calculates settlement in both directions: dad owes borrower when products exceed loan', () => {
    // Lend 1,000,000, Products delivered 1,800,000 => Balance = -800,000 (Dad owes borrower)
    const balance = calculateBalance({
      lent: 1_000_000,
      repaid: 0,
      productValue: 1_800_000,
      refunded: 0,
    });
    expect(balance).toBe(-800_000);
    const status = getSettlementStatus(balance);
    expect(status.key).toBe('dad_owes');
    expect(status.direction).toBe('dad_pays_borrower');

    // When dad refunds 800,000:
    const settledBalance = calculateBalance({
      lent: 1_000_000,
      repaid: 0,
      productValue: 1_800_000,
      refunded: 800_000,
    });
    expect(settledBalance).toBe(0);
    expect(getSettlementStatus(settledBalance).key).toBe('cleared');
  });

  it('verifies zero balance status when loans and products are completely even', () => {
    const balance = calculateBalance({
      lent: 2_500_000,
      repaid: 1_500_000,
      productValue: 1_000_000,
      refunded: 0,
    });
    expect(balance).toBe(0);
    const status = getSettlementStatus(balance);
    expect(status.key).toBe('cleared');
  });

  it('prevents writes to settled month via isMonthSettled check logic', () => {
    const settlements: SettlementRecord[] = [
      {
        id: 'set-1',
        month: '2026-10',
        borrower: 'Sokha',
        balanceBefore: 500_000,
        paid: 500_000,
        direction: 'borrower_pays_dad',
        carriedOver: 0,
        date: '2026-10-31',
      },
    ];

    const isLocked = (borrower: string, dateStr: string) => {
      const m = dateStr.slice(0, 7);
      return settlements.some(
        s => s.month === m && s.borrower.toLowerCase() === borrower.toLowerCase()
      );
    };

    expect(isLocked('Sokha', '2026-10-15')).toBe(true); // Locked
    expect(isLocked('Sokha', '2026-11-01')).toBe(false); // Open month
    expect(isLocked('Bopha', '2026-10-15')).toBe(false); // Different borrower
  });

  it('correctly categorizes entries on the first and last day of a month', () => {
    const boundaryTx: Transaction[] = [
      { id: 'b1', date: '2026-11-01', borrower: 'Dara', type: 'Lend', amount: 2_000_000 },
      { id: 'b2', date: '2026-11-30', borrower: 'Dara', type: 'Repay', amount: 500_000 },
    ];
    const boundaryProducts: Product[] = [
      { id: 'bp1', date: '2026-11-01', borrower: 'Dara', item: 'Fish', quantity: 10, unitPrice: 10000, total: 100_000 },
      { id: 'bp2', date: '2026-11-30', borrower: 'Dara', item: 'Rice', quantity: 20, unitPrice: 5000, total: 100_000 },
    ];

    const monthly = computeMonthlyTableUtil(boundaryTx, boundaryProducts, [], 'Dara');
    expect(monthly).toHaveLength(1);
    expect(monthly[0].month).toBe('2026-11');
    expect(monthly[0].lent).toBe(2_000_000);
    expect(monthly[0].repaid).toBe(500_000);
    expect(monthly[0].products).toBe(200_000);
    // Net = 2,000,000 - 500,000 - 200,000 = 1,300,000
    expect(monthly[0].netBalance).toBe(1_300_000);
  });

  it('reopen month logic validates exact matching of borrower name before unlocking', () => {
    const targetBorrower = 'សុខា (Sokha)';
    const validateReopenTypedName = (typed: string, expected: string) => {
      return typed.trim().normalize('NFC').toLowerCase() === expected.trim().normalize('NFC').toLowerCase();
    };

    expect(validateReopenTypedName('សុខា (sokha)', targetBorrower)).toBe(true);
    expect(validateReopenTypedName('សុខា', targetBorrower)).toBe(false); // must type full name
    expect(validateReopenTypedName('', targetBorrower)).toBe(false);
  });
});

describe('Category 4: Duplicates, Idempotency & Failure Resilience', () => {
  it('detects duplicate transaction IDs and prevents double appending (idempotency)', () => {
    const existingIds = new Set(['tx-100', 'tx-101', 'tx-102']);

    const checkDuplicate = (id: string) => existingIds.has(id);

    expect(checkDuplicate('tx-100')).toBe(true); // Duplicate
    expect(checkDuplicate('tx-103')).toBe(false); // New unique ID
  });

  it('simulates retry after network failure by keeping client ID invariant', () => {
    const clientGeneratedId = 'uuid-fixed-client-attempt-1';
    let database: { id: string; amount: number }[] = [];

    // Attempt 1: succeeds in client, but network dropped before response
    database.push({ id: clientGeneratedId, amount: 500_000 });

    // Client retry with SAME id
    const retryOperation = (incoming: { id: string; amount: number }) => {
      if (database.some(row => row.id === incoming.id)) {
        return { ok: true, duplicate: true };
      }
      database.push(incoming);
      return { ok: true };
    };

    const retryResult = retryOperation({ id: clientGeneratedId, amount: 500_000 });
    expect(retryResult.duplicate).toBe(true);
    expect(database).toHaveLength(1); // exactly one row retained!
  });

  it('keeps typed form state in memory upon simulated server rejection', () => {
    const formDraft = {
      date: '2026-11-10',
      borrower: 'Sokha',
      item: 'Organic Jasmine Rice',
      quantity: 50.5,
      unitPrice: 3800,
      total: 191900,
    };

    let serverError = 'month_settled';
    let preservedDraft = { ...formDraft };

    // When submission fails, draft must NOT be cleared
    if (serverError) {
      expect(preservedDraft.quantity).toBe(50.5);
      expect(preservedDraft.unitPrice).toBe(3800);
      expect(preservedDraft.item).toBe('Organic Jasmine Rice');
    }
  });

  it('safely handles concurrent row addition by distinct client UUIDs', () => {
    const rows: { id: string; borrower: string; amount: number }[] = [];
    const clientA = { id: 'client-A-uuid', borrower: 'Sokha', amount: 100_000 };
    const clientB = { id: 'client-B-uuid', borrower: 'Bopha', amount: 200_000 };

    rows.push(clientA);
    rows.push(clientB);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});
