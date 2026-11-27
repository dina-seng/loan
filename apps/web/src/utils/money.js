const khmerDigits = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };

/** Convert Khmer digits and common separators into a plain numeric string. */
export function normalizeAmountInput(value) {
  return String(value ?? '')
    .replace(/[០-៩]/g, (digit) => khmerDigits[digit])
    .replace(/[\s,៛]/g, '')
    .replace(/[^\d]/g, '');
}

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number);
}

export function formatMoney(value) {
  return `៛${formatNumber(value)}`;
}

export function formatQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('km-KH', { maximumFractionDigits: 3 }).format(number);
}

const khmerMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const khmerNumerals = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

function toKhmerDigits(value) {
  return String(value).replace(/\d/g, (digit) => khmerNumerals[Number(digit)]);
}

/** Natural Khmer date, e.g. «២៧ វិច្ឆិកា ២០២៦», independent of browser locale data. */
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const month = khmerMonths[Number(get('month')) - 1] || '';
  return `${toKhmerDigits(get('day'))} ${month} ${toKhmerDigits(get('year'))}`;
}

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function balanceTone(direction) {
  if (direction === 'OUDOM_OWES_DAD') return { text: 'text-amber-900', bg: 'from-amber-50 to-orange-50', border: 'border-amber-300', dot: 'bg-amber-500' };
  if (direction === 'DAD_OWES_OUDOM') return { text: 'text-sky-900', bg: 'from-sky-50 to-blue-50', border: 'border-sky-300', dot: 'bg-sky-500' };
  return { text: 'text-emerald-900', bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-300', dot: 'bg-emerald-500' };
}
