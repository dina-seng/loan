import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { labels, errorMessage, RIER } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { EmptyState, InlineError, PageHeader } from '../components/Ui.jsx';
import DeliveryModal from '../components/DeliveryModal.jsx';
import { formatDate } from '../utils/money.js';

export default function DeliveriesPage() {
  const { partner } = usePartner();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [firstOpenDate, setFirstOpenDate] = useState(null);
  const { show } = useToast();

  const load = useCallback(async () => {
    try {
      const [list, dashboard] = await Promise.all([api('/deliveries'), api('/dashboard')]);
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
      <PageHeader title={labels.deliveries} subtitle={partner?.name} action={
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>{labels.addDelivery}</button>
      } />
      <InlineError message={error} />
      {!rows.length ? <EmptyState message={labels.noData} /> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article key={row.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time className="text-xs text-slate-500">{formatDate(row.date)}</time>
                <span className="amount text-sm font-extrabold text-emerald-700">{RIER}{row.amount}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {(row.deliveryItems || []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-2 text-xs text-slate-700">
                    <span className="truncate">{item.productName} × {item.quantity}</span>
                    <span className="shrink-0 amount">{RIER}{item.lineTotal}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      <DeliveryModal open={open} firstOpenDate={firstOpenDate} onClose={() => setOpen(false)}
        onSaved={async () => { await load(); show(labels.saved); }} />
    </>
  );
}
