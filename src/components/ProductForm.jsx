import { useState, useMemo, useRef, useEffect } from "react";
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
} from "../utils";

const ADD_BORROWER_OPTION = "__add_new_borrower__";

export default function ProductForm({
  transactions = [],
  products = [],
  borrowers: customBorrowers,
  defaultBorrower = "",
  onSave,
  onClose,
}) {
  const [date, setDate] = useState(todayStr());

  // Extract unique borrowers list from both transactions and products
  const borrowerList = useMemo(() => {
    if (
      customBorrowers &&
      Array.isArray(customBorrowers) &&
      customBorrowers.length > 0
    ) {
      return customBorrowers;
    }
    return getUniqueBorrowers(transactions, products);
  }, [customBorrowers, transactions, products]);

  const [borrower, setBorrower] = useState(() => {
    const initial =
      defaultBorrower || localStorage.getItem("lms_last_borrower") || "";
    const match = borrowerList.find(
      (b) =>
        normalizeBorrowerName(b).toLowerCase() ===
        normalizeBorrowerName(initial).toLowerCase(),
    );
    return match || initial || borrowerList[0] || "";
  });

  const [showAddBorrower, setShowAddBorrower] = useState(false);
  const [newBorrowerName, setNewBorrowerName] = useState("");
  const [similarBorrower, setSimilarBorrower] = useState(null);
  const [borrowerNotice, setBorrowerNotice] = useState("");

  const [item, setItem] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const quantityRef = useRef(null);

  // Live Auto-Calculation (Quantity x Unit Price, rounded to integer Riel)
  const parsedQuantity = getRawQuantity(quantityInput);
  const parsedUnitPrice = getRawNumber(unitPriceInput);
  const totalPrice = Math.round(parsedQuantity * parsedUnitPrice);

  const handleQuantityChange = (e) => {
    setQuantityInput(formatInputQuantity(e.target.value));
  };

  const handlePriceChange = (e) => {
    setUnitPriceInput(formatInputNumber(e.target.value));
  };

  const handleCreateBorrower = () => {
    const normalized = normalizeBorrowerName(newBorrowerName);
    if (!normalized) {
      setBorrowerNotice(
        "សូមបញ្ចូលឈ្មោះអ្នកខ្ចី (Please enter a borrower name)",
      );
      return;
    }
    const match = findBorrowerNameMatch(normalized, borrowerList);
    if (match?.type === "exact") {
      setBorrowerNotice(
        `មានអ្នកខ្ចី "${match.borrower}" រួចហើយ (Already exists).`,
      );
      setSimilarBorrower(match);
      return;
    }
    if (match?.type === "similar") {
      setSimilarBorrower({ ...match, candidate: normalized });
      setBorrowerNotice("");
      return;
    }
    setBorrower(normalized);
    setShowAddBorrower(false);
    setNewBorrowerName("");
    setSimilarBorrower(null);
    setBorrowerNotice("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!date) return setError("សូមជ្រើសរើសកាលបរិច្ឆេទ (Please select a date)");
    if (!borrower.trim())
      return setError("សូមជ្រើសរើសឈ្មោះអ្នកខ្ចី (Please select a borrower)");
    if (parsedQuantity <= 0)
      return setError("បរិមាណត្រូវតែធំជាង 0 (Quantity must be > 0)");
    if (parsedUnitPrice <= 0)
      return setError("តម្លៃឯកតាត្រូវតែធំជាង 0 (Unit price must be > 0)");

    setSaving(true);
    try {
      const payload = {
        date,
        borrower: normalizeBorrowerName(borrower),
        item: item.trim(),
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        total: totalPrice,
        note: note.trim(),
      };

      const result = await onSave(payload);
      if (result === false)
        throw new Error("ការរក្សាទុកមិនបានជោគជ័យ សូមព្យាយាមម្តងទៀត");

      localStorage.setItem(
        "lms_last_borrower",
        normalizeBorrowerName(borrower),
      );
      setSuccess(true);

      // Quick entry: keep borrower and date, clear quantity, unitPrice, item, note
      setItem("");
      setQuantityInput("");
      setUnitPriceInput("");
      setNote("");

      // Auto focus back on quantity for the next product
      setTimeout(() => {
        setSuccess(false);
        if (quantityRef.current) {
          quantityRef.current.focus();
        }
      }, 1500);
    } catch (err) {
      if (err.message === "month_settled" || err.code === "month_settled") {
        setError(
          "ខែនេះត្រូវបានទូទាត់បិទរួចហើយ មិនអាចបន្ថែមទំនិញបានទេ (This month is settled and locked)",
        );
      } else if (
        err.message === "unknown_action" ||
        err.code === "unknown_action"
      ) {
        setError(
          'Google Apps Script មិនទាន់ស្គាល់ "add_product" ទេ (unknown_action)។ សូមចម្លង Code.gs ទៅដាក់ក្នុង Google Sheet Apps Script រួចចុច Deploy → Manage deployments → Edit ✏️ → ជ្រើសរើស "New version" ហើយចុច Deploy ជាការស្រេច។',
        );
      } else {
        setError(
          err.message ||
            "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ (Failed to save product)",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="safe-area-sheet relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="text-emerald-600 text-xl">📦</span>
              <span>កត់ត្រាទិញផលិតផល (Add Product)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              កត់ត្រាទំនិញដែលបានទទួលពីអ្នកខ្ចី ដើម្បីកាត់កងបំណុល
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="បិទ (Close)"
          >
            ✕
          </button>
        </div>

        {/* Quick-entry success toast */}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-emerald-800 text-sm font-semibold flex items-center justify-between gap-2 shadow-sm animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 text-lg">✓</span>
              <span>
                រក្សាទុកផលិតផលបានជោគជ័យ! រួចរាល់សម្រាប់ទំនិញបន្ទាប់ (Ready for
                next)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-emerald-700 underline font-bold"
            >
              បិទ (Done)
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-300 p-3 text-red-800 text-sm flex items-start gap-2 shadow-sm">
            <span className="text-red-600 font-bold mt-0.5">⚠️</span>
            <div className="flex-1 font-medium">{error}</div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-xs text-red-500 font-bold hover:underline"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Date */}
          <div>
            <label
              htmlFor="product-date"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              កាលបរិច្ឆេទ (Date) <span className="text-red-500">*</span>
            </label>
            <input
              id="product-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={saving}
              className="input-field text-base font-medium text-slate-800"
            />
          </div>

          {/* 2. Borrower Name (Dropdown + Add new borrower) */}
          <div>
            <label
              htmlFor="product-borrower"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              ឈ្មោះអ្នកខ្ចី (Borrower Name){" "}
              <span className="text-red-500">*</span>
            </label>
            <select
              id="product-borrower"
              value={borrower}
              onChange={(e) => {
                if (e.target.value === ADD_BORROWER_OPTION) {
                  setShowAddBorrower(true);
                  setNewBorrowerName("");
                  setSimilarBorrower(null);
                  setBorrowerNotice("");
                } else {
                  setBorrower(e.target.value);
                  setShowAddBorrower(false);
                }
              }}
              required
              disabled={saving}
              className="input-field text-base font-medium text-slate-800 bg-white"
            >
              <option value="" disabled>
                -- ជ្រើសរើសអ្នកខ្ចី (Select Borrower) --
              </option>
              {borrowerList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={ADD_BORROWER_OPTION}>
                + បន្ថែមអ្នកខ្ចីថ្មី (Add new borrower)
              </option>
            </select>

            {/* Inline Add New Borrower Sub-form */}
            {showAddBorrower && (
              <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label
                  htmlFor="new-borrower-prod"
                  className="block text-xs font-semibold text-slate-700"
                >
                  ឈ្មោះអ្នកខ្ចីថ្មី (New borrower name)
                </label>
                <input
                  id="new-borrower-prod"
                  type="text"
                  value={newBorrowerName}
                  onChange={(e) => {
                    setNewBorrowerName(e.target.value);
                    setSimilarBorrower(null);
                    setBorrowerNotice("");
                  }}
                  placeholder="ឧ. សុខា (e.g. Sokha)"
                  className="input-field text-sm"
                  autoFocus
                />
                {borrowerNotice && (
                  <p className="text-xs text-amber-700 font-medium">
                    {borrowerNotice}
                  </p>
                )}
                {similarBorrower && (
                  <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                    <p>
                      ⚠️ ឈ្មោះនេះស្រដៀងនឹង{" "}
                      <strong>"{similarBorrower.borrower}"</strong>{" "}
                      ដែលមានស្រាប់។
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBorrower(similarBorrower.borrower);
                          setShowAddBorrower(false);
                          setSimilarBorrower(null);
                        }}
                        className="btn-primary text-xs py-1 px-2.5"
                      >
                        ប្រើ "{similarBorrower.borrower}"
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBorrower(normalizeBorrowerName(newBorrowerName));
                          setShowAddBorrower(false);
                          setSimilarBorrower(null);
                        }}
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        បង្កើតឈ្មោះថ្មី
                      </button>
                    </div>
                  </div>
                )}
                {!similarBorrower && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateBorrower}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      បន្ថែម (Add)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddBorrower(false);
                        setNewBorrowerName("");
                        setBorrowerNotice("");
                      }}
                      className="btn-outline text-xs py-1.5 px-3"
                    >
                      បោះបង់ (Cancel)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Item Name (Optional: rice, fish, etc.) */}
          {/* <div>
            <label htmlFor="product-item" className="block text-sm font-semibold text-slate-700 mb-1">
              មុខទំនិញ / ឈ្មោះទំនិញ (Item Name - Optional)
            </label>
            <input
              id="product-item"
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="ឧ. ស្រូវ, ត្រី, បន្លែ (e.g. Rice, Fish)"
              disabled={saving}
              className="input-field text-base font-medium text-slate-800"
            />
          </div> */}

          {/* 4 & 5. Quantity (up to 2 decimals) & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="product-quantity"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                បរិមាណ (Quantity) <span className="text-red-500">*</span>
              </label>
              <input
                ref={quantityRef}
                id="product-quantity"
                type="text"
                inputMode="decimal"
                value={quantityInput}
                onChange={handleQuantityChange}
                placeholder="ឧ. 2.5 ឬ 10"
                required
                disabled={saving}
                className="input-field text-base font-semibold text-slate-800 tabular-nums"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                អាចដាក់ទសភាគបាន (e.g. 2.5 គីឡូ)
              </span>
            </div>

            <div>
              <label
                htmlFor="product-unit-price"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                តម្លៃឯកតា (Unit Price - ៛){" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="product-unit-price"
                  type="text"
                  inputMode="numeric"
                  value={unitPriceInput}
                  onChange={handlePriceChange}
                  placeholder="ឧ. 5,000"
                  required
                  disabled={saving}
                  className="input-field pr-9 text-base font-semibold text-slate-800 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500">
                  ៛
                </span>
              </div>
            </div>
          </div>

          {/* 6. Note (Optional) */}
          <div>
            <label
              htmlFor="product-note"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              កំណត់សម្គាល់ (Note - Optional)
            </label>
            <input
              id="product-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ព័ត៌មានបន្ថែម (Additional details)"
              disabled={saving}
              className="input-field text-sm text-slate-800"
            />
          </div>

          {/* Auto-Calculation Prominent Display Box */}
          <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/90 p-4 text-emerald-950 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-800">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>គណនាតម្លៃសរុប (Live Total)</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                បរិមាណ × តម្លៃឯកតា (គត់ត្រឹមរៀល)
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-emerald-200/60 pt-2">
              <span className="text-sm font-bold text-emerald-900">
                តម្លៃសរុប (Total Price):
              </span>
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-700 tracking-tight">
                {formatMoney(totalPrice)}
              </span>
            </div>

            <p className="mt-1 text-xs text-emerald-800/90 font-medium">
              {parsedQuantity > 0 && parsedUnitPrice > 0
                ? `${parsedQuantity.toLocaleString("en-US")} × ${formatMoney(parsedUnitPrice)} = ${formatMoney(totalPrice)}`
                : "សូមបញ្ចូលបរិមាណ និងតម្លៃឯកតា ដើម្បីផ្ទៀងផ្ទាត់ការគណនា"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row-reverse gap-2">
            <button
              type="submit"
              disabled={saving || totalPrice <= 0}
              className="w-full sm:flex-1 min-h-[48px] inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-md hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>កំពុងរក្សាទុក...</span>
                </span>
              ) : (
                "រក្សាទុកផលិតផល (Save Product)"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              បិទ (Close)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
