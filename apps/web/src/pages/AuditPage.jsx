import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { labels, errorMessage } from '../strings.km.js';
import { usePartner } from '../partners.jsx';
import { EmptyState, Field, InlineError, PageHeader } from '../components/Ui.jsx';
import { formatDate } from '../utils/money.js';

const actionLabels = {
  ENTRY_CREATE: labels.lend,
  ENTRY_VOID: labels.delete,
  DELIVERY_CREATE: labels.product,
  SETTLEMENT_CREATE: labels.settlements,
  PARTNER_CREATE: labels.addPartner,
  PARTNER_UPDATE: labels.editName,
  PRODUCT_CREATE: labels.addProduct,
  PRODUCT_UPDATE: labels.editName,
  PRODUCT_DEACTIVATE: labels.deactivate,
  PERIOD_CLOSE: labels.close,
  PERIOD_REOPEN: labels.reopen,
};

export default function AuditPage() {
  const { partner } = usePartner();
  const [rows, setRows] = useState([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (action) params.set('action', action);
    try {
      const { data } = await api(`/audit?${params}`);
      setRows(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [action, partner?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title={labels.audit} subtitle={partner?.name} />
      <InlineError message={error} />
      <div className="mb-4">
        <Field label={labels.action}>
          <select className="input" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">{labels.all}</option>
            {Object.keys(actionLabels).map((key) => <option key={key} value={key}>{actionLabels[key]}</option>)}
          </select>
        </Field>
      </div>
      {!rows.length ? <EmptyState message={labels.noData} /> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article key={row.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-slate-900">{actionLabels[row.action] || row.action}</p>
                <time className="text-xs text-slate-500">{formatDate(row.createdAt)}</time>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {row.entityType}{row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
              </p>
              {row.metadata?.reason && <p className="mt-1 text-xs text-slate-600">{labels.reason}: {row.metadata.reason}</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
