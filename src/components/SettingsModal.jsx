import { useMemo, useState } from 'react';
import {
  findBorrowerNameMatch,
  getUniqueBorrowers,
  normalizeBorrowerName,
} from '../utils';
import {
  SettingsIcon,
  DownloadIcon,
  XIcon,
  CheckIcon,
  AlertCircleIcon,
} from './Icons';

export default function SettingsModal({
  transactions = [],
  products = [],
  onRename,
  onExportTransactions,
  onExportProducts,
  onClose,
}) {
  const borrowers = useMemo(
    () => getUniqueBorrowers(transactions, products),
    [transactions, products],
  );

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
      setError('សូមជ្រើសរើសឈ្មោះដើម និងបញ្ចូលឈ្មោះថ្មី');
      return;
    }
    if (source.toLowerCase() === target.toLowerCase()) {
      setError('ឈ្មោះថ្មីត្រូវតែខុសពីឈ្មោះដើម');
      return;
    }

    const existingTarget = findBorrowerNameMatch(
      target,
      borrowers.filter((name) => name.toLowerCase() !== source.toLowerCase()),
    );
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
      const updated = await onRename(
        normalizeBorrowerName(from),
        normalizeBorrowerName(to),
      );
      setSuccess(`បានកែប្រែ ${updated} ប្រតិបត្តិការ`);
      setFrom('');
      setTo('');
      setConfirming(false);
      setSimilarTarget(null);
    } catch (err) {
      setError(err.message || 'មិនអាចកែប្រែឈ្មោះបានទេ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-slate-800">
            <SettingsIcon className="w-6 h-6 text-primary-600" />
            <h2 id="settings-title" className="text-xl font-black">
              ការកំណត់
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="បិទ"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* SECTION 1: EXPORT DATA (CSV) */}
        <div className="space-y-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800">
              ទាញយកទិន្នន័យ (CSV)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ទាញយកឯកសារកត់ត្រាទុកក្នុងទូរស័ព្ទ ឬកុំព្យូទ័រ
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onExportTransactions}
              className="btn-outline min-h-[48px] px-4 font-bold text-sm sm:text-base bg-white hover:bg-slate-100 flex items-center justify-center gap-2 shadow-sm rounded-xl text-slate-800"
            >
              <DownloadIcon className="w-5 h-5 text-primary-600" />
              <span>CSV កម្ចី</span>
            </button>
            <button
              type="button"
              onClick={onExportProducts}
              className="btn-outline min-h-[48px] px-4 font-bold text-sm sm:text-base bg-white hover:bg-slate-100 flex items-center justify-center gap-2 shadow-sm rounded-xl text-slate-800"
            >
              <DownloadIcon className="w-5 h-5 text-emerald-600" />
              <span>CSV ទំនិញ</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: BORROWER MANAGEMENT */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800">
              គ្រប់គ្រងឈ្មោះអ្នកខ្ចី
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ប្តូរឈ្មោះ ឬបញ្ចូលប្រតិបត្តិការទៅឈ្មោះផ្សេង
            </p>
          </div>

          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 flex items-center gap-2"
              role="alert"
            >
              <AlertCircleIcon className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700 flex items-center gap-2"
              role="status"
            >
              <CheckIcon className="w-5 h-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {borrowers.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              មិនទាន់មានឈ្មោះអ្នកខ្ចីទេ
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="rename-from"
                  className="mb-1 block text-sm sm:text-base font-bold text-slate-700"
                >
                  ឈ្មោះបច្ចុប្បន្ន
                </label>
                <select
                  id="rename-from"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setConfirming(false);
                    setSimilarTarget(null);
                    setSuccess('');
                  }}
                  className="input-field text-base font-bold min-h-[48px]"
                  disabled={saving}
                >
                  <option value="">សូមជ្រើសរើសឈ្មោះ</option>
                  {borrowers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="rename-to"
                  className="mb-1 block text-sm sm:text-base font-bold text-slate-700"
                >
                  ឈ្មោះថ្មី
                </label>
                <input
                  id="rename-to"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setConfirming(false);
                    setSimilarTarget(null);
                    setSuccess('');
                  }}
                  placeholder="វាយឈ្មោះថ្មី..."
                  className="input-field text-base font-bold min-h-[48px]"
                  autoComplete="off"
                  disabled={saving}
                />
              </div>

              {similarTarget && (
                <div
                  className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  role="alert"
                >
                  <p>
                    ឈ្មោះថ្មីស្រដៀងនឹង “{similarTarget.borrower}”។
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTo(similarTarget.borrower);
                        setSimilarTarget(null);
                        setConfirming(true);
                      }}
                      className="btn-outline min-h-[44px] text-sm font-bold"
                    >
                      បញ្ចូលទៅឈ្មោះនេះ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTo(similarTarget.candidate);
                        setSimilarTarget(null);
                        setConfirming(true);
                      }}
                      className="btn-outline min-h-[44px] text-sm font-bold"
                    >
                      ប្រើឈ្មោះថ្មីនេះ
                    </button>
                  </div>
                </div>
              )}

              {confirming ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm sm:text-base font-bold text-amber-900">
                    ប្រតិបត្តិការទាំងអស់របស់ “{from}” នឹងប្តូរទៅ “
                    {normalizeBorrowerName(to)}”។
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmRename}
                      disabled={saving}
                      className="btn-primary flex-1 min-h-[48px] text-base font-bold"
                    >
                      {saving ? 'កំពុងរក្សាទុក...' : 'បញ្ជាក់ការកែប្រែ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={saving}
                      className="btn-outline min-h-[48px] text-base font-bold"
                    >
                      ត្រឡប់
                    </button>
                  </div>
                </div>
              ) : (
                !similarTarget && (
                  <button
                    type="button"
                    onClick={prepareRename}
                    disabled={saving}
                    className="btn-primary w-full min-h-[48px] text-base font-bold rounded-xl"
                  >
                    ប្តូរឈ្មោះអ្នកខ្ចី
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
