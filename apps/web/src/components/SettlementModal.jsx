import { useEffect, useRef, useState } from 'react';
import { api, newEntryId } from '../api.js';
import { closedPeriodMessage, labels, errorMessage } from '../strings.km.js';
import { normalizeAmountInput, todayISO } from '../utils/money.js';
import { Field, InlineError, Modal } from './Ui.jsx';

/** A payment in either direction: full balance or an exact partial amount. */
export default function SettlementModal({ open, onClose, firstOpenDate, onSaved }) {
  const [date, setDate] = useState(todayISO());
  const [direction, setDirection] = useState('PARTNER_TO_DAD');
  const [amount, setAmount] = useState('');
  const [fullBalance, setFullBalance] = useState(true);
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const idRef = useRef(newEntryId());

  useEffect(() => {
    if (!open) return;
    setDate(firstOpenDate || todayISO());
    setAmount('');
    setFullBalance(true);
    setMethod('cash');
    setNote('');
    setReference('');
    setError('');
    setWarning(firstOpenDate ? labels.closedPeriodDefault : '');
    idRef.current = newEntryId();
    api('/settlements/current').then(({ data }) => {
      setCurrent(data);
      if (data.direction !== 'SETTLED') setDirection(data.direction);
    }).catch(() => setCurrent(null));
  }, [open, firstOpenDate]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!date) return setError(labels.dateRequired);
    if (!fullBalance && !normalizeAmountInput(amount)) return setError(labels.amountRequired);

    setBusy(true);
    try {
      await api('/settlements', {
        method: 'POST',
        body: {
          id: idRef.current,
          paymentDate: date,
          direction,
          fullBalance,
          ...(fullBalance ? {} : { amount: normalizeAmountInput(amount) }),
          method,
          note: note || null,
          reference: reference || null,
        },
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
    <Modal open={open} onClose={onClose} title={labels.addSettlement} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>{labels.cancel}</button>
        <button form="settlement-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
      </div>
    }>
      <form id="settlement-form" onSubmit={submit} className="space-y-4">
        {current && (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700" data-testid="settlement-current">
            {labels.balanceHeadline}: {current.balance}
          </p>
        )}
        <Field label={labels.date}>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label={labels.direction}>
          <select className="input" value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="PARTNER_TO_DAD">{labels.partnerToDad}</option>
            <option value="DAD_TO_PARTNER">{labels.dadToPartner}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={fullBalance} onChange={(event) => setFullBalance(event.target.checked)} />
          {labels.fullBalance}
        </label>
        {!fullBalance && (
          <Field label={labels.amount}>
            <input className="input amount text-right" inputMode="numeric" value={amount} placeholder="0" onChange={(event) => setAmount(normalizeAmountInput(event.target.value))} />
          </Field>
        )}
        <Field label={labels.method}>
          <select className="input" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="cash">{labels.cash}</option>
            <option value="bank">{labels.bank}</option>
            <option value="other">{labels.other}</option>
          </select>
        </Field>
        <Field label={labels.reference}>
          <input className="input" value={reference} maxLength={80} onChange={(event) => setReference(event.target.value)} />
        </Field>
        <Field label={labels.note}>
          <textarea className="input min-h-[70px] py-2" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {warning && <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{warning}</p>}
        <InlineError message={error} />
      </form>
    </Modal>
  );
}
