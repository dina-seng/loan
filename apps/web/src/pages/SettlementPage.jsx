import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, newIdempotencyKey } from '../api.js';
import { labels, errorMessage, dadPaysPartner, partnerPaysDad } from '../i18n/labels.js';
import { usePartner } from '../partners.jsx';
import { useToast } from '../components/Toast.jsx';
import { AmountField, ConfirmDialog, Field, InlineError, PageHeader } from '../components/Ui.jsx';
import { formatDate, formatMoney, todayISO } from '../utils/money.js';
import { ScaleIcon } from '../components/NavIcons.jsx';

function firstOfMonth() {
  const today = todayISO();
  return `${today.slice(0, 7)}-01`;
}

export default function SettlementPage() {
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(todayISO());
  const [preview, setPreview] = useState(null);
  const [settlement, setSettlement] = useState({ amount: '', direction: 'PARTNER_TO_DAD', method: 'cash', note: '' });
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closings, setClosings] = useState([]);
  const closeKey = useMemo(() => newIdempotencyKey(), [startDate, endDate]);
  const settleKey = useMemo(() => newIdempotencyKey(), [settlement.amount, settlement.direction]);
  const { show } = useToast();
  const { partner } = usePartner();
  const partnerName = partner?.name || 'អ៊ូដុំ';

  const load = useCallback(async () => {
    try {
      const [result, list] = await Promise.all([
        api(`/period-closings/preview?startDate=${startDate}&endDate=${endDate}`),
        api('/period-closings'),
      ]);
      setPreview(result.data);
      setClosings(list.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [startDate, endDate, partner?.id]);

  useEffect(() => { load(); }, [load]);

  const recordSettlement = async () => {
    const amount = settlement.amount.replace(/[^\d]/g, '');
    if (!amount) return setError('សូមបញ្ចូលចំនួនលុយទូទាត់');
    setBusy(true);
    try {
      await api('/settlements', {
        method: 'POST', idempotencyKey: settleKey,
        body: {
          paymentDate: endDate > todayISO() ? todayISO() : endDate,
          amount, direction: settlement.direction, method: settlement.method,
          note: settlement.note || null,
        },
      });
      show(labels.saved);
      setConfirmSettle(false);
      setSettlement({ amount: '', direction: 'PARTNER_TO_DAD', method: 'cash', note: '' });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const closePeriod = async () => {
    setBusy(true);
    try {
      const { data } = await api('/period-closings', {
        method: 'POST', idempotencyKey: closeKey,
        body: { startDate, endDate },
      });
      show(labels.saved);
      setConfirmClose(false);
      const next = new Date(`${data.endDate}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const nextISO = next.toISOString().slice(0, 10);
      setStartDate(nextISO);
      setEndDate(nextISO);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={labels.settlement} subtitle={`${partnerName} · ${labels.periodClosing}`} />

      <section className="card mb-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.from}><input className="input" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
          <Field label={labels.to}><input className="input" type="date" value={endDate} min={startDate} max={todayISO()} onChange={(event) => setEndDate(event.target.value)} /></Field>
        </div>
        <button type="button" className="btn-secondary mt-3 w-full sm:w-auto" onClick={load}>{labels.preview}</button>
      </section>

      <InlineError message={error} />

      {preview && (
        <>
          <section className="card mb-4 overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-extrabold text-slate-800">{labels.periodSummary}</h3>
              <p className="text-xs text-slate-500">{formatDate(preview.startDate)} — {formatDate(preview.endDate)} · {preview.transactionCount} ប្រតិបត្តិការ</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
              {[
                [labels.openingBalance, preview.openingBalance],
                [labels.totalMoneyLent, preview.totalLent],
                [labels.totalProductValue, preview.totalDelivered],
                [labels.receivedPayments, preview.totalReceived],
                [labels.outgoingPayments, preview.totalPaidOut],
                [labels.closingBalance, preview.closingBalance],
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-3">
                  <p className="text-[11px] font-bold text-slate-500">{label}</p>
                  <p className="amount mt-1 text-sm font-extrabold text-slate-900 sm:text-base">{formatMoney(value)}</p>
                </div>
              ))}
            </div>
            {!preview.canClose && (
              <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">
                {errorMessage({ code: 'PERIOD_OVERLAP' })} ថ្ងៃចាប់ផ្តើមត្រូវជា {formatDate(preview.expectedNextStart)}។
              </p>
            )}
          </section>

          <section className="card mb-4 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-800"><ScaleIcon className="h-5 w-5 text-brand-700" />{labels.partialSettlement}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <AmountField label={labels.settlementAmount} value={settlement.amount} onChange={(value) => setSettlement({ ...settlement, amount: value })} />
              <Field label={labels.direction}>
                <select className="input" value={settlement.direction} onChange={(event) => setSettlement({ ...settlement, direction: event.target.value })}>
                  <option value="PARTNER_TO_DAD">{partnerPaysDad(partnerName)}</option>
                  <option value="DAD_TO_PARTNER">{dadPaysPartner(partnerName)}</option>
                </select>
              </Field>
              <Field label={labels.note}>
                <select className="input" value={settlement.method} onChange={(event) => setSettlement({ ...settlement, method: event.target.value })}>
                  <option value="cash">{labels.cash}</option>
                  <option value="bank">{labels.bank}</option>
                  <option value="other">{labels.other}</option>
                </select>
              </Field>
              <Field label={labels.note}>
                <input className="input" value={settlement.note} onChange={(event) => setSettlement({ ...settlement, note: event.target.value })} maxLength={500} />
              </Field>
            </div>
            <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setConfirmSettle(true)}>{labels.recordPayment}</button>
            <p className="mt-2 text-xs text-slate-500">ការទូទាត់ផ្នែកត្រូវបានកត់ត្រាដាច់ដោយឡែក។ សមតុល្យដែលនៅសល់នឹងបន្តទៅខួបបន្ទាប់។</p>
          </section>

          <button type="button" className="btn-primary w-full" disabled={!preview.canClose} onClick={() => setConfirmClose(true)}>{labels.confirmClose}</button>
          {closings.length > 0 && (
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.periodClosing}</h3>
              <div className="space-y-2">
                {closings.map((closing) => (
                  <div key={closing.id} className="card flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{formatDate(closing.startDate)} — {formatDate(closing.endDate)}</p>
                      <p className="text-xs text-slate-500">{closing.status === 'ACTIVE' ? labels.active : labels.reopen}</p>
                    </div>
                    <p className="amount shrink-0 font-extrabold text-brand-800">{formatMoney(closing.closingBalance)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog open={confirmSettle} onClose={() => setConfirmSettle(false)} onConfirm={recordSettlement} busy={busy}
        title={labels.recordPayment} message={`${labels.areYouSure} ${labels.recordPayment} ${formatMoney(settlement.amount)}?`} />
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} onConfirm={closePeriod} busy={busy} danger
        title={labels.confirmClose} message="បិទបញ្ជីខួបនេះនឹងរក្សាទុករបាយការណ៍ច្បាស់លាស់។ ប្រតិបត្តិការក្នុងខួបនេះលែងអាចកែប្រែបានទេ (លុះត្រាតែបើកឡើងវិញដោយមានកត់ត្រា)។" confirmLabel={labels.closePeriod} />
    </>
  );
}
