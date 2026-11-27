import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { labels, errorMessage } from '../i18n/labels.js';
import { useToast } from '../components/Toast.jsx';
import { BalanceCard, EmptyState, InlineError, PageHeader, SummaryCard } from '../components/Ui.jsx';
import EntryModal from '../components/EntryModal.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { BanknoteIcon, PackageIcon, PlusIcon } from '../components/Icons.jsx';
import { formatDate, todayISO } from '../utils/money.js';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [periodId, setPeriodId] = useState('');
  const [entryTab, setEntryTab] = useState(null);
  const [error, setError] = useState('');
  const { show } = useToast();

  const load = useCallback(async () => {
    try {
      const { data: result } = await api(`/dashboard${periodId ? `?periodId=${periodId}` : ''}`);
      setData(result);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [periodId]);

  useEffect(() => { load(); }, [load]);

  const quickActions = [
    { tab: 'lending', label: labels.recordLending, Icon: BanknoteIcon, style: 'bg-amber-50 text-amber-800 border-amber-200' },
    { tab: 'delivery', label: labels.recordDelivery, Icon: PackageIcon, style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { tab: 'payment', label: labels.recordPayment, Icon: PlusIcon, style: 'bg-sky-50 text-sky-800 border-sky-200' },
  ];

  return (
    <>
      <PageHeader
        title={labels.dashboard}
        subtitle={`${formatDate(todayISO())} · ${data?.account?.partnerName || labels.account}`}
        action={
          <select className="input w-full sm:w-64" value={periodId} onChange={(event) => setPeriodId(event.target.value)} aria-label={labels.periodClosing}>
            <option value="">{labels.currentPeriod}</option>
            {data?.periods?.map((period) => (
              <option key={period.id} value={period.id}>
                {formatDate(period.startDate)} — {formatDate(period.endDate)}
              </option>
            ))}
          </select>
        }
      />

      <InlineError message={error} />
      {!data ? <div className="py-16 text-center text-slate-500">{labels.loading}</div> : (
        <div className="space-y-5">
          <BalanceCard balance={data.balance} direction={data.direction} openingBalance={data.period?.isHistorical ? undefined : data.account?.openingBalance} />

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <SummaryCard label={labels.shortMoneyLent} amount={data.totals.totalLent} icon={BanknoteIcon} accent="text-amber-700" testId="total-lent" />
            <SummaryCard label={labels.shortProductValue} amount={data.totals.totalProductValue} icon={PackageIcon} accent="text-emerald-700" testId="total-products" />
            <SummaryCard label={labels.shortReceived} amount={data.totals.receivedPayments} icon={PlusIcon} accent="text-sky-700" testId="total-received" />
            <SummaryCard label={labels.shortOutgoing} amount={data.totals.outgoingPayments} icon={PlusIcon} accent="text-slate-700" testId="total-outgoing" />
          </div>

          <section>
            <h3 className="mb-2 text-sm font-extrabold text-slate-800">{labels.addTransaction}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {quickActions.map(({ tab, label, Icon, style }) => (
                <button key={tab} type="button" onClick={() => setEntryTab(tab)} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3 text-left text-sm font-extrabold transition-transform active:scale-[0.98] ${style}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">{labels.recentTransactions}</h3>
              <Link to="/transactions" className="text-xs font-bold text-brand-700 hover:underline">{labels.all} →</Link>
            </div>
            {data.recentTransactions?.length ? <TransactionList entries={data.recentTransactions} /> : <EmptyState />}
          </section>

          {data.period?.isHistorical && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              កំពុងមើលខួបកាលបរិច្ឆេទ {formatDate(data.period.startDate)} — {formatDate(data.period.endDate)} (របាយការណ៍ចាស់)
            </p>
          )}
          <p className="text-center text-xs text-slate-400">1 ៛ = 1 រៀល · ចំនួនទាំងអស់គណនាដោយប្រព័ន្ធ</p>
        </div>
      )}

      <EntryModal open={Boolean(entryTab)} defaultTab={entryTab || 'lending'} onClose={() => setEntryTab(null)} onSaved={async () => { await load(); show(labels.saved); }} />
    </>
  );
}
