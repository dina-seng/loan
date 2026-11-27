import { RIER, khmerDigits, months as khmerMonths, numerals as khmerNumerals } from '../strings.km.js';

/** Convert Khmer digits and common separators into a plain numeric string. */
export function normalizeAmountInput(value) {
  return String(value ?? '')
    .replace(/[០-៩]/g, (digit) => khmerDigits[digit])
    .replace(new RegExp(`[\\s,${RIER}]`, 'g'), '')
    .replace(/[^\d]/g, '');
}

/** Exact grouped digits; never goes through Number, so huge BigInt amounts stay correct. */
export function formatNumber(value) {
  let digits = String(value ?? '').trim();
  if (!/^-?\d+$/.test(digits)) {
    const numeric = Number(digits);
    if (!Number.isFinite(numeric)) return '0';
    digits = String(Math.trunc(numeric));
  }
  const negative = digits.startsWith('-');
  const body = negative ? digits.slice(1) : digits;
  return `${negative ? '-' : ''}${body.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatMoney(value) {
  return `${RIER}${formatNumber(value)}`;
}

/** Amount without the riel sign, always positive (the type carries the direction). */
export function formatPositive(value) {
  const digits = String(value ?? '').trim();
  const positive = /^-\d+$/.test(digits) ? digits.slice(1) : digits;
  return formatMoney(positive);
}

function toKhmerDigits(value) {
  return String(value).replace(/\d/g, (digit) => khmerNumerals[Number(digit)]);
}

/**
 * Plain yyyy-mm-dd strings are used as-is; they are never converted with
 * toISOString or a timestamp, so the Cambodia date never shifts by a day.
 */
function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  return { year: match[1], month: Number(match[2]), day: match[3] };
}

/** Natural Khmer date, e.g. «២៧ វិច្ឆិកា ២០២៦». */
export function formatDate(value) {
  const parts = dateParts(value);
  if (!parts) return String(value ?? '');
  const month = khmerMonths[parts.month - 1] || '';
  return `${toKhmerDigits(Number(parts.day))} ${month} ${toKhmerDigits(parts.year)}`;
}

/** Month heading for a yyyy-mm-dd date or a yyyy-mm key, e.g. «វិច្ឆិកា ២០២៦». */
export function formatMonth(value) {
  const match = /^(\d{4})-(\d{2})/.exec(String(value ?? ''));
  if (!match) return String(value ?? '');
  const month = khmerMonths[Number(match[2]) - 1] || '';
  return `${month} ${toKhmerDigits(match[1])}`;
}

/** Month bucket key for a plain yyyy-mm-dd date. */
export function monthKey(value) {
  return String(value ?? '').slice(0, 7);
}

/** Today in Cambodia, built from the calendar parts only (no UTC shift). */
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function balanceTone(direction) {
  if (direction === 'PARTNER_OWES_US') return { text: 'text-amber-900', bg: 'from-amber-50 to-orange-50', border: 'border-amber-300', dot: 'bg-amber-500' };
  if (direction === 'WE_OWE_PARTNER') return { text: 'text-sky-900', bg: 'from-sky-50 to-blue-50', border: 'border-sky-300', dot: 'bg-sky-500' };
  return { text: 'text-emerald-900', bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-300', dot: 'bg-emerald-500' };
}
