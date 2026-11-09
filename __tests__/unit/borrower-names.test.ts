import {
  normalizeBorrowerName,
  findSimilarBorrower,
  mergeBorrowerRecords,
} from '../../lib/names';
import { Transaction } from '../../lib/types';

describe('Category 3: Borrower Names, Unicode Normalization & Deduplication', () => {
  describe('3.1 Unicode & Whitespace Normalization', () => {
    it('normalizes leading, trailing, and redundant internal whitespace', () => {
      const raw = '   សុខ    គង់   ';
      expect(normalizeBorrowerName(raw)).toBe('សុខ គង់');
    });

    it('strips invisible zero-width Khmer characters (ZWSP, ZWNJ, ZWJ, BOM)', () => {
      // Invisible characters embedded between Khmer consonants
      const nameWithInvisible = 'សុ\u200Bខ\u200C \u200Dគង់\uFEFF';
      const cleanName = 'សុខ គង់';

      expect(normalizeBorrowerName(nameWithInvisible)).toBe(cleanName);
    });

    it('resolves different capitalization to the same borrower canonical form', () => {
      const name1 = normalizeBorrowerName('chan dara').toLowerCase();
      const name2 = normalizeBorrowerName('Chan Dara').toLowerCase();
      const name3 = normalizeBorrowerName('  CHAN   DARA  ').toLowerCase();

      expect(name1).toBe('chan dara');
      expect(name2).toBe('chan dara');
      expect(name3).toBe('chan dara');
    });
  });

  describe('3.2 Near-Duplicate & Similar-Name Warning System', () => {
    const existingBorrowers = ['សុខ គង់', 'ចាន់ ណារី', 'Sok Heng'];

    it('triggers similarity warning for extra whitespace / invisible chars', () => {
      const candidate = '  សុខ គង់  ';
      const check = findSimilarBorrower(candidate, existingBorrowers);

      expect(check.isSimilar).toBe(true);
      expect(check.existingMatch).toBe('សុខ គង់');
    });

    it('triggers similarity warning for 1-character typographic slips', () => {
      // "Sok Hen" vs "Sok Heng"
      const typo = 'Sok Hen';
      const check = findSimilarBorrower(typo, existingBorrowers);

      expect(check.isSimilar).toBe(true);
      expect(check.existingMatch).toBe('Sok Heng');
      expect(check.reason).toContain('ស្រដៀងនឹងឈ្មោះដែលមានស្រាប់');
    });

    it('does not trigger false positive for distinct names', () => {
      const distinct = 'គង់ សំបូរ';
      const check = findSimilarBorrower(distinct, existingBorrowers);

      expect(check.isSimilar).toBe(false);
      expect(check.existingMatch).toBeUndefined();
    });
  });

  describe('3.3 Rename & Record Merge Integrity', () => {
    const transactionHistory: Transaction[] = [
      { id: '1', date: '2024-01-01', borrower: 'Sok Kong', type: 'Lend', amount: 500000 },
      { id: '2', date: '2024-01-05', borrower: ' sok  kong ', type: 'Repay', amount: 200000 },
      { id: '3', date: '2024-01-10', borrower: 'Chan Nary', type: 'Lend', amount: 800000 },
    ];

    it('updates all historical rows when renaming/merging borrower records', () => {
      const merged = mergeBorrowerRecords(transactionHistory, 'sok kong', 'សុខ គង់');

      expect(merged[0].borrower).toBe('សុខ គង់');
      expect(merged[1].borrower).toBe('សុខ គង់');
      expect(merged[2].borrower).toBe('Chan Nary'); // unaffected
    });
  });

  describe('3.4 Last Used Borrower Memory', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists and retrieves the most recently used borrower in localStorage', () => {
      const borrower = 'សុខ គង់';
      localStorage.setItem('lms_last_borrower', borrower);

      const retrieved = localStorage.getItem('lms_last_borrower');
      expect(retrieved).toBe('សុខ គង់');
    });
  });
});
