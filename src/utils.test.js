import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  parseMoney,
  formatInputNumber,
  getRawNumber,
  computeTotals,
  computeBorrowerSummary,
  computeMonthlyTable,
  getUniqueBorrowers,
  normalizeBorrowerName,
  findBorrowerNameMatch,
  getMonthOptions,
  todayStr,
  normalizeDate,
} from './utils';

describe('formatMoney', () => {
  it('formats zero', () => {
    expect(formatMoney(0)).toBe('0៛');
  });

  it('formats a small number', () => {
    expect(formatMoney(500)).toBe('500៛');
  });

  it('formats with thousands separator', () => {
    expect(formatMoney(1500000)).toBe('1,500,000៛');
  });

  it('handles null/undefined', () => {
    expect(formatMoney(null)).toBe('0៛');
    expect(formatMoney(undefined)).toBe('0៛');
  });

  it('handles NaN', () => {
    expect(formatMoney(NaN)).toBe('0៛');
  });

  it('formats negative numbers', () => {
    expect(formatMoney(-500000)).toBe('-500,000៛');
  });
});

describe('parseMoney', () => {
  it('parses formatted money string', () => {
    expect(parseMoney('1,500,000៛')).toBe(1500000);
  });

  it('returns 0 for empty input', () => {
    expect(parseMoney('')).toBe(0);
    expect(parseMoney(null)).toBe(0);
  });
});

describe('formatInputNumber', () => {
  it('formats digits with commas', () => {
    expect(formatInputNumber('1500000')).toBe('1,500,000');
  });

  it('strips non-digits', () => {
    expect(formatInputNumber('1,500,000')).toBe('1,500,000');
  });

  it('returns empty for empty input', () => {
    expect(formatInputNumber('')).toBe('');
  });
});

describe('getRawNumber', () => {
  it('extracts integer from formatted string', () => {
    expect(getRawNumber('1,500,000')).toBe(1500000);
  });

  it('returns 0 for empty', () => {
    expect(getRawNumber('')).toBe(0);
  });
});

// -- Test data --
const sampleTransactions = [
  { id: '1', date: '2024-01-05', borrower: 'សុខ', type: 'Lend', amount: 500000, note: '' },
  { id: '2', date: '2024-01-10', borrower: 'សុខ', type: 'Lend', amount: 300000, note: '' },
  { id: '3', date: '2024-01-20', borrower: 'សុខ', type: 'Repay', amount: 200000, note: 'partial' },
  { id: '4', date: '2024-02-05', borrower: 'សុខ', type: 'Lend', amount: 400000, note: '' },
  { id: '5', date: '2024-02-15', borrower: 'ចាន់', type: 'Lend', amount: 100000, note: '' },
  { id: '6', date: '2024-02-28', borrower: 'ចាន់', type: 'Repay', amount: 100000, note: 'full' },
];

describe('computeTotals', () => {
  it('computes correct totals', () => {
    const result = computeTotals(sampleTransactions);
    expect(result.totalLent).toBe(1300000);   // 500k + 300k + 400k + 100k
    expect(result.totalRepaid).toBe(300000);   // 200k + 100k
    expect(result.netOutstanding).toBe(1000000);
  });

  it('handles empty array', () => {
    const result = computeTotals([]);
    expect(result.totalLent).toBe(0);
    expect(result.totalRepaid).toBe(0);
    expect(result.netOutstanding).toBe(0);
  });
});

describe('computeBorrowerSummary', () => {
  it('groups by borrower correctly', () => {
    const result = computeBorrowerSummary(sampleTransactions);
    expect(result).toHaveLength(2);

    const sok = result.find(b => b.borrower === 'សុខ');
    expect(sok.totalBorrowed).toBe(1200000);  // 500k + 300k + 400k
    expect(sok.totalRepaid).toBe(200000);
    expect(sok.outstanding).toBe(1000000);
    expect(sok.status).toBe('owing');

    const chan = result.find(b => b.borrower === 'ចាន់');
    expect(chan.totalBorrowed).toBe(100000);
    expect(chan.totalRepaid).toBe(100000);
    expect(chan.outstanding).toBe(0);
    expect(chan.status).toBe('paid');
  });

  it('handles empty array', () => {
    expect(computeBorrowerSummary([])).toEqual([]);
  });
});

describe('computeMonthlyTable', () => {
  it('groups by month and sorts descending', () => {
    const result = computeMonthlyTable(sampleTransactions);
    expect(result).toHaveLength(2);

    // Newest month first
    expect(result[0].month).toBe('2024-02');
    expect(result[0].lent).toBe(500000);    // 400k + 100k
    expect(result[0].repaid).toBe(100000);
    expect(result[0].balance).toBe(400000);

    expect(result[1].month).toBe('2024-01');
    expect(result[1].lent).toBe(800000);    // 500k + 300k
    expect(result[1].repaid).toBe(200000);
    expect(result[1].balance).toBe(600000);
  });

  it('handles empty array', () => {
    expect(computeMonthlyTable([])).toEqual([]);
  });
});

describe('getUniqueBorrowers', () => {
  it('returns unique borrower names', () => {
    const result = getUniqueBorrowers(sampleTransactions);
    expect(result).toContain('សុខ');
    expect(result).toContain('ចាន់');
    expect(result).toHaveLength(2);
  });

  it('normalizes and deduplicates borrower names without regard to case', () => {
    const result = getUniqueBorrowers([
      { borrower: ' Dina  Doe ' },
      { borrower: 'dina\u200B doe' },
      { borrower: 'សុខ' },
    ]);
    expect(result).toEqual(['Dina Doe', 'សុខ']);
  });
});

describe('normalizeBorrowerName', () => {
  it('trims, collapses spaces, removes zero-width characters, and normalizes NFC', () => {
    expect(normalizeBorrowerName('  Cafe\u0301\u200B  Doe\t Smith\uFEFF ')).toBe('Café Doe Smith');
    expect(normalizeBorrowerName(null)).toBe('');
  });
});

describe('findBorrowerNameMatch', () => {
  it('detects an existing name ignoring case', () => {
    expect(findBorrowerNameMatch('  DINA  ', ['Dina'])).toEqual({
      type: 'exact',
      borrower: 'Dina',
    });
  });

  it('warns about a very similar existing name', () => {
    expect(findBorrowerNameMatch('Dinaa', ['Dina'])).toMatchObject({
      type: 'similar',
      borrower: 'Dina',
    });
  });

  it('does not warn about unrelated names', () => {
    expect(findBorrowerNameMatch('Sok', ['Dina'])).toBeNull();
  });
});

describe('getMonthOptions', () => {
  it('returns sorted month options', () => {
    const result = getMonthOptions(sampleTransactions);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe('2024-02');
    expect(result[1].value).toBe('2024-01');
  });
});

describe('todayStr', () => {
  it('returns a valid yyyy-mm-dd string', () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('normalizeDate', () => {
  it('preserves standard yyyy-mm-dd', () => {
    expect(normalizeDate('2026-11-10')).toBe('2026-11-10');
  });

  it('normalizes Google Sheets date strings to yyyy-mm-dd', () => {
    const sheetDate = 'Tue Nov 10 2026 00:00:00 GMT+0700 (ម៉ោង​នៅ​ឥណ្ឌូចិន)';
    expect(normalizeDate(sheetDate)).toBe('2026-11-10');
  });

  it('handles empty or null values', () => {
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate(null)).toBe('');
  });
});
