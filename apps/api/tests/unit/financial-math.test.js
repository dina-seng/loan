import { describe, expect, it } from 'vitest';
import { computeBalance, directionLabel, EFFECT, summarize } from '../../src/ledger.js';
import { lineTotalFromScaled, parseAmount, parseQuantity, scaledToDecimal } from '../../src/money.js';
import { parseDate, assertRange } from '../../src/dates.js';

const entry = (kind, amount, direction) => ({
  kind,
  amount: BigInt(amount),
  direction,
  signedAmount: BigInt(amount) * EFFECT[direction || kind],
  voidedAt: null,
});

describe('central balance calculation', () => {
  it('1. lending increases the balance', () => {
    expect(computeBalance([entry('LENDING', 400000)], 100000)).toBe(500000n);
  });

  it('2. product delivery decreases the balance', () => {
    expect(computeBalance([entry('LENDING', 400000), entry('DELIVERY', 200000)], 100000)).toBe(300000n);
  });

  it('3. Oudom payment to Dad decreases the balance', () => {
    expect(computeBalance([entry('LENDING', 400000), entry('PAYMENT', 150000, 'PARTNER_TO_DAD')], 100000)).toBe(350000n);
  });

  it('4. Dad payment to Oudom increases the balance', () => {
    expect(computeBalance([entry('LENDING', 400000), entry('PAYMENT', 50000, 'DAD_TO_PARTNER')], 100000)).toBe(550000n);
  });

  it('matches the worked example exactly', () => {
    const entries = [
      entry('LENDING', 400000),
      entry('DELIVERY', 200000),
      entry('PAYMENT', 150000, 'PARTNER_TO_DAD'),
    ];
    expect(computeBalance(entries, 100000)).toBe(150000n);
  });

  it('5. partial payments leave a remainder and can flip direction', () => {
    expect(computeBalance([entry('LENDING', 100000), entry('PAYMENT', 40000, 'PARTNER_TO_DAD')])).toBe(60000n);
    expect(computeBalance([entry('LENDING', 100000), entry('PAYMENT', 120000, 'PARTNER_TO_DAD')])).toBe(-20000n);
  });

  it('6. opening balances carry forward without re-adding closed records', () => {
    const opening = 150000n; // already includes everything before the new period
    expect(computeBalance([entry('LENDING', 50000)], opening)).toBe(200000n);
  });

  it('7. a closing snapshot is not itself a ledger entry (no double counting)', () => {
    const before = computeBalance([entry('LENDING', 400000), entry('DELIVERY', 200000)], 100000);
    const after = computeBalance([entry('LENDING', 400000), entry('DELIVERY', 200000), entry('LENDING', 50000)], 100000);
    expect(before).toBe(300000n);
    expect(after).toBe(350000n); // +50000 only, not +300000 +50000
  });

  it('10. voided entries are excluded from totals', () => {
    const entries = [
      entry('LENDING', 100000),
      { ...entry('LENDING', 70000), voidedAt: new Date() },
    ];
    expect(summarize(entries).totalLent).toBe(100000n);
  });

  it('uses exact integers for very large amounts', () => {
    expect(computeBalance([entry('LENDING', 9000000000000000)], 1)).toBe(9000000000000001n);
  });
});

describe('partner-aware labels', () => {
  it('uses the selected partner name in payment directions', () => {
    expect(directionLabel('PAYMENT', 'PARTNER_TO_DAD', 'សុភី')).toBe('សុភី → ប៉ា');
    expect(directionLabel('PAYMENT', 'DAD_TO_PARTNER', 'សុភី')).toBe('ប៉ា → សុភី');
    expect(directionLabel('LENDING', null, 'សុភី')).toBe('ការឱ្យខ្ចីប្រាក់');
  });
});

describe('money parsing', () => {
  it('accepts Khmer-formatted integers and rejects decimals', () => {
    expect(parseAmount('៛1,200,000')).toBe(1200000n);
    expect(() => parseAmount('12.5')).toThrow();
    expect(() => parseAmount('-5')).toThrow();
    expect(() => parseAmount('0')).toThrow();
    expect(parseAmount('0', { allowZero: true })).toBe(0n);
  });

  it('calculates delivery line totals with 3-decimal quantities', () => {
    const quantity = parseQuantity('2.500');
    expect(scaledToDecimal(quantity.scaled)).toBe('2.500');
    expect(lineTotalFromScaled(quantity.scaled, 1200n)).toBe(3000n);
    const rounded = parseQuantity('0.333');
    expect(lineTotalFromScaled(rounded.scaled, 1000n)).toBe(333n);
  });
});

describe('date handling', () => {
  it('rejects invalid calendar dates', () => {
    expect(() => parseDate('2026-02-30')).toThrow();
    expect(parseDate('2026-02-28').toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(() => parseDate('2026-13-01')).toThrow();
  });

  it('asserts custom ranges', () => {
    expect(assertRange('2026-01-01', '2026-01-15')).toBeDefined();
    expect(() => assertRange('2026-02-01', '2026-01-01')).toThrow();
  });
});
