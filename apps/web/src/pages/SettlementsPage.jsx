import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { labels, errorMessage, RIER } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { EmptyState, InlineError, PageHeader } from '../components/Ui.jsx';
import SettlementModal from '../components/SettlementModal.jsx';
import { formatDate } from '../utils/money.js';

export default function SettlementsPage() {
  const { partner } = usePartner();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [firstOpenDate, setFirstOpenDate] = useState(null);
  const { show } = useToast();

  const load = useCallback(async () => {
    try {
      const [list, dashboard] = await Promise.all([api('/settlements'), api('/dashboard')]);
      setRows(list.data);
      setFirstOpenDate(dashboard.data.firstOpenDate);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [partner?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title={labels.settlements} subtitle={partner?.name} action={
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>{labels.addSettlement}</button>
      } />
      <InlineError message={error} />
      {!rows.length ? <EmptyState message={labels.noData} /> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article key={row.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-slate-900">
                  {row.direction === 'PARTNER_TO_DAD' ? labels.partnerToDad : labels.dadToPartner}
                </p>
                <span className="amount text-sm font-extrabold text-sky-800">{RIER}{row.amount}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {formatDate(row.date)} · {row.method} · {row.status === 'FULL' ? labels.full : labels.partial}
              </p>
              <p className="mt-1 text-xs text-slate-600">{labels.balanceAfter}: {RIER}{row.balanceAfter}</p>
            </article>
          ))}
        </div>
      )}
      <SettlementModal open={open} firstOpenDate={firstOpenDate} onClose={() => setOpen(false)}
        onSaved={async () => { await load(); show(labels.saved); }} />
    </>
  );
}
