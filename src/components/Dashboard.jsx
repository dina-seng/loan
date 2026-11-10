import { useMemo, useState } from 'react';
import {
  formatMoney,
  computeTotals,
  computeBorrowerSummary,
  computeMonthlyTable,
  getMonthOptions,
  normalizeBorrowerName,
  todayStr,
  exportToCsv,
} from '../utils';
import TransactionLog from './TransactionLog';

const ALL_BORROWERS = '__all_borrowers__';

export default function Dashboard({
  transactions = [],
  products = [],
  settlements = [],
  onDeleteTransaction,
  onDeleteProduct,
  onRepaymentShortcut,
  onOpenForm,
  onOpenProductForm,
  onSettleMonth,
  onReopenMonth,
}) {
  const [selectedBorrower, setSelectedBorrower] = useState(ALL_BORROWERS);
  const [detailTab, setDetailTab] = useState('loans'); // 'loans' | 'products'

  // Product delete state
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);

  // Month settlement modal state
  const [settleModalData, setSettleModalData] = useState(null);
  const [settlePaidAmount, setSettlePaidAmount] = useState('');
  const [settleDate, setSettleDate] = useState(todayStr());
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Reopen month modal state
  const [reopenModalData, setReopenModalData] = useState(null);
  const [reopenTypedName, setReopenTypedName] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  // Merge unique borrower names from both transactions and products
  const borrowerNames = useMemo(() => {
    const names = new Map();
    for (const t of transactions) {
      const name = normalizeBorrowerName(t.borrower);
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    }
    for (const p of products) {
      const name = normalizeBorrowerName(p.borrower);
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    }
    return [...names.values()];
  }, [transactions, products]);

  const activeBorrower = borrowerNames.includes(selectedBorrower) ? selectedBorrower : ALL_BORROWERS;
  const isSpecificBorrower = activeBorrower !== ALL_BORROWERS;

  // Filter transactions for active borrower
  const displayedTransactions = useMemo(
    () =>
      isSpecificBorrower
        ? transactions.filter(
            (t) => normalizeBorrowerName(t.borrower).toLowerCase() === activeBorrower.toLowerCase(),
          )
        : transactions,
    [transactions, activeBorrower, isSpecificBorrower],
  );

  // Filter products for active borrower
  const displayedProducts = useMemo(
    () =>
      isSpecificBorrower
        ? products.filter(
            (p) => normalizeBorrowerName(p.borrower).toLowerCase() === activeBorrower.toLowerCase(),
          )
        : products,
    [products, activeBorrower, isSpecificBorrower],
  );

  // Filter settlements for active borrower
  const displayedSettlements = useMemo(
    () =>
      isSpecificBorrower
        ? settlements.filter(
            (s) => normalizeBorrowerName(s.borrower).toLowerCase() === activeBorrower.toLowerCase(),
          )
        : settlements,
    [settlements, activeBorrower, isSpecificBorrower],
  );

  // Totals computed by one shared function across transactions and products
  const totals = useMemo(
    () => computeTotals(displayedTransactions, displayedProducts),
    [displayedTransactions, displayedProducts],
  );

  const borrowerSummary = useMemo(
    () => computeBorrowerSummary(transactions, products),
    [transactions, products],
  );

  const monthlyTable = useMemo(
    () =>
      computeMonthlyTable(
        displayedTransactions,
        displayedProducts,
        displayedSettlements,
        isSpecificBorrower ? activeBorrower : null,
      ),
    [displayedTransactions, displayedProducts, displayedSettlements, isSpecificBorrower, activeBorrower],
  );

  const monthOptions = useMemo(
    () => getMonthOptions(displayedTransactions, displayedProducts),
    [displayedTransactions, displayedProducts],
  );

  // Open Month Settlement modal
  const handleOpenSettleMonth = (monthRow) => {
    const defaultPaid = Math.abs(monthRow.netBalance || monthRow.runningBalance);
    setSettleModalData({
      month: monthRow.month,
      borrower: activeBorrower,
      lent: monthRow.lent,
      repaid: monthRow.repaid,
      products: monthRow.products,
      refunded: monthRow.refunded,
      netBalance: monthRow.netBalance,
      runningBalance: monthRow.runningBalance,
    });
    setSettlePaidAmount(String(defaultPaid));
    setSettleDate(todayStr());
  };

  const handleConfirmSettleMonth = async (e) => {
    e.preventDefault();
    if (!settleModalData) return;

    const paid = Math.round(Number(settlePaidAmount) || 0);
    const balanceBefore = settleModalData.runningBalance;
    const direction =
      balanceBefore > 0
        ? 'borrower_pays_dad'
        : balanceBefore < 0
        ? 'dad_pays_borrower'
        : 'cleared';

    const carriedOver =
      direction === 'borrower_pays_dad'
        ? balanceBefore - paid
        : direction === 'dad_pays_borrower'
        ? balanceBefore + paid
        : 0;

    setSettleSubmitting(true);
    try {
      await onSettleMonth({
        month: settleModalData.month,
        borrower: settleModalData.borrower,
        balanceBefore,
        paid,
        direction,
        carriedOver,
        date: settleDate,
      });
      setSettleModalData(null);
    } catch (err) {
      alert('មិនអាចទូទាត់ខែបានទេ: ' + err.message);
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Reopen month modal handlers
  const handleOpenReopenMonth = (monthRow) => {
    setReopenModalData({
      month: monthRow.month,
      borrower: activeBorrower,
    });
    setReopenTypedName('');
  };

  const handleConfirmReopenMonth = async (e) => {
    e.preventDefault();
    if (!reopenModalData) return;

    if (
      normalizeBorrowerName(reopenTypedName).toLowerCase() !==
      normalizeBorrowerName(reopenModalData.borrower).toLowerCase()
    ) {
      alert(`សូមវាយឈ្មោះ "${reopenModalData.borrower}" ឱ្យបានត្រឹមត្រូវដើម្បីបញ្ជាក់`);
      return;
    }

    setReopenSubmitting(true);
    try {
      await onReopenMonth({
        month: reopenModalData.month,
        borrower: reopenModalData.borrower,
      });
      setReopenModalData(null);
    } catch (err) {
      alert('មិនអាចបើកខែឡើងវិញបានទេ: ' + err.message);
    } finally {
      setReopenSubmitting(false);
    }
  };

  // Export CSV Handlers
  const handleExportTransactions = () => {
    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'borrower', label: 'Borrower' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'note', label: 'Note' },
      { key: 'id', label: 'ID' },
    ];
    exportToCsv(`transactions_${todayStr()}`, displayedTransactions, headers);
  };

  const handleExportProducts = () => {
    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'borrower', label: 'Borrower' },
      { key: 'item', label: 'Item' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unitPrice', label: 'Unit Price' },
      { key: 'total', label: 'Total' },
      { key: 'note', label: 'Note' },
      { key: 'id', label: 'ID' },
    ];
    exportToCsv(`products_${todayStr()}`, displayedProducts, headers);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. BORROWER SELECTOR & ACTIONS BAR */}
      <section className="card border-primary-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label
              htmlFor="summary-borrower"
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              ជ្រើសរើសមើលតាមអ្នកខ្ចី (Select Borrower Profile)
            </label>
            <select
              id="summary-borrower"
              value={activeBorrower}
              onChange={(e) => setSelectedBorrower(e.target.value)}
              className="input-field bg-white font-medium text-slate-800"
            >
              <option value={ALL_BORROWERS}>អ្នកខ្ចីទាំងអស់ (All borrowers)</option>
              {borrowerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {!isSpecificBorrower
                ? 'បង្ហាញទិន្នន័យរួមសម្រាប់អ្នកខ្ចីទាំងអស់ (Showing overall combined data)'
                : `កំពុងមើលគណនី និងការទូទាត់របស់ ${activeBorrower}`}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-4">
            {onOpenProductForm && (
              <button
                type="button"
                onClick={() => onOpenProductForm(isSpecificBorrower ? activeBorrower : '')}
                className="btn-success text-xs sm:text-sm py-2 px-3 font-bold shadow-sm flex items-center gap-1.5"
                title="កត់ត្រាផលិតផលដែលបានទទួលពីអ្នកខ្ចី"
              >
                <span>📦</span>
                <span>+ កត់ត្រាទំនិញ</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportTransactions}
              className="btn-outline text-xs py-2 px-2.5 font-semibold bg-white hover:bg-slate-50"
              title="ទាញយកទិន្នន័យកម្ចីជា CSV"
            >
              📥 CSV កម្ចី
            </button>
            <button
              type="button"
              onClick={handleExportProducts}
              className="btn-outline text-xs py-2 px-2.5 font-semibold bg-white hover:bg-slate-50"
              title="ទាញយកទិន្នន័យទំនិញជា CSV"
            >
              📥 CSV ទំនិញ
            </button>
          </div>
        </div>
      </section>

      {/* 2. TOP SUMMARY CARDS (Total Lent, Repaid/Refunded, Products, HEADLINE SETTLEMENT) */}
      <section className="space-y-3">
        {/* PROMINENT HEADLINE SETTLEMENT CARD */}
        <div className={`rounded-2xl border-2 p-5 sm:p-6 shadow-md transition-all ${totals.status.bannerClass}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide border shadow-sm">
                <span>{totals.status.label}</span>
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-black">
                សមតុល្យទូទាត់សរុប (Settlement Balance)
              </h2>
              <p className="text-xs font-semibold opacity-80 mt-0.5">
                រូបមន្ត: ឱ្យខ្ចី ({formatMoney(totals.totalLent)}) − សង ({formatMoney(totals.totalRepaid)}) − ទំនិញ ({formatMoney(totals.totalProducts)}) + សងត្រឡប់ ({formatMoney(totals.totalRefunded)})
              </p>
            </div>

            {/* Headline Amount Display */}
            <div className="text-left sm:text-right">
              <span className="text-xs font-bold uppercase block opacity-75">
                ទឹកប្រាក់ជាក់ស្តែង
              </span>
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tight">
                {formatMoney(Math.abs(totals.balance))}
              </span>
            </div>
          </div>

          {/* Plain-Language Status Guidance */}
          <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm font-bold">
            <div className="flex-1">
              {totals.balance > 0 && (
                <p>
                  👉 {isSpecificBorrower ? <strong>{activeBorrower}</strong> : 'អ្នកខ្ចី'}{' '}
                  នៅសល់ត្រូវទូទាត់សងលោកប៉ា <span className="underline underline-offset-4">{formatMoney(totals.balance)}</span>។
                </p>
              )}
              {totals.balance < 0 && (
                <p>
                  👉 តម្លៃទំនិញលើសបំណុលកម្ចី! លោកប៉ាត្រូវបើកលុយទូទាត់ជូន{' '}
                  {isSpecificBorrower ? <strong>{activeBorrower}</strong> : 'អ្នកខ្ចី'}{' '}
                  វិញចំនួន <span className="underline underline-offset-4">{formatMoney(Math.abs(totals.balance))}</span>។
                </p>
              )}
              {totals.balance === 0 && (
                <p>
                  👉 បំណុលកម្ចី និងទំនិញបានកាត់កងស្មើគ្នា 0៛ មិនមានអ្នកណាជំពាក់អ្នកណាឡើយ។
                </p>
              )}
            </div>

            {isSpecificBorrower && totals.balance > 0 && (
              <button
                type="button"
                onClick={() => onRepaymentShortcut(activeBorrower, totals.balance)}
                className="btn-primary text-xs py-2.5 px-4 font-bold shrink-0 shadow"
              >
                កត់ត្រាការសង {formatMoney(totals.balance)}
              </button>
            )}
          </div>
        </div>

        {/* 3 Metric Sub-Cards: Total Lent, Total Repaid/Refunded, Product Value */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Card 1: Total Lent */}
          <div className="card border-l-4 border-l-amber-500 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                ប្រាក់បានឱ្យខ្ចីសរុប (Total Lent)
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-700 tabular-nums">
                {formatMoney(totals.totalLent)}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 border-t border-slate-100 pt-1.5">
              ទឹកប្រាក់សាច់ប្រាក់បានឱ្យខ្ចី
            </p>
          </div>

          {/* Card 2: Total Repaid / Refunded */}
          <div className="card border-l-4 border-l-emerald-500 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                ទទួលសង / សងត្រឡប់ (Repaid / Refunded)
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">
                {formatMoney(totals.totalRepaid)}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>សង: <strong>{formatMoney(totals.totalRepaid)}</strong></span>
              <span>សងត្រឡប់: <strong className="text-blue-600">{formatMoney(totals.totalRefunded)}</strong></span>
            </div>
          </div>

          {/* Card 3: Total Product Value */}
          <div className="card border-l-4 border-l-blue-500 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  តម្លៃទំនិញសរុប (Product Value)
                </p>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {displayedProducts.length} មុខ
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-blue-700 tabular-nums">
                {formatMoney(totals.totalProducts)}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 border-t border-slate-100 pt-1.5">
              ទំនិញបានកាត់កងបំណុល
            </p>
          </div>
        </div>
      </section>

      {/* 3. TABS: LOANS vs PRODUCTS (When a borrower is selected) */}
      {isSpecificBorrower ? (
        <div className="space-y-4">
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setDetailTab('loans')}
              className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-colors ${
                detailTab === 'loans'
                  ? 'border-primary-600 text-primary-700 bg-primary-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              ប្រតិបត្តិការកម្ចី (Loans & Payments - {displayedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('products')}
              className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-colors ${
                detailTab === 'products'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              បញ្ជីទំនិញបានទទួល (Products Supplied - {displayedProducts.length})
            </button>
          </div>

          {detailTab === 'products' ? (
            /* PRODUCTS TAB */
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  បញ្ជីទំនិញដែលបានទទួលពី {activeBorrower} (Products List)
                </h3>
                {onOpenProductForm && (
                  <button
                    type="button"
                    onClick={() => onOpenProductForm(activeBorrower)}
                    className="btn-success text-xs py-2 px-3 font-semibold"
                  >
                    + កត់ត្រាទំនិញថ្មី
                  </button>
                )}
              </div>

              {displayedProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <p>មិនទាន់មានការកត់ត្រាទំនិញពី {activeBorrower} នៅឡើយទេ</p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="space-y-2.5 sm:hidden">
                    {displayedProducts.map((p) => {
                      const itemTotal =
                        p.total != null
                          ? Number(p.total)
                          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
                      return (
                        <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-bold text-slate-800 text-sm">
                                {p.item || 'ទំនិញទូទៅ'}
                              </span>
                              <span className="block text-xs text-slate-500 mt-0.5">{p.date}</span>
                            </div>
                            <span className="font-black text-sm text-emerald-700 tabular-nums">
                              {formatMoney(itemTotal)}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div>
                              <span>បរិមាណ: </span>
                              <strong className="text-slate-800">{p.quantity}</strong>
                            </div>
                            <div>
                              <span>តម្លៃឯកតា: </span>
                              <strong className="text-slate-800">{formatMoney(p.unitPrice)}</strong>
                            </div>
                            {p.note && (
                              <div className="col-span-2 text-slate-500 italic">
                                កំណត់សម្គាល់: {p.note}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-200 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProduct(p.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-semibold py-1 px-2 rounded hover:bg-red-50"
                            >
                              លុប (Delete)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs">
                          <th className="py-2.5 text-left">កាលបរិច្ឆេទ (Date)</th>
                          <th className="py-2.5 text-left">មុខទំនិញ (Item)</th>
                          <th className="py-2.5 text-right">បរិមាណ (Quantity)</th>
                          <th className="py-2.5 text-right">តម្លៃឯកតា (Unit Price)</th>
                          <th className="py-2.5 text-right">សរុប (Total)</th>
                          <th className="py-2.5 text-left">កំណត់សម្គាល់ (Note)</th>
                          <th className="py-2.5 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedProducts.map((p) => {
                          const itemTotal =
                            p.total != null
                              ? Number(p.total)
                              : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
                          return (
                            <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="py-2.5 font-medium text-slate-700">{p.date}</td>
                              <td className="py-2.5 font-bold text-slate-800">{p.item || '—'}</td>
                              <td className="py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                                {p.quantity}
                              </td>
                              <td className="py-2.5 text-right tabular-nums text-slate-600">
                                {formatMoney(p.unitPrice)}
                              </td>
                              <td className="py-2.5 text-right font-black text-emerald-700 tabular-nums">
                                {formatMoney(itemTotal)}
                              </td>
                              <td className="py-2.5 text-slate-500 text-xs">{p.note || '—'}</td>
                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProduct(p.id)}
                                  className="text-slate-400 hover:text-red-600 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded"
                                  title="លុបទំនិញ"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 font-bold">
                          <td colSpan="4" className="py-3 text-right text-slate-700">
                            តម្លៃសរុប (Total Value):
                          </td>
                          <td className="py-3 text-right text-emerald-700 text-base tabular-nums">
                            {formatMoney(totals.totalProducts)}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* LOAN TRANSACTIONS */
            <TransactionLog
              transactions={displayedTransactions}
              monthOptions={monthOptions}
              onDelete={onDeleteTransaction}
            />
          )}
        </div>
      ) : (
        /* ALL BORROWERS SUMMARY TABLE */
        <div className="card">
          <h2 className="text-base font-bold text-slate-800 mb-3">
            សង្ខេបអ្នកខ្ចីទាំងអស់ និងសមតុល្យទូទាត់ (All Borrowers Settlement Summary)
          </h2>

          <div className="space-y-3 md:hidden">
            {borrowerSummary.map((b) => (
              <div key={b.borrower} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedBorrower(b.borrower)}
                    className="text-left font-bold text-slate-800 hover:text-primary-600 underline"
                  >
                    {b.borrower}
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${b.statusInfo.badgeClass}`}>
                    {b.statusInfo.shortLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">ឱ្យខ្ចីសរុប:</span>
                    <p className="font-semibold text-slate-800 tabular-nums">{formatMoney(b.totalLent)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">ទទួលសង:</span>
                    <p className="font-semibold text-emerald-700 tabular-nums">{formatMoney(b.totalRepaid)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">ទំនិញបានទទួល:</span>
                    <p className="font-semibold text-blue-700 tabular-nums">{formatMoney(b.totalProducts)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">សងត្រឡប់:</span>
                    <p className="font-semibold text-blue-600 tabular-nums">{formatMoney(b.totalRefunded || 0)}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">សមតុល្យទូទាត់:</span>
                    <span className="text-sm font-black text-slate-900 tabular-nums">
                      {formatMoney(Math.abs(b.balance))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2.5 font-semibold">ឈ្មោះអ្នកខ្ចី</th>
                  <th className="text-right py-2.5 font-semibold">ឱ្យខ្ចី (Lent)</th>
                  <th className="text-right py-2.5 font-semibold">ទទួលសង (Repaid)</th>
                  <th className="text-right py-2.5 font-semibold">ទំនិញ (Products)</th>
                  <th className="text-right py-2.5 font-semibold">សងត្រឡប់ (Refund)</th>
                  <th className="text-right py-2.5 font-black text-slate-900">សមតុល្យទូទាត់</th>
                  <th className="text-center py-2.5 font-semibold">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody>
                {borrowerSummary.map((b) => (
                  <tr key={b.borrower} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 font-bold text-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedBorrower(b.borrower)}
                        className="hover:text-primary-600 underline"
                      >
                        {b.borrower}
                      </button>
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700">{formatMoney(b.totalLent)}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-600">{formatMoney(b.totalRepaid)}</td>
                    <td className="py-3 text-right tabular-nums text-blue-700 font-semibold">{formatMoney(b.totalProducts)}</td>
                    <td className="py-3 text-right tabular-nums text-blue-600">{formatMoney(b.totalRefunded || 0)}</td>
                    <td className="py-3 text-right tabular-nums font-black text-slate-900">{formatMoney(Math.abs(b.balance))}</td>
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${b.statusInfo.badgeClass}`}>
                        {b.statusInfo.shortLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. EXPANDED MONTHLY TABLE WITH RUNNING BALANCE & SETTLEMENT */}
      <section className="card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              តារាងប្រចាំខែ (Monthly Table: Lent, Repaid, Products, Refunded, Net & Running Balance)
            </h2>
            <p className="text-xs text-slate-500">
              {isSpecificBorrower ? `ទិន្នន័យសម្រាប់ ${activeBorrower}` : 'ទិន្នន័យសរុបរាល់ខែ'}
            </p>
          </div>
        </div>

        {/* Mobile View */}
        <div className="space-y-3 md:hidden">
          {monthlyTable.map((m) => (
            <div key={m.month} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{m.month}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                    m.isSettled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {m.statusKhmer}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">ឱ្យខ្ចី (Lent):</span>
                  <p className="font-semibold text-slate-700 tabular-nums">{formatMoney(m.lent)}</p>
                </div>
                <div>
                  <span className="text-slate-500">ទទួលសង (Repaid):</span>
                  <p className="font-semibold text-emerald-600 tabular-nums">{formatMoney(m.repaid)}</p>
                </div>
                <div>
                  <span className="text-slate-500">ទំនិញ (Products):</span>
                  <p className="font-semibold text-blue-600 tabular-nums">{formatMoney(m.products)}</p>
                </div>
                <div>
                  <span className="text-slate-500">សងត្រឡប់ (Refunded):</span>
                  <p className="font-semibold text-blue-600 tabular-nums">{formatMoney(m.refunded)}</p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500">សមតុល្យខែ (Net Month):</span>
                  <p className="font-bold text-slate-900 tabular-nums">{formatMoney(m.netBalance)}</p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500">សមតុល្យបន្ត (Running):</span>
                  <p className="font-black text-primary-700 tabular-nums">{formatMoney(m.runningBalance)}</p>
                </div>
              </div>

              {isSpecificBorrower && (
                <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                  {!m.isSettled ? (
                    <button
                      type="button"
                      onClick={() => handleOpenSettleMonth(m)}
                      className="btn-primary text-xs py-1.5 px-3 font-semibold"
                    >
                      ទូទាត់ខែ (Settle month)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenReopenMonth(m)}
                      className="btn-outline text-xs py-1.5 px-3 font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      បើកខែឡើងវិញ (Reopen month)
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="py-2.5 text-left font-semibold">ខែ (Month)</th>
                <th className="py-2.5 text-right font-semibold">ឱ្យខ្ចី (Lent)</th>
                <th className="py-2.5 text-right font-semibold">ទទួលសង (Repaid)</th>
                <th className="py-2.5 text-right font-semibold">ទំនិញ (Products)</th>
                <th className="py-2.5 text-right font-semibold">សងត្រឡប់ (Refunded)</th>
                <th className="py-2.5 text-right font-bold text-slate-800">សមតុល្យខែ (Net)</th>
                <th className="py-2.5 text-right font-black text-primary-700">សមតុល្យបន្ត (Running)</th>
                <th className="py-2.5 text-center font-semibold">ស្ថានភាព</th>
                {isSpecificBorrower && <th className="py-2.5 text-right font-semibold">សកម្មភាព</th>}
              </tr>
            </thead>
            <tbody>
              {monthlyTable.map((m) => (
                <tr key={m.month} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="py-3 font-bold text-slate-800">{m.month}</td>
                  <td className="py-3 text-right tabular-nums text-slate-700">{formatMoney(m.lent)}</td>
                  <td className="py-3 text-right tabular-nums text-emerald-600">{formatMoney(m.repaid)}</td>
                  <td className="py-3 text-right tabular-nums text-blue-600">{formatMoney(m.products)}</td>
                  <td className="py-3 text-right tabular-nums text-blue-600">{formatMoney(m.refunded)}</td>
                  <td className="py-3 text-right tabular-nums font-bold text-slate-900">{formatMoney(m.netBalance)}</td>
                  <td className="py-3 text-right tabular-nums font-black text-primary-700">{formatMoney(m.runningBalance)}</td>
                  <td className="py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                        m.isSettled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {m.statusKhmer}
                    </span>
                  </td>
                  {isSpecificBorrower && (
                    <td className="py-3 text-right">
                      {!m.isSettled ? (
                        <button
                          type="button"
                          onClick={() => handleOpenSettleMonth(m)}
                          className="btn-primary text-xs py-1 px-2.5 font-bold"
                        >
                          ទូទាត់ខែ
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenReopenMonth(m)}
                          className="text-xs text-amber-700 hover:text-amber-900 font-bold underline py-1 px-2"
                        >
                          បើកឡើងវិញ
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. OVERALL TRANSACTION LOG (When all borrowers are viewed) */}
      {!isSpecificBorrower && (
        <TransactionLog
          transactions={displayedTransactions}
          monthOptions={monthOptions}
          onDelete={onDeleteTransaction}
        />
      )}

      {/* MODAL: Settle Month */}
      {settleModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  ទូទាត់ប្រចាំខែ {settleModalData.month} (Settle Month)
                </h3>
                <p className="text-xs text-slate-500">អ្នកខ្ចី: {settleModalData.borrower}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalData(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Breakdown */}
            <div className="rounded-xl bg-slate-50 p-3.5 space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">ឱ្យខ្ចី (Loans):</span>
                <span className="font-semibold text-slate-800">{formatMoney(settleModalData.lent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ទទួលសង (Repayments):</span>
                <span className="font-semibold text-emerald-700">{formatMoney(settleModalData.repaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">តម្លៃទំនិញ (Products):</span>
                <span className="font-semibold text-blue-700">{formatMoney(settleModalData.products)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">សងត្រឡប់ (Refunds):</span>
                <span className="font-semibold text-blue-700">{formatMoney(settleModalData.refunded)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm">
                <span>សមតុល្យត្រូវទូទាត់:</span>
                <span className={settleModalData.runningBalance >= 0 ? 'text-amber-700' : 'text-blue-700'}>
                  {formatMoney(Math.abs(settleModalData.runningBalance))}
                  {settleModalData.runningBalance > 0
                    ? ' (អ្នកខ្ចីសងលោកប៉ា)'
                    : settleModalData.runningBalance < 0
                    ? ' (លោកប៉ាសងអ្នកខ្ចី)'
                    : ' (ស្មើគ្នា)'}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettleMonth} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ចំនួនទឹកប្រាក់ទូទាត់ជាក់ស្តែង (Actual Paid Amount - ៛)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={settlePaidAmount}
                  onChange={(e) => setSettlePaidAmount(e.target.value)}
                  className="input-field text-base font-bold tabular-nums"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  ប្រសិនបើបង់តិចជាងសមតុល្យ ចំនួនដែលនៅសល់នឹងត្រូវបន្តទៅខែបន្ទាប់ដោយស្វ័យប្រវត្តិ (Carried over)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  កាលបរិច្ឆេទនៃការទូទាត់ (Settlement Date)
                </label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="input-field text-sm font-medium"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSettleModalData(null)}
                  className="btn-outline flex-1 text-sm py-2.5"
                  disabled={settleSubmitting}
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={settleSubmitting}
                  className="btn-primary flex-1 text-sm py-2.5 font-bold"
                >
                  {settleSubmitting ? 'កំពុងទូទាត់...' : 'បញ្ជាក់ការទូទាត់ (Confirm)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reopen Month (Requires typing borrower name) */}
      {reopenModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-amber-900">
                ⚠️ បញ្ជាក់ការបើកខែ {reopenModalData.month} ឡើងវិញ (Reopen Month)
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                ការបើកខែឡើងវិញ នឹងដោះសោការបន្ថែម ឬលុបប្រតិបត្តិការក្នុងខែនេះ។
              </p>
            </div>

            <form onSubmit={handleConfirmReopenMonth} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  សូមវាយឈ្មោះអ្នកខ្ចី <strong className="text-slate-900">"{reopenModalData.borrower}"</strong> ដើម្បីបញ្ជាក់:
                </label>
                <input
                  type="text"
                  value={reopenTypedName}
                  onChange={(e) => setReopenTypedName(e.target.value)}
                  placeholder={`វាយ "${reopenModalData.borrower}"`}
                  className="input-field text-sm font-bold"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReopenModalData(null)}
                  className="btn-outline flex-1 text-sm py-2.5"
                  disabled={reopenSubmitting}
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={
                    reopenSubmitting ||
                    normalizeBorrowerName(reopenTypedName).toLowerCase() !==
                      normalizeBorrowerName(reopenModalData.borrower).toLowerCase()
                  }
                  className="btn-danger flex-1 text-sm py-2.5 font-bold disabled:opacity-40"
                >
                  {reopenSubmitting ? 'កំពុងបើកឡើងវិញ...' : 'បើកខែឡើងវិញ (Reopen)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Product Confirmation */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              បញ្ជាក់ការលុបទំនិញ (Confirm Delete Product)
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              តើអ្នកប្រាកដថាចង់លុបទំនិញនេះមែនទេ? តម្លៃទំនិញនឹងលែងត្រូវកាត់កងបំណុលទៀតហើយ។
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(null)}
                className="btn-outline flex-1"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(confirmDeleteProduct);
                  setConfirmDeleteProduct(null);
                }}
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
