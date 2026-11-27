import { labels } from '../i18n/labels.js';
import { formatDate, formatMoney, formatMonth, formatPositive, monthKey } from '../utils/money.js';
import { EmptyState } from './Ui.jsx';

const typeLabel = {
  LEND: labels.lend,
  PRODUCT: labels.product,
  SETTLE_IN: labels.settleIn,
  SETTLE_OUT: labels.settleOut,
};

const typeStyle = {
  LEND: 'bg-amber-50 text-amber-800',
  PRODUCT: 'bg-emerald-50 text-emerald-800',
  SETTLE_IN: 'bg-sky-50 text-sky-800',
  SETTLE_OUT: 'bg-violet-50 text-violet-800',
};

const increases = { LEND: true, PRODUCT: false, SETTLE_IN: false, SETTLE_OUT: true };

function groupByMonth(entries) {
  const groups = [];
  let current = null;
  for (const entry of entries) {
    const key = monthKey(entry.date);
    if (!current || current.key !== key) {
      current = { key, entries: [], lent: 0n, products: 0n };
      groups.push(current);
    }
    current.entries.push(entry);
    if (!entry.voidedAt && entry.type === 'LEND') current.lent += BigInt(entry.amount);
    if (!entry.voidedAt && entry.type === 'PRODUCT') current.products += BigInt(entry.amount);
  }
  return groups;
}

function Row({ entry, onDelete }) {
  const up = increases[entry.type];
  return (
    <article className={`card flex items-start justify-between gap-2 p-3 ${entry.voidedAt ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`chip ${typeStyle[entry.type] || 'bg-slate-100 text-slate-700'}`}>{typeLabel[entry.type] || entry.type}</span>
          <time className="text-xs text-slate-500">{formatDate(entry.date)}</time>
          {entry.voidedAt && <span className="text-[10px] font-bold text-slate-400">{labels.voided}</span>}
        </div>
        {entry.note && <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={entry.note}>{entry.note}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`amount whitespace-nowrap font-extrabold ${up ? 'text-amber-800' : 'text-emerald-700'}`}>
          {up ? '+' : '−'}{formatPositive(entry.amount)}
        </span>
        {onDelete && !entry.voidedAt && (
          <button type="button" onClick={() => onDelete(entry)} className="text-xs font-bold text-red-600 underline">{labels.delete}</button>
        )}
      </div>
    </article>
  );
}

/** One chronological list: newest month first, each month with its own small subtotal. */
export default function EntryList({ entries = [], onDelete, emptyMessage }) {
  if (!entries.length) return <EmptyState message={emptyMessage} />;
  const groups = groupByMonth(entries);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
            <h3 className="text-sm font-extrabold text-slate-800">{formatMonth(group.key)}</h3>
            <p className="text-[11px] font-bold text-slate-500">
              {labels.lend} {formatMoney(group.lent)} · {labels.product} {formatMoney(group.products)}
            </p>
          </div>
          <div className="space-y-2">
            {group.entries.map((entry) => <Row key={entry.id} entry={entry} onDelete={onDelete} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
