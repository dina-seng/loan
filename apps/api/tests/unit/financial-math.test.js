import { describe, expect, it } from 'vitest';
import { balanceDirection, computeBalance, signedAmount, TYPE_EFFECT } from '../../src/ledger.js';
import { parseAmount } from '../../src/money.js';
import { parseDate, todayISO } from '../../src/dates.js';

const entry = (type, amount) => ({ type, amount: BigInt(amount), voidedAt: null });

describe('the single balance function', () => {
  it('lends increase the balance', () => {
    expect(computeBalance([entry('LEND', 5000000)])).toBe(5000000n);
  });

  it('lend 5,000,000 minus product 4,504,500 = 495,500 they owe us', () => {
    expect(computeBalance([entry('LEND', 5000000), entry('PRODUCT', 4504500)])).toBe(495500n);
    expect(balanceDirection(495500n)).toBe('PARTNER_OWES_US');
  });

  it('SETTLE_IN reduces the balance and SETTLE_OUT increases it', () => {
    expect(computeBalance([entry('LEND', 100000), entry('SETTLE_IN', 40000)])).toBe(60000n);
    expect(computeBalance([entry('LEND', 100000), entry('SETTLE_OUT', 40000)])).toBe(140000n);
  });

  it('settling clears the balance', () => {
    const entries = [entry('LEND', 5000000), entry('PRODUCT', 4504500), entry('SETTLE_IN', 495500)];
    expect(computeBalance(entries)).toBe(0n);
    expect(balanceDirection(0n)).toBe('SETTLED');
  });

  it('products larger than the money lent leave us owing the partner', () => {
    const balance = computeBalance([entry('LEND', 1000000), entry('PRODUCT', 1500000)]);
    expect(balance).toBe(-500000n);
    expect(balanceDirection(balance)).toBe('WE_OWE_PARTNER');
  });

  it('uses exact integers for very large amounts', () => {
    expect(computeBalance([entry('LEND', 9000000000000000), entry('PRODUCT', 1)])).toBe(8999999999999999n);
  });

  it('defines every type exactly once', () => {
    expect(TYPE_EFFECT).toEqual({ LEND: 1n, PRODUCT: -1n, SETTLE_IN: -1n, SETTLE_OUT: 1n });
    expect(signedAmount('PRODUCT', 300n)).toBe(-300n);
    expect(signedAmount('SETTLE_OUT', 300n)).toBe(300n);
  });
});

describe('money parsing', () => {
  it('accepts whole riel, including Khmer digits and separators', () => {
    expect(parseAmount('៛1,200,000')).toBe(1200000n);
    expect(parseAmount('1 000 000')).toBe(1000000n);
  });

  it('rejects zero, negatives, decimals, letters and empty input', () => {
    expect(() => parseAmount('0')).toThrow();
    expect(() => parseAmount('-5')).toThrow();
    expect(() => parseAmount('12.5')).toThrow();
    expect(() => parseAmount('abc')).toThrow();
    expect(() => parseAmount('')).toThrow();
  });

  it('rejects amounts larger than the database can store', () => {
    expect(() => parseAmount('99999999999999999999')).toThrow();
  });
});

describe('plain dates', () => {
  it('rejects impossible calendar dates', () => {
    expect(() => parseDate('2026-02-30')).toThrow();
    expect(parseDate('2026-02-28').toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(() => parseDate('2026-13-01')).toThrow();
  });

  it('returns today in Cambodia as yyyy-mm-dd', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
