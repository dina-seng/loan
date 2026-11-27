import { useState } from 'react';
import { labels } from '../strings.km.js';
import { usePartner } from '../partners.jsx';
import { useToast } from './Toast.jsx';
import { Field, InlineError, Modal } from './Ui.jsx';
import { CheckIcon, ChevronDownIcon, PlusIcon } from './Icons.jsx';
import { formatPositive } from '../utils/money.js';

export default function PartnerSwitcher({ compact = false }) {
  const { partners, partner, selectPartner, createPartner, updatePartner } = usePartner();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  const openEditor = (existing) => {
    setForm({ name: existing ? existing.name : '' });
    setEditing(existing ? existing.id : 'new');
    setError('');
    setOpen(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError(labels.partnerRequired);
    setBusy(true);
    try {
      const body = { name: form.name };
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
                <p className="truncate text-sm font-extrabold text-slate-900">{item.name}</p>
                <p className="amount text-xs text-slate-500">{formatPositive(item.balance)} · {item.direction === 'PARTNER_OWES_US' ? labels.theyOweUs : item.direction === 'WE_OWE_PARTNER' ? labels.weOweThem : labels.cleared}</p>
              </div>
              {item.id === partner?.id && <CheckIcon className="h-5 w-5 shrink-0 text-brand-700" />}
            </button>
          ))}
          {partner && (
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-secondary flex-1" onClick={() => openEditor(partner)}>{labels.editName}</button>
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
          <InlineError message={error} />
        </form>
      </Modal>
    </>
  );
}
