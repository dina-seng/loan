import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { labels, errorMessage } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { ConfirmDialog, InlineError, PageHeader } from '../components/Ui.jsx';
import EntryList from '../components/EntryList.jsx';
import { DownloadIcon } from '../components/Icons.jsx';

const filters = [
  { id: '', label: labels.all },
  { id: 'LEND', label: labels.lend },
  { id: 'PRODUCT', label: labels.product },
  { id: 'SETTLE_IN', label: labels.settleIn },
  { id: 'SETTLE_OUT', label: labels.settleOut },
];

export default function HistoryPage() {
  const [type, setType] = useState('');
  const [entries, setEntries] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { show } = useToast();
  const { partner } = usePartner();

  const load = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '200' });
    if (type) params.set('type', type);
    try {
      const { data } = await api(`/entries?${params}`);
      setEntries(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [type, partner?.id]);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/entries/${toDelete.id}/void`, { method: 'POST' });
      show(labels.saved);
      setToDelete(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={labels.history} subtitle={partner?.name} action={
        <a className="btn-secondary" href={`${import.meta.env.VITE_API_URL || ''}/api/v1/reports/transactions.csv?partnerId=${partner?.id || ''}`} download>
          <DownloadIcon className="h-5 w-5" />{labels.exportCsv}
        </a>
      } />
      <InlineError message={error} />

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            key={item.id || 'all'} type="button" onClick={() => setType(item.id)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${type === item.id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <EntryList entries={entries} onDelete={setToDelete} />

      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={confirmDelete} busy={busy} danger
        title={labels.delete} message={labels.deleteConfirm} confirmLabel={labels.delete} />
    </>
  );
}
