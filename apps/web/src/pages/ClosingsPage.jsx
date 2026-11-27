import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { usePartner } from '../partners.jsx';
import { labels, errorMessage } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { ConfirmDialog, EmptyState, Field, InlineError, Modal, PageHeader, SummaryCard } from '../components/Ui.jsx';
import { formatDate, todayISO } from '../utils/money.js';
import { BanknoteIcon, PackageIcon } from '../components/Icons.jsx';
import { ScaleIcon } from '../components/NavIcons.jsx';

export default function ClosingsPage() {
  const { user } = useAuth();
  const { partner } = usePartner();
  const isOwner = user?.role === 'OWNER';
  const [closings, setClosings] = useState([]);
  const [range, setRange] = useState({ startDate: todayISO(), endDate: todayISO() });
  const [preview, setPreview] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reopening, setReopening] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { show } = useToast();

  const load = useCallback(async () => {
    try {
      const { data } = await api('/period-closings');
      setClosings(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showPreview = async () => {
    if (!range.startDate || !range.endDate) return setError(labels.rangeRequired);
    setBusy(true);
    try {
      const { data } = await api(`/period-closings/preview?startDate=${range.startDate}&endDate=${range.endDate}`);
      setPreview(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      await api('/period-closings', { method: 'POST', body: range });
      show(labels.saved);
      setConfirmClose(false);
      setPreview(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      await api(`/period-closings/${reopening.id}/reopen`, { method: 'POST', body: { reason } });
      show(labels.saved);
      setReopening(null);
      setReason('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={labels.closings} subtitle={partner?.name} />
      <InlineError message={error} />
      {!isOwner && <p className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">{labels.ownerOnly}</p>}

      <section className="card space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label={labels.periodStart}>
            <input className="input" type="date" value={range.startDate} onChange={(event) => setRange({ ...range, startDate: event.target.value })} />
          </Field>
          <Field label={labels.periodEnd}>
            <input className="input" type="date" value={range.endDate} onChange={(event) => setRange({ ...range, endDate: event.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={showPreview} disabled={busy}>{busy ? labels.loading : labels.preview}</button>
          <button type="button" className="btn-primary" disabled={!isOwner || busy || !preview} onClick={() => setConfirmClose(true)}>{labels.close}</button>
        </div>
        {preview && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">{labels.previewNote}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label={labels.openingBalance} amount={preview.openingBalance} icon={ScaleIcon} />
              <SummaryCard label={labels.totalLent} amount={preview.totalLent} icon={BanknoteIcon} accent="text-amber-800" />
              <SummaryCard label={labels.totalProductValue} amount={preview.totalDelivered} icon={PackageIcon} accent="text-emerald-700" />
              <SummaryCard label={labels.balanceHeadline} amount={preview.closingBalance} icon={ScaleIcon} accent="text-slate-800" />
            </div>
            {preview.warning && <p className="text-xs font-semibold text-amber-700">{preview.warning}</p>}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.closings}</h3>
        {!closings.length ? <EmptyState message={labels.noClosings} /> : (
          <div className="space-y-2">
            {closings.map((closing) => (
              <article key={closing.id} className="card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-slate-900">
                    {formatDate(closing.startDate)} — {formatDate(closing.endDate)}
                  </p>
                  <span className={`chip ${closing.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {closing.status === 'ACTIVE' ? labels.active : labels.reopened}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {labels.balanceHeadline}: {closing.closingBalance} · {labels.closedAt}: {formatDate(closing.closedAt)}
                </p>
                {closing.note && <p className="mt-1 text-xs text-slate-600">{closing.note}</p>}
                {closing.status === 'ACTIVE' && (
                  <button type="button" className="mt-2 text-xs font-bold text-brand-700 underline" disabled={!isOwner}
                    onClick={() => { setReopening(closing); setReason(''); }}>
                    {labels.reopen}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} onConfirm={close} busy={busy}
        title={labels.close} message={labels.closeConfirm} confirmLabel={labels.close} />

      <Modal open={Boolean(reopening)} onClose={() => setReopening(null)} title={labels.reopen} footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setReopening(null)}>{labels.cancel}</button>
          <button type="button" className="btn-primary flex-[2]" onClick={reopen} disabled={busy || !reason.trim()}>{busy ? labels.loading : labels.confirm}</button>
        </div>
      }>
        <p className="mb-3 text-sm text-slate-700">{labels.reopenConfirm}</p>
        <Field label={labels.reason}>
          <textarea className="input min-h-[70px] py-2" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {!reason.trim() && <p className="mt-2 text-xs text-red-600">{labels.reasonRequired}</p>}
      </Modal>
    </>
  );
}
