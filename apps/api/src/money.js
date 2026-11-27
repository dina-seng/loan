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

/** Parse a decimal quantity into an exact scaled integer (3 decimal places). */
export function parseQuantity(value, field = 'quantity') {
  const str = String(value ?? '').trim().replace(/\s/g, '');
  if (!/^\d+(\.\d{1,3})?$/.test(str)) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'សូមបញ្ចូលបរិមាណជាលេខត្រឹមត្រូវ (ទសភាគ ៣ កន្លែង)' });
  }
  const [whole, fraction = ''] = str.split('.');
  return { decimal: `${whole}.${fraction.padEnd(3, '0')}`, scaled: BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0') || '0') };
}

/** Convert a scaled quantity (x1000) back to a Decimal string for storage. */
export function scaledToDecimal(scaled) {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / 1000n;
  const fraction = String(abs % 1000n).padStart(3, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** lineTotal = quantity (x1000) * unitPrice / 1000, rounded to nearest riel. */
export function lineTotalFromScaled(scaledQuantity, unitPrice) {
  const product = scaledQuantity * unitPrice;
  const rounded = (product + 500n) / 1000n;
  return rounded;
}

export function sumAmounts(values) {
  return values.reduce((sum, value) => sum + BigInt(value), 0n);
}

/** JSON-safe representation of money (strings avoid JavaScript precision loss). */
export function money(value) {
  return BigInt(value).toString();
}
