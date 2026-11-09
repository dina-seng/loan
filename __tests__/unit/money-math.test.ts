import {
  calculateTotals,
  calculateBorrowerSummaries,
  calculateMonthlyTable,
  checkOverpayment,
  isSafeIntegerAmount,
} from '../../lib/math';
import { Transaction } from '../../lib/types';

describe('Category 1: Money Math (Core Financial Logic)', () => {
  // Hand-calculated benchmark fixtures
  const sampleTransactions: Transaction[] = [
    { id: 'tx-1', date: '2024-03-01', borrower: 'សុខ គង់', type: 'Lend', amount: 5_000_000, note: 'Initial loan' },
    { id: 'tx-2', date: '2024-03-10', borrower: 'សុខ គង់', type: 'Lend', amount: 2_500_000, note: 'Second loan' },
    { id: 'tx-3', date: '2024-03-25', borrower: 'សុខ គង់', type: 'Repay', amount: 3_000_000, note: 'Partial repay' },
    { id: 'tx-4', date: '2024-04-05', borrower: 'សុខ គង់', type: 'Repay', amount: 4_500_000, note: 'Full settlement' },
    { id: 'tx-5', date: '2024-04-12', borrower: 'ចាន់ ណារី', type: 'Lend', amount: 10_000_000, note: 'Business loan' },
    { id: 'tx-6', date: '2024-04-20', borrower: 'ចាន់ ណារី', type: 'Repay', amount: 4_000_000, note: 'Partial repay' },
  ];

  describe('1.1 Hand-Calculated Benchmark Accuracy', () => {
    it('matches exact totals for Lend, Repay, and Net Outstanding', () => {
      const totals = calculateTotals(sampleTransactions);

      // Hand calculation:
      // Total Lent: 5M + 2.5M + 10M = 17,500,000
      // Total Repaid: 3M + 4.5M + 4M = 11,500,000
      // Net Outstanding: 17.5M - 11.5M = 6,000,000
      expect(totals.totalLent).toBe(17_500_000);
      expect(totals.totalRepaid).toBe(11_500_000);
      expect(totals.netOutstanding).toBe(6_000_000);
    });

    it('matches borrower summaries with correct paid vs owing status', () => {
      const summaries = calculateBorrowerSummaries(sampleTransactions);

      expect(summaries).toHaveLength(2);

      // Borrower 1: សុខ គង់ (Fully paid)
      const sok = summaries.find(s => s.borrower === 'សុខ គង់');
      expect(sok).toBeDefined();
      expect(sok!.totalBorrowed).toBe(7_500_000);
      expect(sok!.totalRepaid).toBe(7_500_000);
      expect(sok!.outstanding).toBe(0);
      expect(sok!.status).toBe('paid');
      expect(sok!.transactionCount).toBe(4);

      // Borrower 2: ចាន់ ណារី (Owing)
      const chan = summaries.find(s => s.borrower === 'ចាន់ ណារី');
      expect(chan).toBeDefined();
      expect(chan!.totalBorrowed).toBe(10_000_000);
      expect(chan!.totalRepaid).toBe(4_000_000);
      expect(chan!.outstanding).toBe(6_000_000);
      expect(chan!.status).toBe('owing');
      expect(chan!.transactionCount).toBe(2);
    });

    it('groups by month descending and calculates balances accurately', () => {
      const monthly = calculateMonthlyTable(sampleTransactions);

      expect(monthly).toHaveLength(2);

      // Newest month first: 2024-04
      expect(monthly[0].month).toBe('2024-04');
      expect(monthly[0].lent).toBe(10_000_000);
      expect(monthly[0].repaid).toBe(8_500_000); // 4.5M + 4M
      expect(monthly[0].balance).toBe(1_500_000);

      // 2024-03
      expect(monthly[1].month).toBe('2024-03');
      expect(monthly[1].lent).toBe(7_500_000); // 5M + 2.5M
      expect(monthly[1].repaid).toBe(3_000_000);
      expect(monthly[1].balance).toBe(4_500_000);
    });
  });

  describe('1.2 Overpayment Detection & Confirmation Gate', () => {
    it('detects overpayment when repaying more than net debt', () => {
      // Borrower owes 6,000,000 KHR
      const result = checkOverpayment('ចាន់ ណារី', 7_000_000, sampleTransactions);

      expect(result.isOverpayment).toBe(true);
      expect(result.currentDebt).toBe(6_000_000);
      expect(result.excessAmount).toBe(1_000_000);
      expect(result.warningMessage).toContain('លើសពីបំណុលបច្ចុប្បន្ន');
    });

    it('allows exact full repayment without overpayment flag', () => {
      const result = checkOverpayment('ចាន់ ណារី', 6_000_000, sampleTransactions);

      expect(result.isOverpayment).toBe(false);
      expect(result.excessAmount).toBe(0);
      expect(result.warningMessage).toBeUndefined();
    });

    it('flags repayment to a borrower with zero balance as 100% excess', () => {
      // សុខ គង់ already has 0 outstanding balance
      const result = checkOverpayment('សុខ គង់', 500_000, sampleTransactions);

      expect(result.isOverpayment).toBe(true);
      expect(result.currentDebt).toBe(0);
      expect(result.excessAmount).toBe(500_000);
    });
  });

  describe('1.3 High-Value Currencies (Billions of Riel) & Precision Safety', () => {
    it('handles billions of riel without IEEE-754 precision loss', () => {
      const largeTransactions: Transaction[] = [
        { id: '1', date: '2024-01-01', borrower: 'មហាសេដ្ឋី', type: 'Lend', amount: 45_000_000_000 },
        { id: '2', date: '2024-01-02', borrower: 'មហាសេដ្ឋី', type: 'Lend', amount: 55_000_000_000 },
        { id: '3', date: '2024-01-03', borrower: 'មហាសេដ្ឋី', type: 'Repay', amount: 30_000_000_000 },
      ];

      const totals = calculateTotals(largeTransactions);

      // 45B + 55B = 100B
      expect(totals.totalLent).toBe(100_000_000_000);
      expect(totals.totalRepaid).toBe(30_000_000_000);
      expect(totals.netOutstanding).toBe(70_000_000_000);
      expect(Number.isSafeInteger(totals.netOutstanding)).toBe(true);
    });

    it('enforces whole integers and rejects floating-point amounts', () => {
      expect(isSafeIntegerAmount(100000)).toBe(true);
      expect(isSafeIntegerAmount(0)).toBe(true);
      expect(isSafeIntegerAmount(1500.5)).toBe(false);
      expect(isSafeIntegerAmount(0.01)).toBe(false);
      expect(isSafeIntegerAmount(-500)).toBe(false);
      expect(isSafeIntegerAmount(NaN)).toBe(false);
      expect(isSafeIntegerAmount(Infinity)).toBe(false);
    });
  });

  describe('1.4 Data Volumes: Empty, Single Row, and Thousands of Rows', () => {
    it('returns zeroed state on empty transaction array without throwing', () => {
      expect(calculateTotals([])).toEqual({ totalLent: 0, totalRepaid: 0, netOutstanding: 0 });
      expect(calculateBorrowerSummaries([])).toEqual([]);
      expect(calculateMonthlyTable([])).toEqual([]);
    });

    it('calculates single transaction correctly', () => {
      const single: Transaction[] = [
        { id: 's-1', date: '2024-05-01', borrower: 'តារា', type: 'Lend', amount: 1_200_000 },
      ];
      const totals = calculateTotals(single);
      expect(totals.totalLent).toBe(1_200_000);
      expect(totals.totalRepaid).toBe(0);
      expect(totals.netOutstanding).toBe(1_200_000);

      const summaries = calculateBorrowerSummaries(single);
      expect(summaries[0].status).toBe('owing');
      expect(summaries[0].outstanding).toBe(1_200_000);
    });

    it('processes 10,000 transactions in under 50ms with mathematical consistency', () => {
      const bulk: Transaction[] = [];
      let expectedLent = 0;
      let expectedRepaid = 0;

      for (let i = 0; i < 10_000; i++) {
        const isLend = i % 2 === 0;
        const amount = (i + 1) * 100;
        if (isLend) {
          expectedLent += amount;
          bulk.push({ id: `b-${i}`, date: '2024-01-15', borrower: 'BulkUser', type: 'Lend', amount });
        } else {
          expectedRepaid += amount;
          bulk.push({ id: `b-${i}`, date: '2024-01-16', borrower: 'BulkUser', type: 'Repay', amount });
        }
      }

      const start = performance.now();
      const totals = calculateTotals(bulk);
      const duration = performance.now() - start;

      expect(totals.totalLent).toBe(expectedLent);
      expect(totals.totalRepaid).toBe(expectedRepaid);
      expect(totals.netOutstanding).toBe(expectedLent - expectedRepaid);
      expect(duration).toBeLessThan(50); // fast performance requirement
    });
  });

  describe('1.5 Delete Integrity', () => {
    it('preserves exact mathematical integrity when a transaction is deleted', () => {
      const initialTotals = calculateTotals(sampleTransactions);

      // Delete tx-5 (Lend of 10,000,000)
      const afterDelete = sampleTransactions.filter(t => t.id !== 'tx-5');
      const updatedTotals = calculateTotals(afterDelete);

      expect(updatedTotals.totalLent).toBe(initialTotals.totalLent - 10_000_000);
      expect(updatedTotals.totalRepaid).toBe(initialTotals.totalRepaid);
      expect(updatedTotals.netOutstanding).toBe(initialTotals.netOutstanding - 10_000_000);

      const chanSummary = calculateBorrowerSummaries(afterDelete).find(b => b.borrower === 'ចាន់ ណារី');
      // Now Chan Nary only has 4M repaid without loan -> outstanding is -4M (or overpaid state)
      expect(chanSummary!.totalBorrowed).toBe(0);
      expect(chanSummary!.totalRepaid).toBe(4_000_000);
      expect(chanSummary!.outstanding).toBe(-4_000_000);
    });
  });
});
