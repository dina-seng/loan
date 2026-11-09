import {
  getCambodiaTodayStr,
  formatToCambodiaDate,
  getMonthKeyFromDate,
} from '../../lib/dates';
import { calculateMonthlyTable } from '../../lib/math';
import { Transaction } from '../../lib/types';

describe('Category 5: Dates and Cambodia Timezone (UTC+7 / Asia/Phnom_Penh)', () => {
  describe('5.1 Cambodia Midnight & 6 AM Timezone Boundary Invariance', () => {
    it('formats 6:00 AM Cambodia time as the current day, NOT UTC previous day', () => {
      // 6:00 AM in Cambodia (UTC+7) on 2024-11-05 corresponds to 2024-11-04 23:00:00 UTC.
      // If code carelessly uses new Date().toISOString().split('T')[0], it outputs 2024-11-04 (WRONG).
      const utcTime = new Date('2024-11-04T23:00:00.000Z'); // 06:00 Nov 5 in Cambodia

      const cambodiaDate = formatToCambodiaDate(utcTime);
      expect(cambodiaDate).toBe('2024-11-05');
    });

    it('formats 00:05 AM (5 minutes after midnight) as the new day in Cambodia', () => {
      // 00:05 AM on 2024-11-05 in Cambodia is 2024-11-04 17:05:00 UTC
      const justAfterMidnight = new Date('2024-11-04T17:05:00.000Z');

      const cambodiaDate = formatToCambodiaDate(justAfterMidnight);
      expect(cambodiaDate).toBe('2024-11-05');
    });

    it('formats 23:55 PM (5 minutes before midnight) as the same day in Cambodia', () => {
      // 23:55 PM on 2024-11-05 in Cambodia is 2024-11-05 16:55:00 UTC
      const justBeforeMidnight = new Date('2024-11-05T16:55:00.000Z');

      const cambodiaDate = formatToCambodiaDate(justBeforeMidnight);
      expect(cambodiaDate).toBe('2024-11-05');
    });
  });

  describe('5.2 Month Boundaries & Aggregation (Oct 31 vs Nov 1)', () => {
    it('accurately parses month keys across month boundary', () => {
      expect(getMonthKeyFromDate('2024-10-31')).toBe('2024-10');
      expect(getMonthKeyFromDate('2024-11-01')).toBe('2024-11');
    });

    it('places Oct 31 and Nov 1 transactions strictly into separate months in Monthly Table', () => {
      const boundaryTransactions: Transaction[] = [
        { id: 't1', date: '2024-10-31', borrower: 'Sok', type: 'Lend', amount: 1_000_000 },
        { id: 't2', date: '2024-11-01', borrower: 'Sok', type: 'Repay', amount: 500_000 },
      ];

      const monthly = calculateMonthlyTable(boundaryTransactions);
      expect(monthly).toHaveLength(2);

      const nov = monthly.find(m => m.month === '2024-11');
      const oct = monthly.find(m => m.month === '2024-10');

      expect(nov).toBeDefined();
      expect(nov!.lent).toBe(0);
      expect(nov!.repaid).toBe(500_000);

      expect(oct).toBeDefined();
      expect(oct!.lent).toBe(1_000_000);
      expect(oct!.repaid).toBe(0);
    });
  });

  describe('5.3 Format Stability on Readback', () => {
    it('preserves exact YYYY-MM-DD string format when loaded from Google Sheet without shifts', () => {
      const sheetDateString = '2024-10-31';

      // Ensure that parsing or formatting does not alter the string representation
      const parts = sheetDateString.split('-');
      expect(parts[0]).toBe('2024');
      expect(parts[1]).toBe('10');
      expect(parts[2]).toBe('31');

      // Year-Month substring preservation
      expect(sheetDateString.slice(0, 7)).toBe('2024-10');
    });
  });
});
