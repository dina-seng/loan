import { useCallback, useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api.js';
import { labels, errorMessage } from '../i18n/labels.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { ConfirmDialog, Field, InlineError, PageHeader } from '../components/Ui.jsx';
import EntryModal from '../components/EntryModal.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { PlusIcon } from '../components/Icons.jsx';

const voidPath = (entry) => `/${entry.kind === 'LENDING' ? 'lending' : entry.kind === 'DELIVERY' ? 'deliveries' : 'payments'}/${entry.id}/void`;

export default function TransactionsPage() {
  const [filters, setFilters] = useState({ type: '', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], meta: null });
  const [entryTab, setEntryTab] = useState(null);
  const [toVoid, setToVoid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { show } = useToast();
  const { partner } = usePartner();

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const response = await api(`/transactions?${params}`);
      setResult({ items: response.data, meta: response.meta });
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filters, page, partner?.id]);

  useEffect(() => { load(); }, [load]);

  const confirmVoid = async () => {
    setBusy(true);
    try {
      await api(voidPath(toVoid), { method: 'POST', body: { reason: 'លុបចោលដោយប៉ា' }, idempotencyKey: newIdempotencyKey() });
      show(labels.saved);
      setToVoid(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={labels.transactions} subtitle={`${result.meta?.total || 0} ប្រតិបត្តិការ`} action={
        <button type="button" className="btn-primary" onClick={() => setEntryTab('lending')}><PlusIcon className="h-5 w-5" />{labels.addTransaction}</button>
      } />

      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
        <Field label={labels.type}>
          <select className="input" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">{labels.all}</option>
            <option value="LENDING">{labels.moneyLending}</option>
            <option value="DELIVERY">{labels.productDelivery}</option>
            <option value="PAYMENT">{labels.payment}</option>
          </select>
        </Field>
        <Field label={labels.from}><input className="input" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></Field>
        <Field label={labels.to}><input className="input" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></Field>
        <Field label={labels.search}>
          <div className="flex gap-2">
            <input className="input" value={filters.search} placeholder={labels.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <button type="submit" className="btn-secondary shrink-0">{labels.filter}</button>
          </div>
        </Field>
      </form>

      <InlineError message={error} />
      <TransactionList entries={result.items} onVoid={setToVoid} />

      {result.meta && result.meta.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
          <span className="text-sm font-bold text-slate-600">{page} / {result.meta.pages}</span>
          <button type="button" className="btn-secondary" disabled={page >= result.meta.pages} onClick={() => setPage(page + 1)}>→</button>
        </div>
      )}

      <EntryModal open={Boolean(entryTab)} defaultTab={entryTab || 'lending'} onClose={() => setEntryTab(null)} onSaved={load} />
      <ConfirmDialog open={Boolean(toVoid)} onClose={() => setToVoid(null)} onConfirm={confirmVoid} busy={busy} danger
        title={labels.void} message={`${labels.areYouSure} ${labels.void}? សមតុល្យនឹងត្រឡប់ទៅសភាពមុនវិញ។`} confirmLabel={labels.void} />
    </>
  );
}
