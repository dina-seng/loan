import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { labels, errorMessage } from '../i18n/labels.js';
import { Field, InlineError, PageHeader } from '../components/Ui.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { DownloadIcon } from '../components/Icons.jsx';
import { formatDate, formatMoney } from '../utils/money.js';

const snapshotRows = (snapshot) => [
  [labels.openingBalance, snapshot.openingBalance],
  [labels.totalMoneyLent, snapshot.totalLent],
  [labels.totalProductValue, snapshot.totalDelivered],
  [labels.receivedPayments, snapshot.totalReceived],
  [labels.outgoingPayments, snapshot.totalPaidOut],
  [labels.closingBalance, snapshot.closingBalance],
];

export default function HistoryPage() {
  const [closings, setClosings] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [statement, setStatement] = useState(null);
  const [filters, setFilters] = useState({ type: '', from: '', to: '', search: '' });
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    try {
      const { data } = await api('/reports/statements');
      setClosings(data);
      if (!selectedId && data.length) setSelectedId(data[0].id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [selectedId]);

  const loadStatement = useCallback(async () => {
    if (!selectedId) return setStatement(null);
    try {
      const { data } = await api(`/period-closings/${selectedId}/statement`);
      setStatement(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [selectedId]);

  const loadEntries = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '100' });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const { data } = await api(`/transactions?${params}`);
      setEntries(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filters]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadStatement(); }, [loadStatement]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  return (
    <>
      <PageHeader title={labels.history} subtitle={labels.printableStatement} action={
        <a className="btn-secondary" href={`${import.meta.env.VITE_API_URL || ''}/api/v1/reports/transactions.csv`} download>
          <DownloadIcon className="h-5 w-5" />{labels.exportCsv}
        </a>
      } />
      <InlineError message={error} />

      <div id="print-area">
        <section className="card mb-4 p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.periodClosing}</h3>
          {closings.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">{labels.noData}</p> : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {closings.map((closing) => (
                <button key={closing.id} type="button" onClick={() => setSelectedId(closing.id)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-bold ${selectedId === closing.id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}>
                  <span className="block">{formatDate(closing.startDate)} — {formatDate(closing.endDate)}</span>
                  <span className="amount block text-sm">{formatMoney(closing.closingBalance)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {statement && (
          <section className="card mb-4 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-brand-700">{statement.businessName}</p>
                <h3 className="text-lg font-extrabold text-slate-900">{labels.periodClosing}</h3>
                <p className="text-sm text-slate-600">{formatDate(statement.closing.startDate)} — {formatDate(statement.closing.endDate)}</p>
                <p className="text-xs text-slate-500">{statement.ownerName} · {statement.partnerName}</p>
              </div>
              <button type="button" className="btn-secondary no-print" onClick={() => window.print()}>{labels.print}</button>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 sm:grid-cols-3">
              {snapshotRows(statement.closing.snapshot).map(([label, value]) => (
                <div key={label} className="bg-white p-3">
                  <p className="text-[11px] font-bold text-slate-500">{label}</p>
                  <p className="amount text-sm font-extrabold text-slate-900">{formatMoney(value)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">បិទថ្ងៃ {formatDate(String(statement.closing.closedAt).slice(0, 10))} · ស្ថានភាព {statement.closing.status === 'ACTIVE' ? labels.active : labels.reopen}</p>
            <div className="mt-3"><TransactionList entries={statement.entries} /></div>
          </section>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.transactions}</h3>
        <form className="card mb-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); loadEntries(); }}>
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
          <Field label={labels.search}><input className="input" value={filters.search} placeholder={labels.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></Field>
        </form>
        <TransactionList entries={entries} />
      </section>
    </>
  );
}
