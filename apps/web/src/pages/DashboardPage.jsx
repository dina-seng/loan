import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, newEntryId } from '../api.js';
import { labels, errorMessage } from '../i18n/labels.js';
import { useToast } from '../components/Toast.jsx';
import { usePartner } from '../partners.jsx';
import { BalanceCard, ConfirmDialog, EmptyState, InlineError, PageHeader } from '../components/Ui.jsx';
import EntryModal from '../components/EntryModal.jsx';
import EntryList from '../components/EntryList.jsx';
import { BanknoteIcon, PackageIcon } from '../components/Icons.jsx';
import { todayISO } from '../utils/money.js';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [entryType, setEntryType] = useState(null);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const settleIdRef = useRef(newEntryId());
  const { show } = useToast();
  const { partner, refresh } = usePartner();

  const load = useCallback(async () => {
    try {
      const { data: result } = await api('/dashboard');
      setData(result);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [partner?.id]);

  useEffect(() => { load(); }, [load]);

  const isCleared = data?.direction === 'SETTLED';

  const settle = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      await api(`/partners/${partner.id}/settle`, {
        method: 'POST',
        body: { id: settleIdRef.current, date: todayISO() },
      });
      settleIdRef.current = newEntryId();
      show(labels.saved);
      setConfirmSettle(false);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const quickActions = [
    { type: 'LEND', label: labels.lend, Icon: BanknoteIcon, style: 'bg-amber-50 text-amber-800 border-amber-200' },
    { type: 'PRODUCT', label: labels.product, Icon: PackageIcon, style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  ];

  return (
    <>
      <PageHeader title={labels.dashboard} subtitle={partner?.name} />

      <InlineError message={error} />
      {!data ? <div className="py-16 text-center text-slate-500">{labels.loading}</div> : (
        <div className="space-y-5">
          <BalanceCard balance={data.balance} direction={data.direction} />

          <button
            type="button"
            className="btn-primary w-full"
            disabled={isCleared || busy}
            onClick={() => setConfirmSettle(true)}
          >
            {labels.settle}
          </button>

          <section>
            <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.add}</h3>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(({ type, label, Icon, style }) => (
                <button key={type} type="button" onClick={() => setEntryType(type)}
                  className={`flex min-h-[56px] items-center gap-2 rounded-2xl border px-3 text-left text-sm font-extrabold transition-transform active:scale-[0.98] ${style}`}>
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

      <EntryModal open={Boolean(entryType)} defaultType={entryType || 'LEND'}
        onClose={() => setEntryType(null)}
        onSaved={async () => { await Promise.all([load(), refresh()]); show(labels.saved); }} />

      <ConfirmDialog open={confirmSettle} onClose={() => setConfirmSettle(false)} onConfirm={settle} busy={busy}
        title={labels.settle} message={labels.settleConfirm} confirmLabel={labels.settle} />
    </>
  );
}
