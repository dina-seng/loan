import { config } from './config.js';
import { badRequest } from './errors.js';

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict YYYY-MM-DD parser. Returns a JS Date at UTC midnight (a plain calendar date for Postgres DATE). */
export function parseDate(value, field = 'date') {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ (ត្រូវជា ឆ្នាំ-ខែ-ថ្ងៃ)' });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw badRequest('VALIDATION_ERROR', { [field]: 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ' });
  }
  return date;
}

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = date instanceof Date ? new Date(date.getTime()) : parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Today in the business timezone (Cambodia by default), never UTC. */
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function assertRange(startValue, endValue) {
  const start = parseDate(startValue, 'startDate');
  const end = parseDate(endValue, 'endDate');
  if (start > end) {
    throw badRequest('VALIDATION_ERROR', { endDate: 'ថ្ងៃបញ្ចប់ត្រូវនៅក្រោយ ឬស្មើថ្ងៃចាប់ផ្តើម' });
  }
  if (end > parseDate(todayISO())) {
    throw badRequest('VALIDATION_ERROR', { endDate: 'មិនអាចបិទខួបដែលមិនទាន់ដល់ថ្ងៃនេះបានទេ' });
  }
  return { start, end };
}

export function dateWhere(field, from, to) {
  if (!from && !to) return {};
  return {
    ...(from ? { [field]: { gte: parseDate(from, 'from') } } : {}),
    ...(to ? { [field]: { lte: parseDate(to, 'to') } } : {}),
  };
}
