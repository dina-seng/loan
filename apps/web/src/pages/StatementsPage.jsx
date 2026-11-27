import { useCallback, useEffect, useState } from 'react';
import { api, downloadCsv } from '../api.js';
import { labels, errorMessage, RIER } from '../strings.km.js';
import { usePartner } from '../partners.jsx';
import { EmptyState, Field, InlineError, PageHeader, SummaryCard } from '../components/Ui.jsx';
import { BanknoteIcon, DownloadIcon, PackageIcon } from '../components/Icons.jsx';
import { ScaleIcon } from '../components/NavIcons.jsx';
import { formatDate } from '../utils/money.js';

const typeLabels = {
  LEND: labels.lend,
  PRODUCT: labels.product,
  SETTLE_IN: labels.settleIn,
  SETTLE_OUT: labels.settleOut,
};

export default function StatementsPage() {
  const { partner } = usePartner();
  const [range, setRange] = useState({ from: '', to: '' });
  const [statement, setStatement] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const query = params.size ? `?${params}` : '';
    try {
      const [report, totals] = await Promise.all([
        api(`/reports/statement${query}`),
        api(`/reports/summary${query}`),
      ]);
      setStatement(report.data);
      setSummary(totals.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [range.from, range.to, partner?.id]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    try {
      await downloadCsv(`/reports/transactions.csv${params.size ? `?${params}` : ''}`, 'statement.csv');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title={labels.statements} subtitle={partner?.name} action={
        <button type="button" className="btn-secondary" onClick={exportCsv}>
          <DownloadIcon className="h-5 w-5" />{labels.exportCsv}
        </button>
      } />
      <InlineError message={error} />

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Field label={labels.from}>
          <input className="input" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
        </Field>
        <Field label={labels.to}>
          <input className="input" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
        </Field>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label={labels.openingBalance} amount={summary.openingBalance} icon={ScaleIcon} />
          <SummaryCard label={labels.totalLent} amount={summary.totalLent} icon={BanknoteIcon} accent="text-amber-800" />
          <SummaryCard label={labels.totalProductValue} amount={summary.totalProductValue} icon={PackageIcon} accent="text-emerald-700" />
          <SummaryCard label={labels.balanceHeadline} amount={statement?.closingBalance || '0'} icon={ScaleIcon} accent="text-slate-800" />
        </div>
      )}

      {!statement?.lines?.length ? <EmptyState message={labels.noData} /> : (
        <div className="space-y-2">
          {statement.lines.map((line) => (
            <article key={line.id} className="card flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{formatDate(line.date)}</p>
                <p className="truncate text-sm font-bold text-slate-800">{typeLabels[line.type] || line.type}</p>
                {line.note && <p className="truncate text-xs text-slate-600">{line.note}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="amount text-sm font-extrabold text-slate-800">{RIER}{line.amount}</p>
                <p className="amount text-xs text-slate-500">{labels.balanceAfter}: {RIER}{line.balanceAfter}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
