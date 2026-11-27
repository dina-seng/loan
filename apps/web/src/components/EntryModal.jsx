import { useEffect, useRef, useState } from 'react';
import { api, newEntryId } from '../api.js';
import { labels, errorMessage } from '../i18n/labels.js';
import { usePartner } from '../partners.jsx';
import { normalizeAmountInput, todayISO } from '../utils/money.js';
import { AmountField, Field, InlineError, Modal } from './Ui.jsx';

const tabs = [
  { id: 'LEND', label: labels.lend },
  { id: 'PRODUCT', label: labels.product },
];

/** Add a lend or a product entry. Settling has its own one-button action. */
export default function EntryModal({ open, onClose, defaultType = 'LEND', onSaved }) {
  const { partner } = usePartner();
  const [type, setType] = useState(defaultType);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // One id per save attempt: retrying after a network error reuses it, so the
  // server sees the same id and never writes a second row.
  const idRef = useRef(newEntryId());

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setDate(todayISO());
    setAmount('');
    setNote('');
    setError('');
    idRef.current = newEntryId();
  }, [open, defaultType]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const money = normalizeAmountInput(amount);
    if (!date) return setError('សូមជ្រើសរើសកាលបរិច្ឆេទ');
    if (!money) return setError('សូមបញ្ចូលចំនួនទឹកប្រាក់');

    setBusy(true);
    try {
      await api('/entries', {
        method: 'POST',
        body: { id: idRef.current, type, date, amount: money, note: note || null },
      });
      idRef.current = newEntryId();
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={labels.add} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>{labels.cancel}</button>
        <button form="entry-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
      </div>
    }>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((item) => (
          <button key={item.id} type="button" onClick={() => { setType(item.id); setError(''); }}
            className={`min-h-[40px] rounded-lg px-1 text-sm font-bold ${type === item.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <form id="entry-form" onSubmit={submit} className="space-y-4">
        <Field label={labels.date}>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <AmountField label={labels.amount} value={amount} onChange={setAmount} hint={partner?.name} />
        <Field label={labels.note}>
          <textarea className="input min-h-[70px] py-2" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <InlineError message={error} />
      </form>
    </Modal>
  );
}
