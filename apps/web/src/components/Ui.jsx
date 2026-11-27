import { useEffect } from 'react';
import { labels, dadOwesPartner, partnerOwesDad } from '../i18n/labels.js';
import { balanceTone, formatMoney } from '../utils/money.js';
import { AlertCircleIcon, XIcon } from './Icons.jsx';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label={labels.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label={labels.cancel} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-slate-100 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = labels.confirm, danger = false, busy = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>{labels.cancel}</button>
        <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={onConfirm} disabled={busy}>{busy ? labels.loading : confirmLabel}</button>
      </div>
    }>
      <div className="flex gap-3">
        <AlertCircleIcon className={`h-6 w-6 shrink-0 ${danger ? 'text-red-500' : 'text-brand-600'}`} />
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    </Modal>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function AmountField({ label, value, onChange, placeholder = '0', hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">៛</span>
        <input
          className="input amount pl-8 text-right" inputMode="numeric" autoComplete="off"
          value={value} placeholder={placeholder}
          onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ''))}
        />
      </div>
    </Field>
  );
}

export function SummaryCard({ label, amount, icon: Icon, accent = 'text-brand-700', testId }) {
  return (
    <div className="card flex min-w-0 flex-col justify-between gap-2 p-3 sm:p-4" data-testid={testId}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${accent}`} />}
        <p className="truncate text-[11px] font-bold leading-tight text-slate-500 sm:text-xs">{label}</p>
      </div>
      <p className={`amount truncate text-base font-extrabold sm:text-xl ${accent}`}>{formatMoney(amount)}</p>
    </div>
  );
}

export function BalanceCard({ balance, direction, openingBalance, partnerName = 'អ៊ូដុំ', compact = false }) {
  const tone = balanceTone(direction);
  const message = direction === 'PARTNER_OWES_DAD' ? partnerOwesDad(partnerName)
    : direction === 'DAD_OWES_PARTNER' ? dadOwesPartner(partnerName) : labels.accountSettled;
  return (
    <section className={`card border-2 bg-gradient-to-br ${tone.bg} ${tone.border} ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
        <p className="text-xs font-bold text-slate-600 sm:text-sm">{labels.currentBalance}</p>
      </div>
      <p className={`amount mt-1 break-all text-3xl font-extrabold leading-tight sm:text-5xl ${tone.text}`} data-testid="balance-amount">{formatMoney(balance)}</p>
      <p className={`mt-2 text-sm font-bold sm:text-base ${tone.text}`}>{message}</p>
      {openingBalance !== undefined && <p className="mt-1 text-xs text-slate-500">{labels.openingBalance}: {formatMoney(openingBalance)}</p>}
    </section>
  );
}

export function EmptyState({ message = labels.noData, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-10 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}

export function InlineError({ message }) {
  if (!message) return null;
  return <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</p>;
}
