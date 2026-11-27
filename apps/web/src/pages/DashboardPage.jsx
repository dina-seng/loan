import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, newEntryId } from '../api.js';
import { closedPeriodMessage, labels, errorMessage } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { BalanceCard, ConfirmDialog, EmptyState, InlineError, PageHeader, SummaryCard } from '../components/Ui.jsx';
import EntryModal from '../components/EntryModal.jsx';
import DeliveryModal from '../components/DeliveryModal.jsx';
import SettlementModal from '../components/SettlementModal.jsx';
import EntryList from '../components/EntryList.jsx';
import { BanknoteIcon, PackageIcon } from '../components/Icons.jsx';
import { ScaleIcon } from '../components/NavIcons.jsx';
import { todayISO } from '../utils/money.js';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const settleIdRef = useRef(newEntryId());
  const { show } = useToast();
  const { partner, refresh } = usePartner();

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const { data: result } = await api(`/dashboard${params.size ? `?${params}` : ''}`);
      setData(result);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [partner?.id, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const isCleared = data?.direction === 'SETTLED';

  const settle = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      await api(`/partners/${partner.id}/settle`, {
        method: 'POST',
        body: { id: settleIdRef.current, date: data?.firstOpenDate || todayISO() },
      });
      settleIdRef.current = newEntryId();
      show(labels.saved);
      setConfirmSettle(false);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      if (err.code === 'PERIOD_CLOSED' && err.details?.earliestAllowedDate) {
        setError(closedPeriodMessage(err.details));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const saved = async () => {
    await Promise.all([load(), refresh()]);
    show(labels.saved);
  };

  const quickActions = [
    { id: 'LEND', label: labels.lend, Icon: BanknoteIcon, style: 'bg-amber-50 text-amber-800 border-amber-200' },
    { id: 'DELIVERY', label: labels.product, Icon: PackageIcon, style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { id: 'SETTLEMENT', label: labels.settlements, Icon: ScaleIcon, style: 'bg-sky-50 text-sky-800 border-sky-200' },
  ];

  return (
    <>
      <PageHeader title={labels.dashboard} subtitle={partner?.name} />

      <InlineError message={error} />
      {!data ? <div className="py-16 text-center text-slate-500">{labels.loading}</div> : (
        <div className="space-y-5">
          <BalanceCard balance={data.balance} direction={data.direction} />

          {data.closedPeriod && (
            <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              {closedPeriodMessage({
                lastClosedDate: data.closedPeriod.endDate,
                earliestAllowedDate: data.firstOpenDate,
              })}
            </p>
          )}

          <section>
            <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.statements}</h3>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">{labels.from}</span>
                <input className="input" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
              </label>
              <label className="block">
                <span className="label">{labels.to}</span>
                <input className="input" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label={labels.totalLent} amount={data.totals.totalLent} icon={BanknoteIcon} accent="text-amber-800" testId="total-lent" />
              <SummaryCard label={labels.totalProductValue} amount={data.totals.totalProductValue} icon={PackageIcon} accent="text-emerald-700" testId="total-products" />
              <SummaryCard label={labels.receivedPayments} amount={data.totals.receivedPayments} icon={ScaleIcon} accent="text-sky-700" testId="total-received" />
              <SummaryCard label={labels.outgoingPayments} amount={data.totals.outgoingPayments} icon={ScaleIcon} accent="text-violet-700" testId="total-paid-out" />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {labels.transactionCount}: {data.totals.transactionCount} · {labels.netFlow}: {data.netFlow}
            </p>
          </section>

          <button
            type="button"
            className="btn-settle w-full"
            disabled={isCleared || busy}
            onClick={() => setConfirmSettle(true)}
          >
            {labels.settle}
          </button>

          <section>
            <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.add}</h3>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map(({ id, label, Icon, style }) => (
                <button key={id} type="button" onClick={() => setModal(id)}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center text-xs font-extrabold transition-transform active:scale-[0.98] ${style}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">{labels.recent}</h3>
              <Link to="/history" className="text-xs font-bold text-brand-700 hover:underline">{labels.viewAll} →</Link>
            </div>
            {data.recentEntries?.length ? <EntryList entries={data.recentEntries} /> : <EmptyState />}
          </section>
        </div>
      )}

      <EntryModal open={modal === 'LEND'} firstOpenDate={data?.firstOpenDate}
        onClose={() => setModal(null)} onSaved={saved} />
      <DeliveryModal open={modal === 'DELIVERY'} firstOpenDate={data?.firstOpenDate}
        onClose={() => setModal(null)} onSaved={saved} />
      <SettlementModal open={modal === 'SETTLEMENT'} firstOpenDate={data?.firstOpenDate}
        onClose={() => setModal(null)} onSaved={saved} />

      <ConfirmDialog open={confirmSettle} onClose={() => setConfirmSettle(false)} onConfirm={settle} busy={busy}
        title={labels.settle} message={labels.settleConfirm} confirmLabel={labels.settle} />
    </>
  );
}
