import { describe, expect, it } from 'vitest';
import {
  KIND_BY_TYPE,
  computeBalance,
  previewToSnapshot,
  signedAmount,
  summarize,
} from '../../src/ledger.js';
import {
  lineTotalFromScaled,
  money,
  normalizeDigits,
  parseAmount,
  parseQuantity,
  sumAmounts,
} from '../../src/money.js';
import { addDays, assertRange, toISODate } from '../../src/dates.js';

describe('money helpers (spec v4)', () => {
  it('normalizes Khmer digits before parsing', () => {
    expect(normalizeDigits('១២៣')).toBe('123');
    expect(parseAmount('៛១,២០០,០០០')).toBe(1200000n);
  });

  it('parses exact quantities to three decimal places', () => {
    expect(parseQuantity('២.៥')).toEqual({ decimal: '2.500', scaled: 2500n });
    expect(parseQuantity('0.125')).toEqual({ decimal: '0.125', scaled: 125n });
    expect(parseQuantity('3')).toEqual({ decimal: '3.000', scaled: 3000n });
    expect(() => parseQuantity('1.2345')).toThrow();
    expect(() => parseQuantity('0')).toThrow();
  });

  it('computes line totals by rounding to the nearest riel', () => {
    expect(lineTotalFromScaled(2500n, 1000n)).toBe(2500n);
    expect(lineTotalFromScaled(1500n, 999n)).toBe(1499n);
    expect(lineTotalFromScaled(1000n, 3n)).toBe(3n);
  });

  it('sums bigints and serializes them without precision loss', () => {
    expect(sumAmounts([1n, 2n, '3'])).toBe(6n);
    expect(money(9000000000000000000n)).toBe('9000000000000000000');
  });
});

describe('period summaries (spec v4)', () => {
  const entries = [
    { type: 'LEND', amount: 5000000n, voidedAt: null },
    { type: 'PRODUCT', amount: 4504500n, voidedAt: null },
    { type: 'SETTLE_IN', amount: 495500n, voidedAt: null },
    { type: 'LEND', amount: 100000n, voidedAt: new Date() },
  ];

  it('skips voided rows and groups the four money movements', () => {
    expect(summarize(entries)).toEqual({
      totalLent: 5000000n,
      totalDelivered: 4504500n,
      totalReceived: 495500n,
      totalPaidOut: 0n,
      count: 3,
    });
  });

  it('carries an opening balance into the balance', () => {
    expect(computeBalance(entries.slice(0, 2), 250000n)).toBe(745500n);
  });

  it('maps every entry type to a user-facing kind', () => {
    expect(KIND_BY_TYPE).toEqual({
      LEND: 'LENDING',
      PRODUCT: 'DELIVERY',
      SETTLE_IN: 'PAYMENT',
      SETTLE_OUT: 'PAYMENT',
    });
    expect(signedAmount('SETTLE_OUT', 100n)).toBe(100n);
  });

  it('builds a JSON-safe closing snapshot', () => {
    const snapshot = previewToSnapshot({
      partnerId: 'p1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      openingBalance: 100n,
      totalLent: 200n,
      totalDelivered: 50n,
      totalReceived: 30n,
      totalPaidOut: 10n,
      settlementAmount: 20n,
      netBeforeSettlement: 250n,
      closingBalance: 250n,
      transactionCount: 2,
    });
    expect(snapshot.openingBalance).toBe('100');
    expect(snapshot.closingBalance).toBe('250');
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });
});

describe('date ranges (spec v4)', () => {
  it('moves a plain date forward without timezone drift', () => {
    expect(toISODate(addDays('2026-01-31', 1))).toBe('2026-02-01');
  });

  it('rejects reversed ranges', () => {
    expect(() => assertRange('2026-02-01', '2026-01-31')).toThrow();
    expect(assertRange('2026-01-01', '2026-01-31')).toBeTruthy();
  });
});
