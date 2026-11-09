import { useState, useMemo } from 'react';
import { formatMoney, formatDate } from '../utils';

export default function TransactionLog({ transactions, monthOptions, onDelete }) {
  const [typeFilter, setTypeFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    let result = [...transactions];

    if (typeFilter !== 'All') {
      result = result.filter(t => t.type === typeFilter);
    }

    if (monthFilter !== 'All') {
      result = result.filter(t => String(t.date).substring(0, 7) === monthFilter);
    }

    // Sort by date descending, then by id for stability
    result.sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id).localeCompare(String(a.id));
    });

    return result;
  }, [transactions, typeFilter, monthFilter]);

  const handleDeleteClick = (id) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      onDelete(confirmDelete);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-slate-700 mb-3">
        កំណត់ត្រាប្រតិបត្តិការ (Transaction Log)
      </h2>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Type filter */}
        <div className="flex w-full overflow-hidden rounded-lg border border-slate-200 sm:w-auto">
          {['All', 'Lend', 'Repay'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`min-h-[44px] flex-1 px-2 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-3
                ${typeFilter === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
                }
                ${type !== 'All' ? 'border-l border-slate-200' : ''}`}
            >
              {type === 'All' ? 'ទាំងអស់' : type === 'Lend' ? 'ឱ្យខ្ចី' : 'ទទួលសង'}
            </button>
          ))}
        </div>

        {/* Month filter */}
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="input-field w-full sm:w-auto sm:min-w-[140px]"
        >
          <option value="All">រាល់ខែ (All months)</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">
          គ្មានប្រតិបត្តិការ (No transactions)
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((t) => (
              <article key={t.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-800">{t.borrower}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(t.date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium
                    ${t.type === 'Lend'
                      ? 'bg-primary-50 text-primary-700 border-primary-200'
                      : 'bg-success-50 text-success-700 border-success-200'
                    }`}>
                    {t.type === 'Lend' ? 'ឱ្យខ្ចី' : 'ទទួលសង'}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200 pt-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">ចំនួន (Amount)</p>
                    <p className={`mt-0.5 break-words tabular-nums font-semibold
                      ${t.type === 'Lend' ? 'text-primary-600' : 'text-success-600'}`}>
                      {t.type === 'Lend' ? '-' : '+'}{formatMoney(t.amount)}
                    </p>
                    {t.note && <p className="mt-1 break-words text-xs text-slate-500">{t.note}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteClick(t.id)}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="លុប (Delete)"
                    aria-label={`លុបប្រតិបត្តិការរបស់ ${t.borrower}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[550px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-slate-500 font-medium">កាលបរិច្ឆេទ (Date)</th>
                <th className="text-left py-2 text-slate-500 font-medium">ឈ្មោះ (Name)</th>
                <th className="text-center py-2 text-slate-500 font-medium">ប្រភេទ (Type)</th>
                <th className="text-right py-2 text-slate-500 font-medium">ចំនួន (Amount)</th>
                <th className="text-left py-2 text-slate-500 font-medium">កំណត់ (Note)</th>
                <th className="py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 tabular-nums text-slate-600">{formatDate(t.date)}</td>
                  <td className="py-3 font-medium">{t.borrower}</td>
                  <td className="py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                      ${t.type === 'Lend'
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'bg-success-50 text-success-700 border border-success-200'
                      }`}>
                      {t.type === 'Lend' ? 'ឱ្យខ្ចី' : 'ទទួលសង'}
                    </span>
                  </td>
                  <td className={`py-3 text-right tabular-nums font-semibold
                    ${t.type === 'Lend' ? 'text-primary-600' : 'text-success-600'}`}>
                    {t.type === 'Lend' ? '-' : '+'}{formatMoney(t.amount)}
                  </td>
                  <td className="py-3 text-slate-500 text-xs max-w-[120px] truncate">{t.note || '—'}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDeleteClick(t.id)}
                      className="text-slate-400 hover:text-red-600 min-h-[44px] min-w-[44px]
                                 inline-flex items-center justify-center transition-colors"
                      title="លុប (Delete)"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              បញ្ជាក់ការលុប (Confirm Delete)
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              តើអ្នកប្រាកដថាចង់លុបប្រតិបត្តិការនេះ? <br />
              <span className="text-slate-400">(Are you sure you want to delete this transaction?)</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-outline flex-1"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn-danger flex-1"
              >
                លុប (Delete)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
