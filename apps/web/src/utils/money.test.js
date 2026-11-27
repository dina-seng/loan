import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatNumber, normalizeAmountInput, balanceTone } from './money.js';

describe('Khmer money helpers', () => {
  it('formats amounts with the riel symbol and grouped digits', () => {
    expect(formatMoney('150000')).toBe('៛150,000');
    expect(formatNumber(9000000000)).toBe('9,000,000,000');
  });

  it('accepts Khmer digits, commas and the riel symbol', () => {
    expect(normalizeAmountInput('៛១,២០០,០០០')).toBe('1200000');
    expect(normalizeAmountInput('12.5')).toBe('125');
  });

  it('renders dates naturally in Khmer', () => {
    expect(formatDate('2026-11-27')).toBe('២៧ វិច្ឆិកា ២០២៦');
  });

  it('uses three distinct visual tones for balance states', () => {
    expect(balanceTone('OUDOM_OWES_DAD').dot).not.toBe(balanceTone('DAD_OWES_OUDOM').dot);
    expect(balanceTone('SETTLED').dot).not.toBe(balanceTone('OUDOM_OWES_DAD').dot);
  });
});
