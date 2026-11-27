import { badRequest } from './errors.js';

export const BIGINT_MAX = 9000000000000000000n; // well inside PostgreSQL BIGINT

const KHMER_DIGITS = {
  '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4',
  '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9',
};

/** Convert Khmer numerals to ASCII digits. Everything else is left untouched. */
export function normalizeDigits(value) {
  return String(value ?? '').replace(/[០-៩]/g, (digit) => KHMER_DIGITS[digit]);
}

/** Parse a user-supplied amount into an exact bigint. Rejects fractions and floats. */
export function parseAmount(value, { field = 'amount', allowZero = false } = {}) {
  if (typeof value === 'bigint') {
    if (!allowZero && value <= 0n) throw badRequest('VALIDATION_ERROR', { [field]: 'តម្លៃត្រូវធំជាង ០' });
    if (value > BIGINT_MAX) throw badRequest('VALIDATION_ERROR', { [field]: 'ចំនួនលុយធំពេក' });
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw badRequest('VALIDATION_ERROR', { [field]: 'សូមបញ្ចូលចំនួនជាលេខគត់' });
    }
    return parseAmount(String(value), { field, allowZero });
  }
  const str = normalizeDigits(value).trim().replace(/[\s,៛]/g, '');
  if (!/^\d+$/.test(str)) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'សូមបញ្ចូលចំនួនជាលេខគត់' });
  }
  const result = BigInt(str);
  if (!allowZero && result <= 0n) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'តម្លៃត្រូវធំជាង ០' });
  }
  if (result > BIGINT_MAX) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'ចំនួនលុយធំពេក' });
  }
  return result;
}

/** Parse a decimal quantity into an exact scaled integer (3 decimal places). */
export function parseQuantity(value, field = 'quantity') {
  const str = normalizeDigits(value).trim().replace(/\s/g, '');
  if (!/^\d+(\.\d{1,3})?$/.test(str)) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'សូមបញ្ចូលចំនួនជាទសភាគ (ឧ. ២.៥)' });
  }
  const [whole, fraction = ''] = str.split('.');
  const padded = fraction.padEnd(3, '0');
  const scaled = BigInt(whole) * 1000n + BigInt(padded || '0');
  if (scaled <= 0n) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'ចំនួនត្រូវធំជាង ០' });
  }
  return { decimal: `${whole}.${padded}`, scaled };
}

/** lineTotal = quantity (x1000) * unitPrice / 1000, rounded to the nearest riel. */
export function lineTotalFromScaled(scaledQuantity, unitPrice) {
  return (scaledQuantity * unitPrice + 500n) / 1000n;
}

export function sumAmounts(values) {
  return values.reduce((sum, value) => sum + BigInt(value), 0n);
}

/** JSON-safe representation of money (strings avoid JavaScript precision loss). */
export function money(value) {
  return BigInt(value).toString();
}
