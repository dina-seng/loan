import { describe, expect, it } from 'vitest';
import {
  balanceTone, formatDate, formatMoney, formatMonth, formatNumber, formatPositive, monthKey, normalizeAmountInput, todayISO,
} from './money.js';

describe('Khmer money helpers', () => {
  it('formats amounts with the riel symbol and grouped digits', () => {
    expect(formatMoney('150000')).toBe('៛150,000');
    expect(formatNumber(9000000000)).toBe('9,000,000,000');
  });

  it('keeps very large amounts exact', () => {
    expect(formatMoney('9000000000000001')).toBe('៛9,000,000,000,000,001');
  });

  it('shows a negative balance as a positive amount', () => {
    expect(formatPositive('-4504500')).toBe('៛4,504,500');
    expect(formatPositive('4504500')).toBe('៛4,504,500');
  });

  it('accepts Khmer digits, commas and the riel symbol', () => {
    expect(normalizeAmountInput('៛១,២០០,០០០')).toBe('1200000');
    expect(normalizeAmountInput('12.5')).toBe('125');
  });
});

describe('Khmer dates', () => {
  it('renders a plain date without shifting the day', () => {
    expect(formatDate('2026-11-27')).toBe('២៧ វិច្ឆិកា ២០២៦');
    expect(formatDate('2026-12-01')).toBe('១ ធ្នូ ២០២៦');
  });

  it('groups by month key and labels the month', () => {
    expect(monthKey('2026-11-27')).toBe('2026-11');
    expect(formatMonth('2026-11')).toBe('វិច្ឆិកា ២០២៦');
  });

  it('returns today as a plain Cambodia date', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('balance tones', () => {
  it('uses three distinct colors for the three states', () => {
    expect(balanceTone('PARTNER_OWES_US').dot).not.toBe(balanceTone('WE_OWE_PARTNER').dot);
    expect(balanceTone('SETTLED').dot).not.toBe(balanceTone('PARTNER_OWES_US').dot);
  });
});
