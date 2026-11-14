import { useState, useMemo, useRef, useEffect } from 'react';
import {
  formatInputNumber,
  formatInputQuantity,
  getRawNumber,
  getRawQuantity,
  formatMoney,
  getUniqueBorrowers,
  normalizeBorrowerName,
  findBorrowerNameMatch,
  todayStr,
} from '../utils';
import {
  BanknoteIcon,
  PackageIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
  CheckIcon,
  AlertCircleIcon,
} from './Icons';

const ADD_BORROWER_OPTION = '__add_new_borrower__';

function createLendRow(date = todayStr()) {
  return {
    id: crypto.randomUUID(),
    date,
    amountDisplay: '',
    note: '',
  };
}

function createGoodsRow(date = todayStr()) {
  return {
    id: crypto.randomUUID(),
    date,
    quantityInput: '',
    unitPriceInput: '',
    note: '',
  };
}

export default function UnifiedEntryModal({
  isOpen,
  onClose,
  transactions = [],
  products = [],
  defaultBorrower = '',
  defaultTab = 'lend', // 'lend' | 'goods'
  onSaveTransaction,
  onSaveProduct,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Extract unique borrowers
  const borrowerList = useMemo(() => {
    return getUniqueBorrowers(transactions, products);
  }, [transactions, products]);

  const [borrower, setBorrower] = useState(() => {
    const initial =
      defaultBorrower || localStorage.getItem('lms_last_borrower') || '';
    const match = borrowerList.find(
      (b) =>
        normalizeBorrowerName(b).toLowerCase() ===
        normalizeBorrowerName(initial).toLowerCase(),
    );
    return match || initial || borrowerList[0] || '';
  });

  const [showAddBorrower, setShowAddBorrower] = useState(false);
  const [newBorrowerName, setNewBorrowerName] = useState('');
  const [borrowerNotice, setBorrowerNotice] = useState('');

  // Multi-row state for lending
  const [lendRows, setLendRows] = useState([createLendRow()]);

  // Multi-row state for goods
  const [goodsRows, setGoodsRows] = useState([createGoodsRow()]);

  // Form feedback states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab || 'lend');
      setError('');
      setSuccess(false);

      const targetBorrower =
        defaultBorrower || localStorage.getItem('lms_last_borrower') || '';
      const match = borrowerList.find(
        (b) =>
          normalizeBorrowerName(b).toLowerCase() ===
          normalizeBorrowerName(targetBorrower).toLowerCase(),
      );
      setBorrower(match || targetBorrower || borrowerList[0] || '');

      setLendRows([createLendRow()]);
      setGoodsRows([createGoodsRow()]);
    }
  }, [isOpen, defaultTab, defaultBorrower, borrowerList]);

  // Calculations for Lend Rows
  const totalLendSum = useMemo(() => {
    return lendRows.reduce((sum, row) => sum + getRawNumber(row.amountDisplay), 0);
  }, [lendRows]);

  // Calculations for Goods Rows
  const totalGoodsSum = useMemo(() => {
    return goodsRows.reduce((sum, row) => {
      const q = getRawQuantity(row.quantityInput);
      const p = getRawNumber(row.unitPriceInput);
      return sum + Math.round(q * p);
    }, 0);
  }, [goodsRows]);

  if (!isOpen) return null;

  // Borrower Creation Handler
  const handleCreateBorrower = () => {
    const normalized = normalizeBorrowerName(newBorrowerName);
    if (!normalized) {
      setBorrowerNotice('សូមបញ្ចូលឈ្មោះ');
      return;
    }
    const match = findBorrowerNameMatch(normalized, borrowerList);
    if (match?.type === 'exact') {
      setBorrower(match.borrower);
    } else {
      setBorrower(normalized);
    }
    setShowAddBorrower(false);
    setNewBorrowerName('');
    setBorrowerNotice('');
  };

  // Lend Row Helpers
  const updateLendRow = (id, field, value) => {
    setLendRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const addLendRow = () => {
    const lastDate = lendRows[lendRows.length - 1]?.date || todayStr();
    setLendRows((prev) => [...prev, createLendRow(lastDate)]);
  };

  const removeLendRow = (id) => {
    if (lendRows.length <= 1) return;
    setLendRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Goods Row Helpers
  const updateGoodsRow = (id, field, value) => {
    setGoodsRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const addGoodsRow = () => {
    const lastDate = goodsRows[goodsRows.length - 1]?.date || todayStr();
    setGoodsRows((prev) => [...prev, createGoodsRow(lastDate)]);
  };

  const removeGoodsRow = (id) => {
    if (goodsRows.length <= 1) return;
    setGoodsRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Submission Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanBorrower = normalizeBorrowerName(borrower);
    if (!cleanBorrower) {
      setError('សូមជ្រើសរើសឈ្មោះ');
      return;
    }

    setSaving(true);

    try {
      if (activeTab === 'lend') {
        // Filter out empty rows, validate filled ones
        const validRows = lendRows.filter((r) => getRawNumber(r.amountDisplay) > 0);
        if (validRows.length === 0) {
          setError('សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យខ្ចីយ៉ាងហោចណាស់មួយជួរ');
          setSaving(false);
          return;
        }

        // Save each lending row
        for (const r of validRows) {
          const rawAmount = getRawNumber(r.amountDisplay);
          const successResult = await onSaveTransaction({
            date: r.date || todayStr(),
            borrower: cleanBorrower,
            type: 'Lend',
            amount: rawAmount,
            note: (r.note || '').trim(),
          });
          if (successResult === false) {
            throw new Error('ការរក្សាទុកមិនបានជោគជ័យ សូមព្យាយាមម្តងទៀត');
          }
        }
      } else if (activeTab === 'goods') {
        // Filter out empty rows, validate filled ones
        const validRows = goodsRows.filter((r) => {
          const q = getRawQuantity(r.quantityInput);
          const p = getRawNumber(r.unitPriceInput);
          return q > 0 && p > 0;
        });

        if (validRows.length === 0) {
          setError('សូមបញ្ចូលបរិមាណ និងតម្លៃរាយទំនិញយ៉ាងហោចណាស់មួយជួរ');
          setSaving(false);
          return;
        }

        // Save each goods row (no item name field, pass empty string)
        for (const r of validRows) {
          const q = getRawQuantity(r.quantityInput);
          const p = getRawNumber(r.unitPriceInput);
          const total = Math.round(q * p);

          const successResult = await onSaveProduct({
            date: r.date || todayStr(),
            borrower: cleanBorrower,
            item: '',
            itemName: '',
            quantity: q,
            unitPrice: p,
            total,
            note: (r.note || '').trim(),
          });
          if (successResult === false) {
            throw new Error('ការរក្សាទុកមិនបានជោគជ័យ សូមព្យាយាមម្តងទៀត');
          }
        }
      }

      localStorage.setItem('lms_last_borrower', cleanBorrower);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err) {
      if (err.message === 'month_settled' || err.code === 'month_settled') {
        setError('ខែនេះត្រូវបានទូទាត់បិទរួចហើយ មិនអាចកត់ត្រាបានទេ');
      } else {
        setError(err.message || 'មិនអាចរក្សាទុកបានទេ');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-y-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            កត់ត្រាថ្មី
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="បិទ"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 2 Big Selectable Tabs: ឱ្យខ្ចីលុយ vs ទទួលទំនិញ */}
        <div className="p-4 sm:p-5 pb-0">
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
            {/* Tab 1: ឱ្យខ្ចីលុយ */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('lend');
                setError('');
              }}
              className={`min-h-[52px] py-2.5 px-3 rounded-xl text-base sm:text-lg font-black transition-all flex items-center justify-center gap-2.5 ${
                activeTab === 'lend'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BanknoteIcon className="w-6 h-6" />
              <span>ឱ្យខ្ចីលុយ</span>
            </button>

            {/* Tab 2: ទទួលទំនិញ */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('goods');
                setError('');
              }}
              className={`min-h-[52px] py-2.5 px-3 rounded-xl text-base sm:text-lg font-black transition-all flex items-center justify-center gap-2.5 ${
                activeTab === 'goods'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <PackageIcon className="w-6 h-6" />
              <span>ទទួលទំនិញ</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mx-4 sm:mx-5 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm sm:text-base font-bold flex items-center gap-2">
            <AlertCircleIcon className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mx-4 sm:mx-5 mt-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-3.5 text-sm sm:text-base font-bold flex items-center gap-2">
            <CheckIcon className="w-5 h-5 shrink-0" />
            <span>បានកត់ត្រាដោយជោគជ័យ</span>
          </div>
        )}

        {/* Entry Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5">
          {/* Person Selector */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="entry-borrower"
                className="text-base sm:text-lg font-black text-slate-800"
              >
                ជ្រើសរើសឈ្មោះ
              </label>
              {!showAddBorrower && (
                <button
                  type="button"
                  onClick={() => setShowAddBorrower(true)}
                  className="text-sm font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 underline"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>បន្ថែមឈ្មោះថ្មី</span>
                </button>
              )}
            </div>

            {!showAddBorrower ? (
              <select
                id="entry-borrower"
                value={borrower}
                onChange={(e) => {
                  if (e.target.value === ADD_BORROWER_OPTION) {
                    setShowAddBorrower(true);
                  } else {
                    setBorrower(e.target.value);
                  }
                }}
                className="input-field text-base sm:text-lg font-bold text-slate-800 bg-white min-h-[48px]"
                disabled={saving}
              >
                <option value="">សូមជ្រើសរើសឈ្មោះ</option>
                {borrowerList.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value={ADD_BORROWER_OPTION}>
                  បន្ថែមឈ្មោះថ្មី...
                </option>
              </select>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBorrowerName}
                    onChange={(e) => {
                      setNewBorrowerName(e.target.value);
                      setBorrowerNotice('');
                    }}
                    placeholder="វាយឈ្មោះនៅទីនេះ..."
                    className="input-field text-base font-bold bg-white flex-1 min-h-[48px]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateBorrower}
                    className="btn-primary px-4 min-h-[48px] font-bold text-base"
                  >
                    បន្ថែម
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBorrower(false);
                      setNewBorrowerName('');
                      setBorrowerNotice('');
                    }}
                    className="btn-outline px-3 min-h-[48px] font-bold text-base"
                  >
                    បោះបង់
                  </button>
                </div>
                {borrowerNotice && (
                  <p className="text-sm font-semibold text-amber-700">
                    {borrowerNotice}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: ឱ្យខ្ចីលុយ (Multi-Row Entry) */}
          {activeTab === 'lend' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-slate-800">
                  បញ្ជីទឹកប្រាក់ឱ្យខ្ចី ({lendRows.length} ជួរ)
                </span>
                <button
                  type="button"
                  onClick={addLendRow}
                  className="btn-outline min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 rounded-xl border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>បន្ថែមជួរមួយទៀត</span>
                </button>
              </div>

              {/* Rows */}
              <div className="space-y-3">
                {lendRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                        ជួរ #{index + 1}
                      </span>
                      {lendRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLendRow(row.id)}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                          title="លុបជួរនេះ"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Date */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          កាលបរិច្ឆេទ
                        </label>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            updateLendRow(row.id, 'date', e.target.value)
                          }
                          className="input-field bg-white text-base font-bold min-h-[44px]"
                          disabled={saving}
                          required
                        />
                      </div>

                      {/* Loan Amount */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          ទឹកប្រាក់ឱ្យខ្ចី (៛)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.amountDisplay}
                            onChange={(e) =>
                              updateLendRow(
                                row.id,
                                'amountDisplay',
                                formatInputNumber(e.target.value),
                              )
                            }
                            placeholder="0"
                            className="input-field bg-white text-xl sm:text-2xl font-black text-amber-700 min-h-[44px] tabular-nums pr-9"
                            disabled={saving}
                            required
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                            ៛
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Optional Note */}
                    <div>
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) =>
                          updateLendRow(row.id, 'note', e.target.value)
                        }
                        placeholder="ចំណាំ (មិនបង្ខំ)..."
                        className="input-field bg-white text-sm min-h-[40px]"
                        disabled={saving}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary Footer */}
              <div className="rounded-2xl bg-amber-100 border-2 border-amber-300 p-4 flex items-center justify-between">
                <span className="text-sm sm:text-base font-black text-amber-950">
                  សរុបទឹកប្រាក់បញ្ចូលលើកនេះ៖
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-900 tabular-nums">
                  {formatMoney(totalLendSum)}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: ទទួលទំនិញ (Multi-Row Entry — NO ITEM NAME) */}
          {activeTab === 'goods' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-slate-800">
                  បញ្ជីទទួលទំនិញ ({goodsRows.length} ជួរ)
                </span>
                <button
                  type="button"
                  onClick={addGoodsRow}
                  className="btn-outline min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 rounded-xl border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>បន្ថែមជួរទំនិញ</span>
                </button>
              </div>

              {/* Rows */}
              <div className="space-y-3">
                {goodsRows.map((row, index) => {
                  const q = getRawQuantity(row.quantityInput);
                  const p = getRawNumber(row.unitPriceInput);
                  const rowSubtotal = Math.round(q * p);

                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                          ជួរ #{index + 1}
                        </span>
                        {goodsRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeGoodsRow(row.id)}
                            className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                            title="លុបជួរនេះ"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Date */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            កាលបរិច្ឆេទ
                          </label>
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) =>
                              updateGoodsRow(row.id, 'date', e.target.value)
                            }
                            className="input-field bg-white text-base font-bold min-h-[44px]"
                            disabled={saving}
                            required
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            បរិមាណ
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.quantityInput}
                            onChange={(e) =>
                              updateGoodsRow(
                                row.id,
                                'quantityInput',
                                formatInputQuantity(e.target.value),
                              )
                            }
                            placeholder="0"
                            className="input-field bg-white text-xl font-black text-slate-800 min-h-[44px] tabular-nums"
                            disabled={saving}
                            required
                          />
                        </div>

                        {/* Unit Price */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            តម្លៃរាយ (៛)
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.unitPriceInput}
                              onChange={(e) =>
                                updateGoodsRow(
                                  row.id,
                                  'unitPriceInput',
                                  formatInputNumber(e.target.value),
                                )
                              }
                              placeholder="0"
                              className="input-field bg-white text-xl font-black text-slate-800 min-h-[44px] tabular-nums pr-8"
                              disabled={saving}
                              required
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                              ៛
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Row Subtotal & Optional Note */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-100">
                        <div>
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) =>
                              updateGoodsRow(row.id, 'note', e.target.value)
                            }
                            placeholder="ចំណាំ (មិនបង្ខំ)..."
                            className="input-field bg-white text-sm min-h-[38px]"
                            disabled={saving}
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-emerald-800">
                          <span>សរុបជួរនេះ:</span>
                          <span className="text-base font-black text-emerald-900 tabular-nums">
                            {formatMoney(rowSubtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grand Total Footer */}
              <div className="rounded-2xl bg-emerald-100 border-2 border-emerald-300 p-4 flex items-center justify-between">
                <span className="text-sm sm:text-base font-black text-emerald-950">
                  សរុបថ្លៃទំនិញលើកនេះ៖
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-900 tabular-nums">
                  {formatMoney(totalGoodsSum)}
                </span>
              </div>
            </div>
          )}

          {/* Big Action Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`w-full min-h-[52px] rounded-2xl text-lg sm:text-xl font-black text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${
                activeTab === 'lend'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>កំពុងរក្សាទុក...</span>
                </span>
              ) : (
                <span>រក្សាទុកទាំងអស់</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
