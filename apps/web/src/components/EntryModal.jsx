import { useEffect, useRef, useState } from 'react';
import { api, newEntryId } from '../api.js';
import { closedPeriodMessage, labels, errorMessage } from '../strings.km.js';
import { usePartner } from '../partners.jsx';
import { normalizeAmountInput, todayISO } from '../utils/money.js';
import { AmountField, Field, InlineError, Modal } from './Ui.jsx';

/** Add a lend entry. Product deliveries have their own multi-line modal. */
export default function EntryModal({ open, onClose, firstOpenDate, onSaved }) {
  const { partner } = usePartner();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const idRef = useRef(newEntryId());

  useEffect(() => {
    if (!open) return;
    setDate(firstOpenDate || todayISO());
    setAmount('');
    setNote('');
    setError('');
    setWarning(firstOpenDate ? labels.closedPeriodDefault : '');
    idRef.current = newEntryId();
  }, [open, firstOpenDate]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const money = normalizeAmountInput(amount);
    if (!date) return setError(labels.dateRequired);
    if (!money) return setError(labels.amountRequired);

    setBusy(true);
    try {
      await api('/entries', {
        method: 'POST',
        body: { id: idRef.current, type: 'LEND', date, amount: money, note: note || null },
      });
      idRef.current = newEntryId();
      await onSaved?.();
      onClose();
    } catch (err) {
      if (err.code === 'PERIOD_CLOSED' && err.details?.earliestAllowedDate) {
        setDate(err.details.earliestAllowedDate);
        setWarning(closedPeriodMessage(err.details));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={labels.lend} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>{labels.cancel}</button>
        <button form="lend-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
      </div>
    }>
      <form id="lend-form" onSubmit={submit} className="space-y-4">
        <Field label={labels.date}>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <AmountField label={labels.amount} value={amount} onChange={setAmount} hint={partner?.name} />
        <Field label={labels.note}>
          <textarea className="input min-h-[70px] py-2" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {warning && <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{warning}</p>}
        <InlineError message={error} />
      </form>
    </Modal>
  );
}
