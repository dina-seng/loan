import { useMemo, useState, useEffect } from 'react';
import {
  formatMoney,
  normalizeBorrowerName,
  todayStr,
  normalizeDate,
  formatDate,
  isRecordSettled,
  computeBorrowerSummary,
} from '../utils';
import UnifiedTimeline from './UnifiedTimeline';
import {
  BanknoteIcon,
  PackageIcon,
  PlusIcon,
  CheckIcon,
  CheckCircleIcon,
  CalendarIcon,
  ArchiveIcon,
  EyeIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  XIcon,
} from './Icons';

const ALL_BORROWERS = '__all_borrowers__';

export default function Dashboard({
  transactions = [],
  products = [],
  settlements = [],
  onDeleteTransaction,
  onDeleteProduct,
  onOpenEntryModal,
  onSettleMonth,
  onReopenMonth,
}) {
  const [selectedBorrower, setSelectedBorrower] = useState(ALL_BORROWERS);

  const [inspectingArchive, setInspectingArchive] = useState(null);

  // Settlement modal state
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleBorrower, setSettleBorrower] = useState('');
  const [settlePaidAmount, setSettlePaidAmount] = useState('');
  const [settleDate, setSettleDate] = useState(todayStr());
  const [settleMonthValue, setSettleMonthValue] = useState(todayStr().slice(0, 7));
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Reopen month modal state
  const [reopenModalData, setReopenModalData] = useState(null);
  const [reopenTypedName, setReopenTypedName] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  // Merge unique borrower names from both transactions and products
  const borrowerNames = useMemo(() => {
    const names = new Map();
    for (const t of transactions) {
      const name = normalizeBorrowerName(t.borrower);
      if (name && !names.has(name.toLowerCase())) {
        names.set(name.toLowerCase(), name);
      }
    }
    for (const p of products) {
      const name = normalizeBorrowerName(p.borrower);
      if (name && !names.has(name.toLowerCase())) {
        names.set(name.toLowerCase(), name);
      }
    }
    return [...names.values()];
  }, [transactions, products]);

  const activeBorrower = borrowerNames.includes(selectedBorrower)
    ? selectedBorrower
    : ALL_BORROWERS;
  const isSpecificBorrower = activeBorrower !== ALL_BORROWERS;
  const targetName = isSpecificBorrower ? activeBorrower : 'អ្នកខ្ចី';

  // Filter transactions and products for selected borrower
  const displayedTransactions = useMemo(
    () =>
      isSpecificBorrower
        ? transactions.filter(
          (t) =>
            normalizeBorrowerName(t.borrower).toLowerCase() ===
            activeBorrower.toLowerCase(),
        )
        : transactions,
    [transactions, activeBorrower, isSpecificBorrower],
  );

  const displayedProducts = useMemo(
    () =>
      isSpecificBorrower
        ? products.filter(
          (p) =>
            normalizeBorrowerName(p.borrower).toLowerCase() ===
            activeBorrower.toLowerCase(),
        )
        : products,
    [products, activeBorrower, isSpecificBorrower],
  );

  const displayedSettlements = useMemo(
    () =>
      isSpecificBorrower
        ? settlements.filter(
          (s) =>
            normalizeBorrowerName(s.borrower).toLowerCase() ===
            activeBorrower.toLowerCase(),
        )
        : settlements,
    [settlements, activeBorrower, isSpecificBorrower],
  );

  // ACTIVE (UNSETTLED) RECORDS for the current active period
  const activeTransactions = useMemo(() => {
    return displayedTransactions.filter(
      (t) => t.type === 'Lend' && !t.settled && !isRecordSettled(t, settlements),
    );
  }, [displayedTransactions, settlements]);

  const activeProducts = useMemo(() => {
    return displayedProducts.filter(
      (p) => !p.settled && !isRecordSettled(p, settlements),
    );
  }, [displayedProducts, settlements]);

  // Core 2 Metrics: Total Active Lent & Total Active Goods
  const totalActiveLent = useMemo(() => {
    return activeTransactions.reduce(
      (sum, t) => sum + (Number(t.amount) || 0),
      0,
    );
  }, [activeTransactions]);

  const activeLentCount = activeTransactions.length;

  const totalActiveGoods = useMemo(() => {
    return activeProducts.reduce((sum, p) => {
      const itemTotal =
        p.total != null && !isNaN(p.total)
          ? Number(p.total)
          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
      return sum + itemTotal;
    }, 0);
  }, [activeProducts]);

  const activeProductsCount = activeProducts.length;

  // Exact 2-Variable Difference: Total Active Lent - Total Active Goods
  const difference = totalActiveLent - totalActiveGoods;

  // Active months detected from unsettled records
  const activeMonths = useMemo(() => {
    const set = new Set();
    for (const t of activeTransactions) {
      const m = normalizeDate(t.date).slice(0, 7);
      if (m) set.add(m);
    }
    for (const p of activeProducts) {
      const m = normalizeDate(p.date).slice(0, 7);
      if (m) set.add(m);
    }
    const arr = [...set].sort();
    return arr.length > 0 ? arr : [todayStr().slice(0, 7)];
  }, [activeTransactions, activeProducts]);

  const targetBorrower = isSpecificBorrower ? activeBorrower : settleBorrower;
  const targetMonth = settleMonthValue || todayStr().slice(0, 7);

  // Available months for targetBorrower (with transactions/products or current month)
  const borrowerAvailableMonths = useMemo(() => {
    if (!targetBorrower) return [todayStr().slice(0, 7)];
    const bLower = normalizeBorrowerName(targetBorrower).toLowerCase();
    const set = new Set();
    for (const t of transactions) {
      if (normalizeBorrowerName(t.borrower).toLowerCase() === bLower) {
        const m = normalizeDate(t.date).slice(0, 7);
        if (m && /^\d{4}-\d{2}$/.test(m)) set.add(m);
      }
    }
    for (const p of products) {
      if (normalizeBorrowerName(p.borrower).toLowerCase() === bLower) {
        const m = normalizeDate(p.date).slice(0, 7);
        if (m && /^\d{4}-\d{2}$/.test(m)) set.add(m);
      }
    }
    set.add(todayStr().slice(0, 7));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [targetBorrower, transactions, products]);

  // Check if targetMonth is already recorded in settlements for targetBorrower
  const isAlreadySettled = useMemo(() => {
    if (!targetBorrower || !targetMonth) return false;
    const bLower = normalizeBorrowerName(targetBorrower).toLowerCase();
    return settlements.some(
      (s) =>
        String(s.month || '').trim() === targetMonth &&
        normalizeBorrowerName(s.borrower).toLowerCase() === bLower,
    );
  }, [targetBorrower, targetMonth, settlements]);

  // Unsettled records strictly for targetBorrower in targetMonth
  const modalMonthActiveTransactions = useMemo(() => {
    if (!targetBorrower || !targetMonth) return [];
    const bLower = normalizeBorrowerName(targetBorrower).toLowerCase();
    const isAll = bLower === 'all' || bLower === '__all__' || bLower === 'បង្ហាញទាំងអស់' || bLower === 'ទាំងអស់';
    return transactions.filter(
      (t) =>
        (isAll || normalizeBorrowerName(t.borrower).toLowerCase() === bLower) &&
        normalizeDate(t.date).slice(0, 7) === targetMonth &&
        t.type === 'Lend' &&
        !t.settled &&
        !isRecordSettled(t, settlements),
    );
  }, [targetBorrower, targetMonth, transactions, settlements]);

  const modalMonthActiveProducts = useMemo(() => {
    if (!targetBorrower || !targetMonth) return [];
    const bLower = normalizeBorrowerName(targetBorrower).toLowerCase();
    const isAll = bLower === 'all' || bLower === '__all__' || bLower === 'បង្ហាញទាំងអស់' || bLower === 'ទាំងអស់';
    return products.filter(
      (p) =>
        (isAll || normalizeBorrowerName(p.borrower).toLowerCase() === bLower) &&
        normalizeDate(p.date).slice(0, 7) === targetMonth &&
        !p.settled &&
        !isRecordSettled(p, settlements),
    );
  }, [targetBorrower, targetMonth, products, settlements]);

  const modalTotalLent = useMemo(() => {
    return modalMonthActiveTransactions.reduce(
      (sum, t) => sum + (Number(t.amount) || 0),
      0,
    );
  }, [modalMonthActiveTransactions]);

  const modalTotalGoods = useMemo(() => {
    return modalMonthActiveProducts.reduce((sum, p) => {
      const itemTotal =
        p.total != null && !isNaN(p.total)
          ? Number(p.total)
          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
      return sum + itemTotal;
    }, 0);
  }, [modalMonthActiveProducts]);

  const modalNetBalance = modalTotalLent - modalTotalGoods;
  const isEmptyMonth = modalTotalLent === 0 && modalTotalGoods === 0;
  const canSettle = !isAlreadySettled && !isEmptyMonth && !!targetBorrower;

  const modalDirection =
    modalNetBalance > 0
      ? 'borrower_pays_dad'
      : modalNetBalance < 0
        ? 'dad_pays_borrower'
        : 'cleared';

  // Automatically synchronize settlePaidAmount whenever person, month, or balance changes
  useEffect(() => {
    if (showSettleModal) {
      setSettlePaidAmount(String(Math.abs(modalNetBalance)));
    }
  }, [showSettleModal, targetBorrower, targetMonth, modalNetBalance]);

  // Open the Settlement Modal with exact active numbers pre-filled
  const handleOpenSettleModal = () => {
    let initialBorrower = isSpecificBorrower ? activeBorrower : '';
    if (!initialBorrower && borrowerNames.length > 0) {
      initialBorrower = borrowerNames[0];
    }
    setSettleBorrower(initialBorrower);

    // Find newest unsettled month for this borrower
    const bLower = normalizeBorrowerName(initialBorrower).toLowerCase();
    const months = new Set();
    for (const t of transactions) {
      if (
        normalizeBorrowerName(t.borrower).toLowerCase() === bLower &&
        t.type === 'Lend' &&
        !isRecordSettled(t, settlements)
      ) {
        const m = normalizeDate(t.date).slice(0, 7);
        if (m) months.add(m);
      }
    }
    for (const p of products) {
      if (
        normalizeBorrowerName(p.borrower).toLowerCase() === bLower &&
        !isRecordSettled(p, settlements)
      ) {
        const m = normalizeDate(p.date).slice(0, 7);
        if (m) months.add(m);
      }
    }
    const sorted = [...months].sort((a, b) => b.localeCompare(a));
    const initialMonth = sorted[0] || todayStr().slice(0, 7);

    setSettleMonthValue(initialMonth);
    setSettleDate(todayStr());
    setShowSettleModal(true);
  };

  const handleSettleBorrowerChange = (newBorrower) => {
    setSettleBorrower(newBorrower);
    const bLower = normalizeBorrowerName(newBorrower).toLowerCase();
    const months = new Set();
    for (const t of transactions) {
      if (
        normalizeBorrowerName(t.borrower).toLowerCase() === bLower &&
        t.type === 'Lend' &&
        !isRecordSettled(t, settlements)
      ) {
        const m = normalizeDate(t.date).slice(0, 7);
        if (m) months.add(m);
      }
    }
    for (const p of products) {
      if (
        normalizeBorrowerName(p.borrower).toLowerCase() === bLower &&
        !isRecordSettled(p, settlements)
      ) {
        const m = normalizeDate(p.date).slice(0, 7);
        if (m) months.add(m);
      }
    }
    const sorted = [...months].sort((a, b) => b.localeCompare(a));
    const initialMonth = sorted[0] || todayStr().slice(0, 7);
    setSettleMonthValue(initialMonth);
  };

  // Confirm and Execute Month Settlement
  const handleConfirmSettleMonth = async (e) => {
    e.preventDefault();
    if (!canSettle) return;

    const validMonth = (
      /^\d{4}-\d{2}$/.test(targetMonth)
        ? targetMonth
        : (settleDate || todayStr()).slice(0, 7)
    ).trim();

    const validDate = (
      /^\d{4}-\d{2}-\d{2}$/.test(settleDate)
        ? settleDate
        : todayStr()
    ).trim();

    const paid = Math.round(Number(settlePaidAmount) || 0);

    setSettleSubmitting(true);
    try {
      await onSettleMonth({
        month: validMonth,
        borrower: targetBorrower,
        totalLent: modalTotalLent,
        totalGoods: modalTotalGoods,
        paid,
        direction: modalDirection,
        date: validDate,
      });
      setShowSettleModal(false);
      setToastMessage('បានទូទាត់បិទបញ្ជីខែនេះរួចរាល់!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      alert('មិនអាចទូទាត់បានទេ: ' + err.message);
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Reopen Month Handlers
  const handleOpenReopenMonth = (monthRow) => {
    setReopenModalData({
      id: monthRow.id,
      month: monthRow.month,
      borrower: monthRow.borrower || activeBorrower,
    });
    setReopenTypedName('');
  };

  const handleConfirmReopenMonth = async (e) => {
    e.preventDefault();
    if (!reopenModalData) return;

    const bTarget = normalizeBorrowerName(reopenModalData.borrower).toLowerCase();
    const isAll = bTarget === 'all' || bTarget === '__all__' || bTarget === 'បង្ហាញទាំងអស់' || bTarget === 'ទាំងអស់';

    if (
      !isAll &&
      normalizeBorrowerName(reopenTypedName).toLowerCase() !== bTarget
    ) {
      alert(`សូមវាយឈ្មោះ "${reopenModalData.borrower}" ឱ្យបានត្រឹមត្រូវ`);
      return;
    }

    setReopenSubmitting(true);
    try {
      await onReopenMonth({
        id: reopenModalData.id,
        month: reopenModalData.month,
        borrower: reopenModalData.borrower,
      });
      setReopenModalData(null);
      setInspectingArchive(null);
      setToastMessage('បានបើកខែឡើងវិញរួចរាល់!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      alert('មិនអាចបើកខែឡើងវិញបានទេ: ' + err.message);
    } finally {
      setReopenSubmitting(false);
    }
  };

  // Archived settled months summary list
  const archivedSettlements = useMemo(() => {
    return displayedSettlements.map((s) => {
      const m = String(s.month || '').trim();
      const b = normalizeBorrowerName(s.borrower).toLowerCase();
      const isAll = !b || b === 'all' || b === '__all__' || b === 'បង្ហាញទាំងអស់' || b === 'ទាំងអស់';

      // Find archived loans in this month
      const monthLoans = transactions.filter(
        (t) =>
          t.type === 'Lend' &&
          normalizeDate(t.date).slice(0, 7) === m &&
          (isAll || normalizeBorrowerName(t.borrower).toLowerCase() === b),
      );
      const totalLent =
        s.totalLent != null && !isNaN(s.totalLent)
          ? Number(s.totalLent)
          : monthLoans.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      // Find archived goods in this month
      const monthGoods = products.filter(
        (p) =>
          normalizeDate(p.date).slice(0, 7) === m &&
          (isAll || normalizeBorrowerName(p.borrower).toLowerCase() === b),
      );
      const totalGoods =
        s.totalGoods != null && !isNaN(s.totalGoods)
          ? Number(s.totalGoods)
          : monthGoods.reduce((sum, p) => {
              const itemTotal =
                p.total != null && !isNaN(p.total)
                  ? Number(p.total)
                  : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
              return sum + itemTotal;
            }, 0);

      const paid =
        s.paid != null && !isNaN(s.paid)
          ? Number(s.paid)
          : Math.abs(totalLent - totalGoods);

      return {
        id: s.id,
        month: m,
        borrower: s.borrower || 'បង្ហាញទាំងអស់',
        totalLent,
        totalGoods,
        paid,
        balanceBefore: s.balanceBefore,
        direction: s.direction,
        date: formatDate(s.date) || s.date || '-',
        status: s.status || 'ទូទាត់រួចរាល់',
        records: {
          loans: monthLoans,
          goods: monthGoods,
        },
      };
    });
  }, [displayedSettlements, transactions, products]);

  // Overall summary for all borrowers
  const borrowerSummary = useMemo(
    () => computeBorrowerSummary(transactions, products),
    [transactions, products],
  );

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm sm:text-base border border-emerald-700 animate-fade-in">
          <CheckIcon className="w-5 h-5 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}
      {/* 1. PERSON SELECTOR & UNIFIED ACTION BAR */}
      <section className="card p-4 sm:p-5 border-slate-200 shadow-sm rounded-3xl bg-white">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1">
            <label
              htmlFor="person-selector"
              className="mb-1.5 block text-base sm:text-lg font-black text-slate-800"
            >
              ជ្រើសរើសឈ្មោះ
            </label>
            <select
              id="person-selector"
              value={activeBorrower}
              onChange={(e) => setSelectedBorrower(e.target.value)}
              className="input-field text-base sm:text-lg font-bold text-slate-800 bg-white min-h-[48px]"
            >
              <option value={ALL_BORROWERS}>បង្ហាញទាំងអស់</option>
              {borrowerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* ONE large primary action button */}
          <button
            type="button"
            onClick={() =>
              onOpenEntryModal(isSpecificBorrower ? activeBorrower : '', 'lend')
            }
            className="btn-primary min-h-[48px] px-6 text-base sm:text-lg font-black shadow-md hover:shadow-lg flex items-center justify-center gap-2 rounded-2xl"
          >
            <PlusIcon className="w-5 h-5" />
            <span>កត់ត្រាថ្មី</span>
          </button>
        </div>
      </section>

      {/* 2. SUMMARY DASHBOARD LAYOUT (STRICT 1-OVER-2 GRID) */}
      <section className="space-y-4">
        {/* TOP ROW: Full-Width Card (Active Balance) */}
        <div
          className={`rounded-3xl border-2 p-5 sm:p-7 shadow-md transition-all ${difference > 0
              ? 'bg-amber-50/95 border-amber-400 text-amber-950'
              : difference < 0
                ? 'bg-blue-50/95 border-blue-400 text-blue-950'
                : 'bg-emerald-50/95 border-emerald-400 text-emerald-950'
            }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-5">
            <div>
              {/* Status Badge */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs sm:text-sm font-black border shadow-sm ${difference > 0
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : difference < 0
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
              >
                {difference > 0 && <BanknoteIcon className="w-4 h-4" />}
                {difference < 0 && <PackageIcon className="w-4 h-4" />}
                {difference === 0 && <CheckIcon className="w-4 h-4" />}
                <span>
                  {difference > 0
                    ? `${targetName} នៅជំពាក់ប៉ា`
                    : difference < 0
                      ? `ប៉ាត្រូវបង់លុយឱ្យ ${targetName} បន្ថែម`
                      : 'ទូទាត់រួចរាល់'}
                </span>
              </div>

              {/* Title */}
              <h2 className="mt-2.5 text-xl sm:text-2xl font-black">
                {difference > 0
                  ? `លុយនៅសល់ត្រូវទារពី ${targetName}`
                  : difference < 0
                    ? `លុយប៉ាត្រូវទូទាត់ឱ្យ ${targetName}`
                    : 'សមតុល្យនៅសល់'}
              </h2>
            </div>

            {/* Large Bold KHR Amount */}
            <div className="text-left sm:text-right">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tight">
                {formatMoney(Math.abs(difference))}
              </span>
            </div>
          </div>

          {/* Plain Khmer Explanation & Secondary Settlement Button */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-base sm:text-lg font-bold">
            <div className="flex-1">
              {difference > 0 && (
                <p>
                  ថ្លៃទំនិញតិចជាងលុយខ្ចី! {targetName} នៅជំពាក់លុយប៉ាចំនួន{' '}
                  <span className="underline underline-offset-4 font-black">
                    {formatMoney(difference)}
                  </span>
                </p>
              )}
              {difference < 0 && (
                <p>
                  ថ្លៃទំនិញលើសលុយខ្ចី! ប៉ាត្រូវបើកលុយឱ្យ {targetName} ចំនួន{' '}
                  <span className="underline underline-offset-4 font-black">
                    {formatMoney(Math.abs(difference))}
                  </span>
                </p>
              )}
              {difference === 0 && (
                <p>បានទូទាត់រួចរាល់ស្មើគ្នា មិនមានជំពាក់គ្នាទេ</p>
              )}
            </div>

            {/* Secondary Button: End-of-Month Settlement (visible only when active balance !== 0) */}
            {difference !== 0 && (
              <button
                type="button"
                onClick={handleOpenSettleModal}
                className="btn-outline min-h-[44px] px-4 py-2 font-black text-sm sm:text-base flex items-center gap-2 rounded-2xl bg-white shadow-sm border-slate-300 hover:bg-slate-50 transition-all text-slate-800 shrink-0"
              >
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <span>ទូទាត់បិទបញ្ជីខែនេះ</span>
              </button>
            )}
          </div>
        </div>

        {/* BOTTOM ROW: 2 Equal Columns (50% / 50% Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column (50% width): Total Active Lent */}
          <div className="card border-l-4 border-l-amber-500 bg-white shadow-sm p-5 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-slate-700">
                <BanknoteIcon className="w-5 h-5 text-amber-600" />
                <p className="text-base sm:text-lg font-black text-slate-800">
                  លុយប៉ាឱ្យខ្ចីសរុប
                </p>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-amber-700 tabular-nums">
                {formatMoney(totalActiveLent)}
              </p>
            </div>
            <p className="mt-3 text-xs sm:text-sm font-bold text-slate-500 border-t border-slate-100 pt-2">
              សរុប {activeLentCount} លើក
            </p>
          </div>

          {/* Right Column (50% width): Total Active Goods */}
          <div className="card border-l-4 border-l-emerald-500 bg-white shadow-sm p-5 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-slate-700">
                <PackageIcon className="w-5 h-5 text-emerald-600" />
                <p className="text-base sm:text-lg font-black text-slate-800">
                  សរុបថ្លៃទំនិញយកចូល
                </p>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums">
                {formatMoney(totalActiveGoods)}
              </p>
            </div>
            <p className="mt-3 text-xs sm:text-sm font-bold text-slate-500 border-t border-slate-100 pt-2">
              សរុប {activeProductsCount} លើក
            </p>
          </div>
        </div>
      </section>

      {/* 3. ACTIVE DAILY TIMELINE (Focused ONLY on Current Unsettled Month) */}
      <section>
        <UnifiedTimeline
          transactions={activeTransactions}
          products={activeProducts}
          isSpecificBorrower={isSpecificBorrower}
          activeBorrower={activeBorrower}
          onDeleteTransaction={onDeleteTransaction}
          onDeleteProduct={onDeleteProduct}
        />
      </section>

      {/* 4. ALL BORROWERS SUMMARY (When all borrowers viewed) */}
      {!isSpecificBorrower && borrowerSummary.length > 0 && (
        <section className="card p-5 sm:p-6 rounded-3xl bg-white shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-base sm:text-lg font-black text-slate-800">
            សង្ខេបអ្នកខ្ចីទាំងអស់
          </h2>

          {/* Desktop Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2.5 font-bold">ឈ្មោះអ្នកខ្ចី</th>
                  <th className="text-right py-2.5 font-bold">ឱ្យខ្ចីសរុប</th>
                  <th className="text-right py-2.5 font-bold">ទំនិញសរុប</th>
                  <th className="text-right py-2.5 font-black text-slate-900">
                    សមតុល្យទូទាត់
                  </th>
                  <th className="text-center py-2.5 font-bold">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody>
                {borrowerSummary.map((b) => (
                  <tr
                    key={b.borrower}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="py-3 font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => setSelectedBorrower(b.borrower)}
                        className="hover:text-primary-600 underline"
                      >
                        {b.borrower}
                      </button>
                    </td>
                    <td className="py-3 text-right tabular-nums text-amber-700 font-bold">
                      {formatMoney(b.totalLent)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-emerald-700 font-bold">
                      {formatMoney(b.totalProducts)}
                    </td>
                    <td className="py-3 text-right tabular-nums font-black text-slate-900">
                      {formatMoney(Math.abs(b.balance))}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${b.statusInfo.badgeClass}`}
                      >
                        {b.balance > 0
                          ? 'អ្នកខ្ចីជំពាក់'
                          : b.balance < 0
                            ? 'ប៉ាត្រូវសងវិញ'
                            : 'ទូទាត់រួច'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. PERMANENT MONTHLY SETTLEMENT HISTORY */}
      <section className="card p-5 sm:p-6 rounded-3xl bg-white shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <ArchiveIcon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <span>ប្រវត្តិទូទាត់បិទបញ្ជីប្រចាំខែ</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {archivedSettlements.length} ខែ
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                បញ្ជីខែដែលបានទូទាត់បិទបញ្ជីរួចរាល់
              </p>
            </div>
          </div>
        </div>

        {archivedSettlements.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm font-bold">
            មិនទាន់មានប្រវត្តិទូទាត់បិទបញ្ជីខែនៅឡើយទេ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs font-bold">
                  <th className="py-2.5 text-left">ខែ</th>
                  <th className="py-2.5 text-left">ឈ្មោះ</th>
                  <th className="py-2.5 text-right">ឱ្យខ្ចីសរុប</th>
                  <th className="py-2.5 text-right">តម្លៃទំនិញសរុប</th>
                  <th className="py-2.5 text-right">ទឹកប្រាក់ទូទាត់</th>
                  <th className="py-2.5 text-center">កាលបរិច្ឆេទទូទាត់</th>
                  <th className="py-2.5 text-center">ស្ថានភាព</th>
                  <th className="py-2.5 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archivedSettlements.map((arch) => (
                  <tr
                    key={arch.id || `${arch.month}-${arch.borrower}`}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Month with Calendar Icon */}
                    <td className="py-3 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        <span>{arch.month}</span>
                      </div>
                    </td>

                    {/* Borrower */}
                    <td className="py-3 font-bold text-slate-800 whitespace-nowrap">
                      {arch.borrower}
                    </td>

                    {/* Total Lent */}
                    <td className="py-3 text-right tabular-nums text-amber-700 font-bold whitespace-nowrap">
                      {formatMoney(arch.totalLent)}
                    </td>

                    {/* Total Goods */}
                    <td className="py-3 text-right tabular-nums text-emerald-700 font-bold whitespace-nowrap">
                      {formatMoney(arch.totalGoods)}
                    </td>

                    {/* Cleared Amount */}
                    <td className="py-3 text-right tabular-nums font-black text-slate-900 whitespace-nowrap">
                      {formatMoney(arch.paid)}
                    </td>

                    {/* Settlement Date */}
                    <td className="py-3 text-center tabular-nums text-slate-600 text-xs font-semibold whitespace-nowrap">
                      {arch.date}
                    </td>

                    {/* Settled Badge */}
                    <td className="py-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        <span>ទូទាត់រួចរាល់</span>
                      </span>
                    </td>

                    {/* Actions: View Details + Reopen */}
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectingArchive(arch)}
                          className="btn-outline min-h-[36px] px-3 py-1 text-xs font-bold flex items-center gap-1.5 rounded-xl text-primary-700 border-primary-200 bg-primary-50/50 hover:bg-primary-100"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                          <span>មើលលម្អិត</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReopenMonth(arch)}
                          className="btn-outline min-h-[36px] px-3 py-1 text-xs font-bold flex items-center gap-1.5 rounded-xl text-amber-700 border-amber-200 bg-amber-50/50 hover:bg-amber-100"
                        >
                          <RefreshCwIcon className="w-3.5 h-3.5" />
                          <span>បើកឡើងវិញ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL: Settle Month (Exact 2-Variable Active Calculation) */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  ទូទាត់បិទបញ្ជីខែ {targetMonth}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  ឈ្មោះ: {targetBorrower || 'សូមជ្រើសរើសឈ្មោះ'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Borrower selector if opened from All Borrowers */}
            {!isSpecificBorrower && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ជ្រើសរើសឈ្មោះអ្នកត្រូវទូទាត់
                </label>
                <select
                  value={settleBorrower}
                  onChange={(e) => handleSettleBorrowerChange(e.target.value)}
                  className="input-field text-base font-bold min-h-[48px]"
                  required
                >
                  <option value="" disabled>-- សូមជ្រើសរើសឈ្មោះ --</option>
                  {borrowerNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Month selector */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                ខែដែលត្រូវទូទាត់
              </label>
              <select
                value={settleMonthValue}
                onChange={(e) => setSettleMonthValue(e.target.value)}
                className="input-field text-base font-bold min-h-[48px]"
              >
                {borrowerAvailableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Exact 2-Variable Active Calculation Card for Target Month */}
            <div className="rounded-2xl bg-slate-50 p-4 space-y-2.5 text-sm border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">ឱ្យខ្ចីសរុប:</span>
                <span className="font-black text-amber-700 text-base tabular-nums">
                  {formatMoney(modalTotalLent)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">តម្លៃទំនិញសរុប:</span>
                <span className="font-black text-emerald-700 text-base tabular-nums">
                  {formatMoney(modalTotalGoods)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-black text-base">
                <span className="text-slate-800">សមតុល្យត្រូវទូទាត់:</span>
                <span
                  className={
                    modalNetBalance >= 0 ? 'text-amber-800' : 'text-blue-800'
                  }
                >
                  {formatMoney(Math.abs(modalNetBalance))}
                </span>
              </div>

              {/* Direction Indicator */}
              <div className="text-xs font-bold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 mt-2">
                <span>ទិសដៅទូទាត់: </span>
                <span className="font-black text-slate-900">
                  {modalNetBalance > 0
                    ? `${targetBorrower || 'អ្នកខ្ចី'} ត្រូវសងប៉ា`
                    : modalNetBalance < 0
                      ? `ប៉ាត្រូវបើកលុយឱ្យ ${targetBorrower || 'អ្នកខ្ចី'}`
                      : 'ទូទាត់រួចរាល់'}
                </span>
              </div>
            </div>

            {/* Subtle Status Notes for Settled or Empty Month */}
            {isAlreadySettled ? (
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-800 text-xs sm:text-sm font-bold border border-amber-200 text-center">
                ខែនេះបានទូទាត់រួចរាល់ហើយ
              </div>
            ) : isEmptyMonth ? (
              <div className="p-3 rounded-2xl bg-slate-100 text-slate-600 text-xs sm:text-sm font-bold border border-slate-200 text-center">
                ខែនេះមិនមានទឹកប្រាក់ត្រូវទូទាត់ទេ
              </div>
            ) : null}

            {/* Form */}
            <form onSubmit={handleConfirmSettleMonth} className="space-y-4">
              {/* Pre-filled Paid Amount */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ចំនួនទឹកប្រាក់ទូទាត់ជាក់ស្តែង (៛)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={settlePaidAmount}
                  onChange={(e) => setSettlePaidAmount(e.target.value)}
                  className="input-field text-xl font-black tabular-nums min-h-[48px]"
                  required
                />
              </div>

              {/* Settlement Date */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  កាលបរិច្ឆេទនៃការទូទាត់
                </label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="input-field text-base font-bold min-h-[48px]"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="btn-outline flex-1 min-h-[48px] text-base font-bold rounded-2xl"
                  disabled={settleSubmitting}
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={settleSubmitting || !canSettle}
                  className="btn-primary flex-1 min-h-[48px] text-base font-black shadow-md rounded-2xl flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settleSubmitting ? (
                    'កំពុងទូទាត់...'
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      <span>បញ្ជាក់ការទូទាត់</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Archive Details Inspection (មើលលម្អិត) */}
      {inspectingArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  ព័ត៌មានលម្អិតការទូទាត់ខែ {inspectingArchive.month}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  ឈ្មោះ: {inspectingArchive.borrower}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingArchive(null)}
                className="text-slate-400 hover:text-slate-600 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Card */}
            <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">ឱ្យខ្ចីសរុប:</span>
                <span className="font-black text-amber-700">
                  {formatMoney(inspectingArchive.totalLent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">តម្លៃទំនិញសរុប:</span>
                <span className="font-black text-emerald-700">
                  {formatMoney(inspectingArchive.totalGoods)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">ទឹកប្រាក់ទូទាត់:</span>
                <span className="font-black text-slate-900">
                  {formatMoney(inspectingArchive.paid)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-200">
                <span>កាលបរិច្ឆេទនៃការទូទាត់:</span>
                <span className="font-semibold">{inspectingArchive.date}</span>
              </div>
            </div>

            {/* Archived Transactions Breakdown */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              {/* Archived Loans */}
              {inspectingArchive.records.loans.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    ប្រាក់ឱ្យខ្ចីក្នុងខែនេះ ({inspectingArchive.records.loans.length})
                  </h4>
                  <div className="space-y-1.5">
                    {inspectingArchive.records.loans.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-700">
                            {formatDate(t.date)}
                          </span>
                          {t.note && (
                            <span className="text-slate-500 italic block">
                              {t.note}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-amber-800 text-sm tabular-nums">
                          {formatMoney(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archived Goods */}
              {inspectingArchive.records.goods.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    ទំនិញបានទទួលក្នុងខែនេះ ({inspectingArchive.records.goods.length})
                  </h4>
                  <div className="space-y-1.5">
                    {inspectingArchive.records.goods.map((p) => {
                      const itemTotal =
                        p.total != null && !isNaN(p.total)
                          ? Number(p.total)
                          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-700">
                              {formatDate(p.date)}
                            </span>
                            <span className="text-slate-600 block">
                              {p.quantity} × {formatMoney(p.unitPrice)}
                            </span>
                            {p.note && (
                              <span className="text-slate-500 italic block">
                                {p.note}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-emerald-800 text-sm tabular-nums">
                            {formatMoney(itemTotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => handleOpenReopenMonth(inspectingArchive)}
                className="btn-outline min-h-[44px] text-xs sm:text-sm font-bold text-amber-800 border-amber-300 hover:bg-amber-50 rounded-2xl flex-1"
              >
                បើកខែឡើងវិញ
              </button>
              <button
                type="button"
                onClick={() => setInspectingArchive(null)}
                className="btn-primary min-h-[44px] text-xs sm:text-sm font-bold rounded-2xl flex-1"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reopen Month (Unlock & Restore Active Status) */}
      {reopenModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2 text-amber-900">
              <AlertCircleIcon className="w-6 h-6 text-amber-600 shrink-0" />
              <h3 className="text-xl font-black">
                បញ្ជាក់ការបើកខែ {reopenModalData.month} ឡើងវិញ
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              ការបើកខែឡើងវិញ នឹងដោះសោទិន្នន័យឱ្យត្រឡប់មកផ្ទាំងសកម្មបច្ចុប្បន្នវិញ។
            </p>

            <form onSubmit={handleConfirmReopenMonth} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  សូមវាយឈ្មោះអ្នកខ្ចី{' '}
                  <strong className="text-slate-900">
                    "{reopenModalData.borrower}"
                  </strong>{' '}
                  ដើម្បីបញ្ជាក់:
                </label>
                <input
                  type="text"
                  value={reopenTypedName}
                  onChange={(e) => setReopenTypedName(e.target.value)}
                  placeholder={`វាយ "${reopenModalData.borrower}"`}
                  className="input-field text-base font-bold min-h-[48px]"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setReopenModalData(null)}
                  className="btn-outline flex-1 min-h-[48px] text-base font-bold rounded-2xl"
                  disabled={reopenSubmitting}
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={
                    reopenSubmitting ||
                    normalizeBorrowerName(reopenTypedName).toLowerCase() !==
                    normalizeBorrowerName(
                      reopenModalData.borrower,
                    ).toLowerCase()
                  }
                  className="btn-danger flex-1 min-h-[48px] text-base font-bold disabled:opacity-40 shadow-md rounded-2xl"
                >
                  {reopenSubmitting ? 'កំពុងបើកឡើងវិញ...' : 'បើកខែឡើងវិញ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
