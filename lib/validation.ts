const KHMER_DIGITS_MAP: Record<string, string> = {
  '០': '0',
  '១': '1',
  '២': '2',
  '៣': '3',
  '៤': '4',
  '៥': '5',
  '៦': '6',
  '៧': '7',
  '៨': '8',
  '៩': '9',
};

/**
 * Converts Khmer unicode numerals (០-៩) to Western Arabic digits (0-9).
 * Leaves standard ASCII digits and decimal characters intact.
 */
export function convertKhmerDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[០-៩]/g, char => KHMER_DIGITS_MAP[char] || char);
}

/**
 * Parses and sanitizes an amount input string.
 * Supports:
 * - Western digits ("1500000")
 * - Khmer numerals ("១៥០០០០០" -> 1500000)
 * - Comma-separated strings ("1,500,000")
 * - Trailing/leading whitespace
 * Rejects:
 * - Decimals (returns null for whole integer requirement)
 * - Negative values
 * - Non-numeric characters
 */
export function parseIntegerAmount(rawInput: string | number): {
  valid: boolean;
  value: number;
  error?: string;
} {
  if (typeof rawInput === 'number') {
    if (!Number.isSafeInteger(rawInput) || rawInput <= 0) {
      return { valid: false, value: 0, error: 'ចំនួនទឹកប្រាក់ត្រូវតែជាចំនួនគត់ធំជាង 0' };
    }
    return { valid: true, value: rawInput };
  }

  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, value: 0, error: 'សូមបញ្ចូលចំនួនទឹកប្រាក់' };
  }

  // Convert Khmer digits to Arabic digits
  let normalized = convertKhmerDigits(rawInput.trim());

  // Check for decimals
  if (normalized.includes('.') || normalized.includes(',')) {
    // If commas are used as thousand separators, remove them
    // But if a comma or dot represents fractional decimals, reject
    if (/\.\d+/.test(normalized) || /,\d{1,2}$/.test(normalized)) {
      return {
        valid: false,
        value: 0,
        error: 'មិនអនុញ្ញាតឱ្យមានទសភាគទេ សូមបញ្ចូលចំនួនគត់ (No decimals allowed)',
      };
    }
  }

  // Remove commas used as thousand separators and spaces
  normalized = normalized.replace(/[, \s៛$]/g, '');

  if (!/^\d+$/.test(normalized)) {
    return { valid: false, value: 0, error: 'សូមបញ្ចូលតែលេខប៉ុណ្ណោះ (Digits only)' };
  }

  // Maximum reasonable loan constraint: 100 Billion KHR (~$25M USD)
  const MAX_LIMIT_KHR = 100_000_000_000;
  if (normalized.length > 11 || Number(normalized) > MAX_LIMIT_KHR) {
    return {
      valid: false,
      value: 0,
      error: 'ចំនួនទឹកប្រាក់លើសពីកម្រិតកំណត់អតិបរមា (Amount exceeds maximum limit)',
    };
  }

  const num = Number(normalized);

  if (!Number.isSafeInteger(num) || num <= 0) {
    return {
      valid: false,
      value: 0,
      error: 'ចំនួនទឹកប្រាក់ត្រូវតែធំជាង 0',
    };
  }

  return { valid: true, value: num };
}

/**
 * Prevents Google Sheets formula injection (CSV/Spreadsheet injection).
 * Characters '=+', '-', '@', tab (\t), or newline at the start of a cell are escaped with an apostrophe (').
 */
export function sanitizeForGoogleSheets(input: string): string {
  if (!input) return '';
  if (/^[=+\-@\t\r]/.test(input)) {
    return `'${input}`;
  }
  const trimmed = input.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Validates note text: supports Khmer script, emoji, punctuation, up to 500 characters.
 */
export function validateNote(note: string): { valid: boolean; error?: string; sanitized: string } {
  if (!note) return { valid: true, sanitized: '' };
  if (note.length > 500) {
    return { valid: false, error: 'កំណត់សម្គាល់មិនអាចលើសពី 500 តួអក្សរ (Note cannot exceed 500 characters)', sanitized: note.slice(0, 500) };
  }
  return { valid: true, sanitized: sanitizeForGoogleSheets(note) };
}
