import {
  convertKhmerDigits,
  parseIntegerAmount,
  sanitizeForGoogleSheets,
  validateNote,
} from '../../lib/validation';
import { validateTransactionDate } from '../../lib/dates';

describe('Category 2: Input Validation & Khmer Character Handling', () => {
  describe('2.1 Numeric & Currency Input Validation', () => {
    it('accepts valid whole integer numbers', () => {
      const res = parseIntegerAmount('1500000');
      expect(res.valid).toBe(true);
      expect(res.value).toBe(1_500_000);
      expect(res.error).toBeUndefined();
    });

    it('rejects amount of zero', () => {
      const res = parseIntegerAmount('0');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('ធំជាង 0');
    });

    it('rejects negative numbers', () => {
      const res = parseIntegerAmount('-50000');
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('rejects empty input or whitespace', () => {
      expect(parseIntegerAmount('').valid).toBe(false);
      expect(parseIntegerAmount('   ').valid).toBe(false);
    });

    it('rejects letters and non-numeric characters', () => {
      const res = parseIntegerAmount('abc');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('តែលេខប៉ុណ្ណោះ');

      const mixed = parseIntegerAmount('1000abc');
      expect(mixed.valid).toBe(false);
    });

    it('strictly rejects floating-point decimals to enforce integer-only Riel', () => {
      const dotDecimal = parseIntegerAmount('1500.50');
      expect(dotDecimal.valid).toBe(false);
      expect(dotDecimal.error).toContain('មិនអនុញ្ញាតឱ្យមានទសភាគ');

      const commaDecimal = parseIntegerAmount('1500,50');
      expect(commaDecimal.valid).toBe(false);
    });

    it('safely handles thousands separator commas typed or pasted', () => {
      const res = parseIntegerAmount('1,500,000');
      expect(res.valid).toBe(true);
      expect(res.value).toBe(1_500_000);

      const withCurrencySymbol = parseIntegerAmount('1,500,000៛');
      expect(withCurrencySymbol.valid).toBe(true);
      expect(withCurrencySymbol.value).toBe(1_500_000);
    });

    it('rejects absurdly long numbers exceeding maximum ceiling', () => {
      // Exceeds 100 Billion KHR cap
      const absurd = parseIntegerAmount('9999999999999999999');
      expect(absurd.valid).toBe(false);
      expect(absurd.error).toContain('លើសពីកម្រិតកំណត់អតិបរមា');
    });
  });

  describe('2.2 Khmer Digits Conversion & Unicode Numerals', () => {
    it('accurately converts all Khmer digits ០-៩ to ASCII 0-9', () => {
      expect(convertKhmerDigits('០១២៣៤៥៦៧៨៩')).toBe('0123456789');
    });

    it('parses pasted Khmer digits as valid loan amounts', () => {
      // ១,៥០០,០០០ = 1,500,000
      const res = parseIntegerAmount('១,៥០០,០០០');
      expect(res.valid).toBe(true);
      expect(res.value).toBe(1_500_000);
    });

    it('parses combined mixed digits smoothly', () => {
      const res = parseIntegerAmount('៥00000'); // 500,000
      expect(res.valid).toBe(true);
      expect(res.value).toBe(500_000);
    });
  });

  describe('2.3 Date & Calendar Validation', () => {
    it('validates standard YYYY-MM-DD format', () => {
      expect(validateTransactionDate('2024-03-15').valid).toBe(true);
    });

    it('rejects missing or malformed dates', () => {
      expect(validateTransactionDate('').valid).toBe(false);
      expect(validateTransactionDate('15/03/2024').valid).toBe(false);
      expect(validateTransactionDate('2024-3-15').valid).toBe(false);
    });

    it('handles leap year edge cases accurately', () => {
      // 2024 is a leap year -> Feb 29 is valid
      expect(validateTransactionDate('2024-02-29').valid).toBe(true);

      // 2025 is NOT a leap year -> Feb 29 is invalid
      const nonLeap = validateTransactionDate('2025-02-29');
      expect(nonLeap.valid).toBe(false);
      expect(nonLeap.error).toContain('ថ្ងៃមិនត្រឹមត្រូវ');
    });

    it('rejects dates in the future when disallowFuture is enabled', () => {
      const futureDate = '2099-01-01';
      const res = validateTransactionDate(futureDate, false);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('មិនអាចជាថ្ងៃអនាគត');
    });
  });

  describe('2.4 Note Field & Google Sheets Formula Injection Prevention', () => {
    it('accepts long Khmer text and Unicode emoji in notes', () => {
      const khmerWithEmoji = 'ខ្ចីសម្រាប់ទិញសម្ភារៈសំណង់ផ្ទះ 🏠🚚 (បង់ផ្ដាច់ចុងខែ)';
      const res = validateNote(khmerWithEmoji);
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe(khmerWithEmoji);
    });

    it('rejects notes exceeding 500 characters', () => {
      const tooLong = 'ក'.repeat(501);
      const res = validateNote(tooLong);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('500');
    });

    it('escapes formula injection characters (=, +, -, @) with single quote', () => {
      expect(sanitizeForGoogleSheets('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeForGoogleSheets('+1234567')).toBe("'+1234567");
      expect(sanitizeForGoogleSheets('-1000')).toBe("'-1000");
      expect(sanitizeForGoogleSheets('@cmd')).toBe("'@cmd");
      expect(sanitizeForGoogleSheets('\tHiddenTab')).toBe("'\tHiddenTab");
    });
  });
});
