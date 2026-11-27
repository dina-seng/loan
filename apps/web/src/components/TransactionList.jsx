import { labels } from '../i18n/labels.js';
import { formatDate, formatMoney } from '../utils/money.js';
import { EmptyState } from './Ui.jsx';

const kindLabel = {
  LENDING: labels.moneyLending,
  DELIVERY: labels.productDelivery,
  PAYMENT: labels.payment,
};

const kindStyle = {
  LENDING: 'bg-amber-50 text-amber-800',
  DELIVERY: 'bg-emerald-50 text-emerald-800',
  PAYMENT: 'bg-sky-50 text-sky-800',
};

function Amount({ entry }) {
  const positive = entry.signedAmount?.startsWith('-') === false;
  return (
    <span className={`amount whitespace-nowrap font-extrabold ${positive ? 'text-amber-800' : 'text-emerald-700'}`}>
      {positive ? '+' : '−'}{formatMoney(entry.amount)}
    </span>
  );
}

export default function TransactionList({ entries = [], onVoid, emptyMessage }) {
  if (!entries.length) return <EmptyState message={emptyMessage} />;

  return (
    <>
      {/* Phone: readable cards, no horizontal scrolling */}
      <div className="space-y-2 md:hidden">
        {entries.map((entry) => (
          <article key={entry.id} className="card flex items-start justify-between gap-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`chip ${kindStyle[entry.kind] || 'bg-slate-100 text-slate-700'}`}>{kindLabel[entry.kind] || entry.kind}</span>
                <time className="text-xs text-slate-500">{formatDate(entry.date)}</time>
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={entry.description}>{entry.description}</p>
              <p className="truncate text-xs text-slate-500">{entry.reference || entry.direction}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Amount entry={entry} />
              {onVoid && !entry.voidedAt && (
                <button type="button" onClick={() => onVoid(entry)} className="text-xs font-bold text-red-600 underline">{labels.void}</button>
              )}
              {entry.voidedAt && <span className="text-[10px] font-bold text-slate-400">{labels.void}</span>}
            </div>
          </article>
        ))}
      </div>

      {/* Tablet / desktop: structured table */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="w-28 px-4 py-3">{labels.date}</th>
              <th className="w-36 px-3 py-3">{labels.type}</th>
              <th className="px-3 py-3">{labels.description}</th>
              <th className="w-36 px-3 py-3 text-right">{labels.amount}</th>
              <th className="w-20 px-3 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(entry.date)}</td>
                <td className="px-3 py-3"><span className={`chip ${kindStyle[entry.kind] || 'bg-slate-100 text-slate-700'}`}>{kindLabel[entry.kind] || entry.kind}</span></td>
                <td className="px-3 py-3">
                  <p className="truncate font-semibold text-slate-800">{entry.description}</p>
                  <p className="truncate text-xs text-slate-500">{entry.reference || entry.direction}</p>
                </td>
                <td className="px-3 py-3 text-right"><Amount entry={entry} /></td>
                <td className="px-3 py-3 text-right">
                  {onVoid && !entry.voidedAt && (
                    <button type="button" onClick={() => onVoid(entry)} className="text-xs font-bold text-red-600 hover:underline">{labels.void}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
