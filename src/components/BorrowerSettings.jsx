import { useMemo, useState } from 'react';
import {
  findBorrowerNameMatch,
  getUniqueBorrowers,
  normalizeBorrowerName,
} from '../utils';

export default function BorrowerSettings({ transactions, onRename, onClose }) {
  const borrowers = useMemo(() => getUniqueBorrowers(transactions), [transactions]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [similarTarget, setSimilarTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const prepareRename = () => {
    setError('');
    setSuccess('');
    const source = normalizeBorrowerName(from);
    const target = normalizeBorrowerName(to);
    if (!source || !target) {
      setError('សូមជ្រើសរើសឈ្មោះដើម និងបញ្ចូលឈ្មោះថ្មី (Select a borrower and enter a new name).');
      return;
    }
    if (source.toLowerCase() === target.toLowerCase()) {
      setError('ឈ្មោះថ្មីត្រូវតែខុសពីឈ្មោះដើម (The new name must be different).');
      return;
    }

    const existingTarget = findBorrowerNameMatch(target, borrowers.filter(name => name.toLowerCase() !== source.toLowerCase()));
    if (existingTarget?.type === 'exact') {
      setTo(existingTarget.borrower);
      setSimilarTarget(null);
    } else if (existingTarget?.type === 'similar') {
      setSimilarTarget({ ...existingTarget, candidate: target });
      setConfirming(false);
      return;
    }
    setConfirming(true);
  };

  const confirmRename = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await onRename(normalizeBorrowerName(from), normalizeBorrowerName(to));
      setSuccess(`បានកែប្រែ ${updated} ប្រតិបត្តិការ (Updated ${updated} transaction${updated === 1 ? '' : 's'}).`);
      setFrom('');
      setTo('');
      setConfirming(false);
      setSimilarTarget(null);
    } catch (err) {
      setError(err.message || 'មិនអាចកែប្រែឈ្មោះបានទេ (Could not rename borrower).');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrower-settings-title"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="borrower-settings-title" className="text-lg font-semibold text-slate-800">
              ការកំណត់អ្នកខ្ចី (Borrower settings)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              ប្តូរឈ្មោះ ឬបញ្ចូលប្រតិបត្តិការរបស់អ្នកខ្ចីទៅឈ្មោះផ្សេង។
              (Rename a borrower or merge their transactions into another name.)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="បិទ (Close)"
          >
            ✕
          </button>
        </div>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        {success && <p className="mb-3 rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700" role="status">{success}</p>}

        {borrowers.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            មិនទាន់មានអ្នកខ្ចីទេ (There are no borrowers to manage yet).
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="rename-borrower-from" className="mb-1 block text-sm font-medium text-slate-600">
                ឈ្មោះបច្ចុប្បន្ន (Current borrower)
              </label>
              <select
                id="rename-borrower-from"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setConfirming(false);
                  setSimilarTarget(null);
                  setSuccess('');
                }}
                className="input-field"
                disabled={saving}
              >
                <option value="">ជ្រើសរើសអ្នកខ្ចី (Select borrower)</option>
                {borrowers.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="rename-borrower-to" className="mb-1 block text-sm font-medium text-slate-600">
                ឈ្មោះថ្មី ឬឈ្មោះដែលត្រូវបញ្ចូល (New or merge-into name)
              </label>
              <input
                id="rename-borrower-to"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setConfirming(false);
                  setSimilarTarget(null);
                  setSuccess('');
                }}
                className="input-field"
                autoComplete="off"
                disabled={saving}
              />
            </div>

            {similarTarget && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                <p>
                  ឈ្មោះថ្មីស្រដៀងនឹង “{similarTarget.borrower}”។
                  (The new name is similar to “{similarTarget.borrower}”.)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTo(similarTarget.borrower);
                      setSimilarTarget(null);
                      setConfirming(true);
                    }}
                    className="btn-outline"
                  >
                    បញ្ចូលទៅឈ្មោះនេះ (Merge into this name)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTo(similarTarget.candidate);
                      setSimilarTarget(null);
                      setConfirming(true);
                    }}
                    className="btn-outline"
                  >
                    ប្រើឈ្មោះថ្មីនេះ (Use new name)
                  </button>
                </div>
              </div>
            )}

            {confirming ? (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-900">
                  ប្រតិបត្តិការទាំងអស់របស់ “{from}” នឹងប្តូរទៅ “{normalizeBorrowerName(to)}”។
                  (All transactions for this borrower will be updated.)
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={confirmRename} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                    {saving ? 'កំពុងរក្សាទុក...' : 'បញ្ជាក់ការកែប្រែ (Confirm)'}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="btn-outline">
                    ត្រឡប់ (Back)
                  </button>
                </div>
              </div>
            ) : !similarTarget && (
              <button type="button" onClick={prepareRename} disabled={saving} className="btn-primary w-full">
                ប្តូរ/បញ្ចូលអ្នកខ្ចី (Rename / merge borrower)
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
