import { useState, useEffect, useRef, useMemo } from 'react';
import {
  findBorrowerNameMatch,
  formatInputNumber,
  getRawNumber,
  getUniqueBorrowers,
  normalizeBorrowerName,
  todayStr,
} from '../utils';

const ADD_BORROWER_OPTION = '__add_new_borrower__';

export default function TransactionForm({ transactions, defaults, onSave, onClose }) {
  const [date, setDate] = useState(defaults?.date || todayStr());
  const [borrower, setBorrower] = useState(() => {
    const names = getUniqueBorrowers(transactions);
    const preferredName = normalizeBorrowerName(
      defaults?.borrower || localStorage.getItem('lms_last_borrower') || '',
    ).toLowerCase();
    return names.find(name => name.toLowerCase() === preferredName) || '';
  });
  const [type, setType] = useState(defaults?.type || 'Lend');
  const [amountDisplay, setAmountDisplay] = useState(
    defaults?.amount ? formatInputNumber(String(defaults.amount)) : ''
  );
  const [note, setNote] = useState(defaults?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showAddBorrower, setShowAddBorrower] = useState(false);
  const [newBorrowerName, setNewBorrowerName] = useState('');
  const [similarBorrower, setSimilarBorrower] = useState(null);
  const [borrowerNotice, setBorrowerNotice] = useState('');
  const [createdBorrower, setCreatedBorrower] = useState('');

  const amountInputRef = useRef(null);

  const borrowerNames = useMemo(() => getUniqueBorrowers(transactions), [transactions]);

  useEffect(() => {
    const selectedExists = borrowerNames.some(name => name.toLowerCase() === borrower.toLowerCase());
    const isNewSelection = createdBorrower && createdBorrower.toLowerCase() === borrower.toLowerCase();
    if (borrower && !selectedExists && !isNewSelection) {
      setBorrower('');
    }
  }, [borrowerNames, borrower, createdBorrower]);

  // Auto-focus amount when form opens with defaults
  useEffect(() => {
    if (defaults?.amount && amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.select();
    }
  }, []);

  const handleAmountChange = (e) => {
    const formatted = formatInputNumber(e.target.value);
    setAmountDisplay(formatted);
  };

  const selectBorrower = (name) => {
    setBorrower(name);
    setCreatedBorrower('');
    setShowAddBorrower(false);
    setNewBorrowerName('');
    setSimilarBorrower(null);
    setBorrowerNotice('');
  };

  const finishBorrowerCreation = (name) => {
    setBorrower(name);
    setCreatedBorrower(name);
    setShowAddBorrower(false);
    setNewBorrowerName('');
    setSimilarBorrower(null);
    setBorrowerNotice('');
    setError('');
  };

  const handleCreateBorrower = () => {
    const normalizedName = normalizeBorrowerName(newBorrowerName);
    if (!normalizedName) {
      setBorrowerNotice('សូមបញ្ចូលឈ្មោះអ្នកខ្ចី (Please enter a borrower name)');
      return;
    }

    const match = findBorrowerNameMatch(normalizedName, borrowerNames);
    if (match?.type === 'exact') {
      setBorrowerNotice(`មានអ្នកខ្ចី "${match.borrower}" រួចហើយ (This borrower already exists).`);
      setSimilarBorrower(match);
      return;
    }
    if (match?.type === 'similar') {
      setSimilarBorrower({ ...match, candidate: normalizedName });
      setBorrowerNotice('');
      return;
    }
    finishBorrowerCreation(normalizedName);
  };

  const resetForm = () => {
    setDate(todayStr());
    // Keep borrower name for convenience
    setType('Lend');
    setAmountDisplay('');
    setNote('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amount = getRawNumber(amountDisplay);

    if (!date) {
      setError('សូមជ្រើសរើសកាលបរិច្ឆេទ (Please select a date)');
      return;
    }
    if (!borrower.trim()) {
      setError('សូមជ្រើសរើស ឬ បន្ថែមអ្នកខ្ចី (Please select or add a borrower)');
      return;
    }
    const normalizedBorrower = normalizeBorrowerName(borrower);
    const borrowerExists = borrowerNames.some(name => name.toLowerCase() === normalizedBorrower.toLowerCase());
    if (!borrowerExists && createdBorrower.toLowerCase() !== normalizedBorrower.toLowerCase()) {
      setError('សូមជ្រើសរើសអ្នកខ្ចីដែលមានស្រាប់ ឬបន្ថែមថ្មី (Select an existing borrower or add a new one)');
      return;
    }
    if (amount <= 0) {
      setError('ចំនួនទឹកប្រាក់ត្រូវតែធំជាង 0 (Amount must be greater than 0)');
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave({
        date,
        borrower: normalizedBorrower,
        type,
        amount,
        note: note.trim(),
      });
      if (saved === false) {
        throw new Error('Your session expired. Please log in and try again.');
      }
      // Remember last used borrower
      localStorage.setItem('lms_last_borrower', normalizedBorrower);
      setSuccess(true);
      resetForm();
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError('រក្សាទុកមិនបានសម្រេច: ' + err.message + ' (Save failed - tap retry)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="safe-area-sheet bg-white rounded-t-2xl shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-slate-800">
            បន្ថែមប្រតិបត្តិការ (Add Transaction)
          </h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label="បិទ (Close)"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-4 mt-4 bg-success-50 border border-success-200 text-success-700 rounded-lg p-3 text-sm flex items-center gap-2">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            រក្សាទុកបានសម្រេច! (Saved successfully!)
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label htmlFor="txn-date" className="block text-sm font-medium text-slate-600 mb-1">
              កាលបរិច្ឆេទ (Date)
            </label>
            <input
              id="txn-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
              disabled={saving}
            />
          </div>

          {/* Borrower Name */}
          <div>
            <label htmlFor="txn-borrower" className="block text-sm font-medium text-slate-600 mb-1">
              ឈ្មោះអ្នកខ្ចី (Borrower Name)
            </label>
            <select
              id="txn-borrower"
              value={borrower}
              onChange={(e) => {
                if (e.target.value === ADD_BORROWER_OPTION) {
                  setShowAddBorrower(true);
                  setNewBorrowerName('');
                  setSimilarBorrower(null);
                  setBorrowerNotice('');
                } else {
                  selectBorrower(e.target.value);
                }
              }}
              className="input-field"
              disabled={saving}
            >
              <option value="">ជ្រើសរើសអ្នកខ្ចី (Select borrower)</option>
              {createdBorrower && !borrowerNames.some(name => name.toLowerCase() === createdBorrower.toLowerCase()) && (
                <option value={createdBorrower}>{createdBorrower}</option>
              )}
              {borrowerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={ADD_BORROWER_OPTION}>+ បន្ថែមអ្នកខ្ចីថ្មី (Add new borrower)</option>
            </select>

            {showAddBorrower && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="new-borrower-name" className="block text-sm font-medium text-slate-600">
                  ឈ្មោះអ្នកខ្ចីថ្មី (New borrower name)
                </label>
                <input
                  id="new-borrower-name"
                  type="text"
                  value={newBorrowerName}
                  onChange={(e) => {
                    setNewBorrowerName(e.target.value);
                    setSimilarBorrower(null);
                    setBorrowerNotice('');
                  }}
                  className="input-field bg-white"
                  autoComplete="off"
                  disabled={saving}
                  placeholder="បញ្ចូលឈ្មោះ..."
                />
                {borrowerNotice && (
                  <p className="text-sm text-amber-700" role="status">{borrowerNotice}</p>
                )}
                {similarBorrower?.type === 'similar' && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                    <p>
                      ឈ្មោះនេះស្រដៀងនឹង “{similarBorrower.borrower}”។ សូមពិនិត្យមុនបន្ត។
                      (This name is similar to “{similarBorrower.borrower}”. Please check before continuing.)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectBorrower(similarBorrower.borrower)}
                        className="btn-outline"
                      >
                        ប្រើឈ្មោះដែលមានស្រាប់ (Use existing)
                      </button>
                      <button
                        type="button"
                        onClick={() => finishBorrowerCreation(similarBorrower.candidate)}
                        className="btn-primary"
                      >
                        បង្កើតដាច់ដោយឡែក (Create separately)
                      </button>
                    </div>
                  </div>
                )}
                {similarBorrower?.type === 'exact' && (
                  <button
                    type="button"
                    onClick={() => selectBorrower(similarBorrower.borrower)}
                    className="btn-outline"
                  >
                    ជ្រើសរើសអ្នកខ្ចីដែលមានស្រាប់ (Select existing borrower)
                  </button>
                )}
                {!similarBorrower && (
                  <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateBorrower}
                    className="btn-primary"
                  >
                    បន្ថែម (Add)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBorrower(false);
                      setNewBorrowerName('');
                      setBorrowerNotice('');
                    }}
                    className="btn-outline"
                  >
                    បោះបង់ (Cancel)
                  </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ប្រភេទ (Type)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('Lend')}
                disabled={saving}
                className={`py-4 rounded-xl text-base font-semibold transition-all
                  ${type === 'Lend'
                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                style={{ minHeight: '56px' }}
              >
                <span className="block text-lg">💸</span>
                ឱ្យខ្ចី (Lend)
              </button>
              <button
                type="button"
                onClick={() => setType('Repay')}
                disabled={saving}
                className={`py-4 rounded-xl text-base font-semibold transition-all
                  ${type === 'Repay'
                    ? 'bg-success-600 text-white shadow-md ring-2 ring-success-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                style={{ minHeight: '56px' }}
              >
                <span className="block text-lg">💰</span>
                ទទួលសង (Repay)
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="txn-amount" className="block text-sm font-medium text-slate-600 mb-1">
              ចំនួនទឹកប្រាក់ (Amount)
            </label>
            <div className="relative">
              <input
                id="txn-amount"
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={handleAmountChange}
                className="input-field pr-10 text-xl font-bold tabular-nums"
                placeholder="0"
                disabled={saving}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">
                ៛
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label htmlFor="txn-note" className="block text-sm font-medium text-slate-600 mb-1">
              កំណត់សម្គាល់ (Note) <span className="text-slate-400 font-normal">- ស្រេចចិត្ត</span>
            </label>
            <input
              id="txn-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field"
              placeholder="ឧ. សម្រាប់ទិញអង្ករ..."
              disabled={saving}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-4 rounded-xl text-lg font-semibold transition-colors
              ${type === 'Lend' ? 'btn-primary' : 'btn-success'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                កំពុងរក្សាទុក...
              </span>
            ) : (
              'រក្សាទុក (Save)'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
