import { badRequest } from './errors.js';

export const BIGINT_MAX = 9000000000000000000n; // well inside PostgreSQL BIGINT

/** Parse a user-supplied amount into an exact bigint. Rejects fractions and floats. */
export function parseAmount(value, { field = 'amount', allowZero = false } = {}) {
  if (typeof value === 'bigint') {
    if (!allowZero && value <= 0n) throw badRequest('VALIDATION_ERROR', { [field]: 'តម្លៃត្រូវធំជាង ០' });
    return value;
  }
  const str = String(value ?? '').trim().replace(/[\s,៛]/g, '');
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

/** JSON-safe representation of money (strings avoid JavaScript precision loss). */
export function money(value) {
  return BigInt(value).toString();
}
