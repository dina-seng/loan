import { useMemo, useState } from 'react';
import {
  formatMoney,
  computeTotals,
  computeBorrowerSummary,
  computeMonthlyTable,
  getMonthOptions,
  normalizeBorrowerName,
} from '../utils';
import TransactionLog from './TransactionLog';

const ALL_BORROWERS = '__all_borrowers__';

export default function Dashboard({ transactions, onDelete, onRepaymentShortcut, onOpenForm }) {
  const [selectedBorrower, setSelectedBorrower] = useState(ALL_BORROWERS);
  const borrowerNames = useMemo(() => {
    const names = new Map();
    for (const transaction of transactions) {
      const name = normalizeBorrowerName(transaction.borrower);
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    }
    return [...names.values()];
  }, [transactions]);
  const activeBorrower = borrowerNames.includes(selectedBorrower)
    ? selectedBorrower
    : ALL_BORROWERS;
  const displayedTransactions = useMemo(() => (
    activeBorrower === ALL_BORROWERS
      ? transactions
      : transactions.filter(transaction =>
        normalizeBorrowerName(transaction.borrower).toLowerCase() === activeBorrower.toLowerCase(),
      )
  ), [transactions, activeBorrower]);
  const totals = useMemo(() => computeTotals(displayedTransactions), [displayedTransactions]);
  const borrowerSummary = useMemo(() => computeBorrowerSummary(displayedTransactions), [displayedTransactions]);
  const monthlyTable = useMemo(() => computeMonthlyTable(displayedTransactions), [displayedTransactions]);
  const monthOptions = useMemo(() => getMonthOptions(displayedTransactions), [displayedTransactions]);

  // Find primary owing borrower for top-level shortcut
  const primaryOwingBorrower = useMemo(() => {
    if (activeBorrower !== ALL_BORROWERS) {
      return totals.netOutstanding > 0
        ? { borrower: activeBorrower, outstanding: totals.netOutstanding }
        : null;
    }
    return borrowerSummary.find(b => b.outstanding > 0) || null;
  }, [borrowerSummary, activeBorrower, totals.netOutstanding]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="text-6xl mb-4 opacity-40">📋</div>
        <p className="text-slate-700 font-semibold text-lg mb-2">
          មិនទាន់មានទិន្នន័យ - ចុចបន្ថែមប្រតិបត្តិការដំបូង
        </p>
        <p className="text-slate-400 text-sm mb-6">
          (No data yet - tap to add first transaction)
        </p>
        <button
          onClick={() => onOpenForm()}
          className="btn-primary flex items-center gap-2 text-base shadow-md"
        >
          <span className="text-xl leading-none">+</span>
          <span>បន្ថែមប្រតិបត្តិការ (Add Transaction)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <section className="card">
        <label htmlFor="summary-borrower" className="mb-1 block text-sm font-medium text-slate-600">
          មើលសមតុល្យតាមអ្នកខ្ចី (View totals by borrower)
        </label>
        <select
          id="summary-borrower"
          value={activeBorrower}
          onChange={(event) => setSelectedBorrower(event.target.value)}
          className="input-field"
        >
          <option value={ALL_BORROWERS}>អ្នកខ្ចីទាំងអស់ (All borrowers)</option>
          {borrowerNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-500">
          {activeBorrower === ALL_BORROWERS
            ? 'បង្ហាញសរុបសម្រាប់អ្នកខ្ចីទាំងអស់ (Showing combined totals for all borrowers)'
            : `បង្ហាញតែប្រតិបត្តិការរបស់ ${activeBorrower}`}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card border-l-4 border-l-primary-500 flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              ប្រាក់បានឱ្យខ្ចីសរុប (Total Lent{activeBorrower === ALL_BORROWERS ? ' — all borrowers' : ''})
            </p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 tabular-nums">
              {formatMoney(totals.totalLent)}
            </p>
          </div>
        </div>

        <div className="card border-l-4 border-l-success-500 flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              ប្រាក់បានទទួលសងសរុប (Total Repaid{activeBorrower === ALL_BORROWERS ? ' — all borrowers' : ''})
            </p>
            <p className="text-xl sm:text-2xl font-bold text-success-600 tabular-nums">
              {formatMoney(totals.totalRepaid)}
            </p>
          </div>
        </div>

        <div className="card border-l-4 border-l-warning-500 flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              នៅជំពាក់សរុប (Outstanding{activeBorrower === ALL_BORROWERS ? ' — all borrowers' : ''})
            </p>
            <p className="text-xl sm:text-2xl font-bold text-warning-600 tabular-nums">
              {formatMoney(totals.netOutstanding)}
            </p>
          </div>
          {primaryOwingBorrower && (
            <button
              onClick={() => onRepaymentShortcut(primaryOwingBorrower.borrower, primaryOwingBorrower.outstanding)}
              className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-warning-600 hover:bg-warning-700 active:bg-warning-800 rounded-lg px-3 py-2 min-h-[44px] transition-colors shadow-sm"
              title="កត់ត្រាការសង (Record repayment)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>កត់ត្រាការសង (Record repayment)</span>
            </button>
          )}
        </div>
      </div>

      {/* Borrower Summary */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-700 mb-3">
          {activeBorrower === ALL_BORROWERS
            ? 'សង្ខេបអ្នកខ្ចីទាំងអស់ (All Borrowers Summary)'
            : `សង្ខេបអ្នកខ្ចី (Borrower Summary: ${activeBorrower})`}
        </h2>
        <div className="space-y-3 md:hidden">
          {borrowerSummary.map((b) => (
            <div key={b.borrower} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words font-semibold text-slate-800">{b.borrower}</p>
                {b.status === 'paid' ? (
                  <span className="shrink-0 rounded-full border border-success-200 bg-success-50 px-2 py-1 text-[11px] font-medium text-success-700">
                    សងរួច (Paid)
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-warning-200 bg-warning-50 px-2 py-1 text-[11px] font-medium text-warning-700">
                    នៅជំពាក់ (Owing)
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">ខ្ចី (Borrowed)</p>
                  <p className="mt-0.5 break-words tabular-nums text-slate-700">{formatMoney(b.totalBorrowed)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">សង (Repaid)</p>
                  <p className="mt-0.5 break-words tabular-nums text-success-600">{formatMoney(b.totalRepaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">នៅជំពាក់ (Owing)</p>
                  <p className="mt-0.5 break-words tabular-nums font-semibold text-slate-900">{formatMoney(b.outstanding)}</p>
                </div>
                {b.status === 'owing' && (
                  <div className="flex items-end justify-end">
                    <button
                      onClick={() => onRepaymentShortcut(b.borrower, b.outstanding)}
                      className="min-h-[44px] px-2 text-right text-xs font-medium text-primary-600 underline"
                      title="កត់ត្រាការសង (Record repayment)"
                    >
                      កត់សង (Repay)
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-slate-500 font-medium">ឈ្មោះ (Name)</th>
                <th className="text-right py-2 text-slate-500 font-medium">ខ្ចី (Borrowed)</th>
                <th className="text-right py-2 text-slate-500 font-medium">សង (Repaid)</th>
                <th className="text-right py-2 text-slate-500 font-medium">នៅជំពាក់ (Owing)</th>
                <th className="text-center py-2 text-slate-500 font-medium">ស្ថានភាព (Status)</th>
                <th className="py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {borrowerSummary.map((b) => (
                <tr key={b.borrower} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 font-medium text-slate-800">{b.borrower}</td>
                  <td className="py-3 text-right tabular-nums text-slate-700">{formatMoney(b.totalBorrowed)}</td>
                  <td className="py-3 text-right tabular-nums text-success-600">{formatMoney(b.totalRepaid)}</td>
                  <td className="py-3 text-right tabular-nums font-semibold text-slate-900">
                    {formatMoney(b.outstanding)}
                  </td>
                  <td className="py-3 text-center">
                    {b.status === 'paid' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 border border-success-200">
                        សងរួច (Paid)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 border border-warning-200">
                        នៅជំពាក់ (Owing)
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {b.status === 'owing' && (
                      <button
                        onClick={() => onRepaymentShortcut(b.borrower, b.outstanding)}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium underline 
                                   min-h-[44px] min-w-[44px] inline-flex items-center justify-end"
                        title="កត់ត្រាការសង (Record repayment)"
                      >
                        កត់សង (Repay)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-700 mb-3">
          {activeBorrower === ALL_BORROWERS
            ? 'តារាងប្រចាំខែ (Monthly Table — all borrowers)'
            : `តារាងប្រចាំខែ (${activeBorrower})`}
        </h2>
        <div className="space-y-3 md:hidden">
          {monthlyTable.map((m) => (
            <div key={m.month} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className="mb-3 font-semibold text-slate-800">{m.month}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">ឱ្យខ្ចី (Lent)</p>
                  <p className="mt-0.5 break-words tabular-nums text-slate-700">{formatMoney(m.lent)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">ទទួលសង (Repaid)</p>
                  <p className="mt-0.5 break-words tabular-nums text-success-600">{formatMoney(m.repaid)}</p>
                </div>
                <div className="col-span-2 border-t border-slate-200 pt-2">
                  <p className="text-xs text-slate-500">តុល្យភាព (Balance)</p>
                  <p className={`mt-0.5 break-words tabular-nums font-semibold ${m.balance > 0 ? 'text-warning-600' : m.balance < 0 ? 'text-success-600' : 'text-slate-600'}`}>
                    {formatMoney(m.balance)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-slate-500 font-medium">ខែ (Month)</th>
                <th className="text-right py-2 text-slate-500 font-medium">ឱ្យខ្ចី (Lent)</th>
                <th className="text-right py-2 text-slate-500 font-medium">ទទួលសង (Repaid)</th>
                <th className="text-right py-2 text-slate-500 font-medium">តុល្យភាព (Balance)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTable.map((m) => (
                <tr key={m.month} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 font-medium text-slate-800">{m.month}</td>
                  <td className="py-3 text-right tabular-nums text-slate-700">{formatMoney(m.lent)}</td>
                  <td className="py-3 text-right tabular-nums text-success-600">{formatMoney(m.repaid)}</td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    <span className={m.balance > 0 ? 'text-warning-600' : m.balance < 0 ? 'text-success-600' : 'text-slate-600'}>
                      {formatMoney(m.balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Log */}
      <TransactionLog
        transactions={displayedTransactions}
        monthOptions={monthOptions}
        onDelete={onDelete}
      />
    </div>
  );
}
