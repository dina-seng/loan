import { useState } from 'react';
import { labels, dadOwesPartner, partnerOwesDad } from '../i18n/labels.js';
import { usePartner } from '../partners.jsx';
import { useToast } from './Toast.jsx';
import { AmountField, Field, InlineError, Modal } from './Ui.jsx';
import { CheckIcon, ChevronDownIcon, PlusIcon } from './Icons.jsx';
import { formatMoney, normalizeAmountInput } from '../utils/money.js';

export default function PartnerSwitcher({ compact = false }) {
  const { partners, partner, selectPartner, createPartner, updatePartner } = usePartner();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', note: '', openingBalance: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  const openEditor = (existing) => {
    setForm(existing ? {
      name: existing.name, phone: existing.phone || '', note: existing.note || '',
      openingBalance: String(existing.openingBalance),
    } : { name: '', phone: '', note: '', openingBalance: '0' });
    setEditing(existing ? existing.id : 'new');
    setError('');
    setOpen(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('សូមបញ្ចូលឈ្មោះដៃគូ');
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone || null,
        note: form.note || null,
        ...(editing === 'new' ? { openingBalance: normalizeAmountInput(form.openingBalance) || '0' } : {}),
      };
      if (editing === 'new') await createPartner(body);
      else await updatePartner(editing, body);
      show(labels.saved);
      setEditing(null);
      setOpen(true);
    } catch (err) {
      setError(err.message || labels.error);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      await updatePartner(partner.id, { isActive: !partner.isActive });
      show(labels.saved);
    } catch (err) {
      setError(err.message || labels.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-h-[44px] items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-white hover:bg-brand-600 ${compact ? 'max-w-[180px]' : ''}`}
        aria-label={labels.selectPartner}
      >
        <span className="truncate text-xs font-extrabold sm:text-sm">{partner?.name || labels.selectPartner}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={labels.selectPartner} footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)}>{labels.cancel}</button>
          <button type="button" className="btn-primary flex-1" onClick={() => openEditor('new')}><PlusIcon className="h-5 w-5" />{labels.addPartner}</button>
        </div>
      }>
        <div className="space-y-2">
          {partners.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { selectPartner(item.id); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-left ${item.id === partner?.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-extrabold text-slate-900">
                  <span className="truncate">{item.name}</span>
                  <span className={`chip ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.isActive ? labels.active : labels.inactive}
                  </span>
                </p>
                <p className="amount text-xs text-slate-500">{formatMoney(item.balance)} · {item.direction === 'PARTNER_OWES_DAD' ? partnerOwesDad(item.name) : item.direction === 'DAD_OWES_PARTNER' ? dadOwesPartner(item.name) : labels.accountSettled}</p>
              </div>
              {item.id === partner?.id && <CheckIcon className="h-5 w-5 shrink-0 text-brand-700" />}
            </button>
          ))}
          {partner && (
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-secondary flex-1" onClick={() => openEditor(partner)}>{labels.editName}</button>
              <button type="button" className="btn-secondary flex-1" onClick={toggleActive} disabled={busy}>
                {partner.isActive ? labels.inactive : labels.active}
              </button>
            </div>
          )}
          <InlineError message={error} />
        </div>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => { setEditing(null); setOpen(true); }} title={editing === 'new' ? labels.addPartner : labels.editName} footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => { setEditing(null); setOpen(true); }}>{labels.cancel}</button>
          <button form="partner-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
        </div>
      }>
        <form id="partner-form" onSubmit={save} className="space-y-3">
          <Field label={labels.partnerName}><input className="input" value={form.name} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label={labels.phone}><input className="input" inputMode="tel" value={form.phone} maxLength={40} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          {editing === 'new' && <AmountField label={labels.openingBalanceFor} value={form.openingBalance} onChange={(value) => setForm({ ...form, openingBalance: value })} hint="សមតុល្យដើមអាចទុក ០" />}
          <Field label={labels.note}><textarea className="input min-h-[70px] py-2" value={form.note} maxLength={500} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
          <InlineError message={error} />
        </form>
      </Modal>
    </>
  );
}
