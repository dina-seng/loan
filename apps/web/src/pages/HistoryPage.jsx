import { useCallback, useEffect, useState } from 'react';
import { api, downloadCsv } from '../api.js';
import { labels, errorMessage } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { InlineError, PageHeader } from '../components/Ui.jsx';
import EntryList from '../components/EntryList.jsx';
import VoidDialog from '../components/VoidDialog.jsx';
import { DownloadIcon } from '../components/Icons.jsx';

const filters = [
  { id: '', label: labels.all },
  { id: 'LENDING', label: labels.lend },
  { id: 'DELIVERY', label: labels.product },
  { id: 'PAYMENT', label: labels.settlements },
];

export default function HistoryPage() {
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState([]);
  const [monthlyTotals, setMonthlyTotals] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { show } = useToast();
  const { partner } = usePartner();

  const load = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '200' });
    if (kind) params.set('kind', kind);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const { data, meta } = await api(`/transactions?${params}`);
      setEntries(data);
      setMonthlyTotals(meta?.monthlyTotals || []);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [kind, from, to, partner?.id]);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = async (reason) => {
    setBusy(true);
    try {
      await api(`/entries/${toDelete.id}/void`, { method: 'POST', body: { reason: reason || null } });
      show(labels.saved);
      setToDelete(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      await downloadCsv('/reports/transactions.csv', 'ledger.csv');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title={labels.history} subtitle={partner?.name} action={
        <button type="button" className="btn-secondary" onClick={exportCsv}>
          <DownloadIcon className="h-5 w-5" />{labels.exportCsv}
        </button>
      } />
      <InlineError message={error} />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            key={item.id || 'all'} type="button" onClick={() => setKind(item.id)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${kind === item.id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">{labels.from}</span>
          <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="block">
          <span className="label">{labels.to}</span>
          <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      <EntryList entries={entries} monthlyTotals={monthlyTotals} onDelete={setToDelete} />

      <VoidDialog open={Boolean(toDelete)} entry={toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} busy={busy} />
    </>
  );
}
