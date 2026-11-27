import { useEffect, useRef, useState } from 'react';
import { api, newEntryId } from '../api.js';
import { closedPeriodMessage, labels, errorMessage } from '../strings.km.js';
import { normalizeAmountInput, normalizeQuantityInput, todayISO } from '../utils/money.js';
import { Field, InlineError, Modal } from './Ui.jsx';

const emptyLine = () => ({ productId: '', productName: '', unit: '', quantity: '', unitPrice: '', note: '' });

/** Multi-line delivery. Totals are computed by the server, never here. */
export default function DeliveryModal({ open, onClose, firstOpenDate, onSaved }) {
  const [products, setProducts] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const idRef = useRef(newEntryId());

  useEffect(() => {
    if (!open) return;
    setDate(firstOpenDate || todayISO());
    setNote('');
    setLines([emptyLine()]);
    setError('');
    setWarning(firstOpenDate ? labels.closedPeriodDefault : '');
    idRef.current = newEntryId();
    api('/products?pageSize=100').then(({ data }) => setProducts(data)).catch(() => setProducts([]));
  }, [open, firstOpenDate]);

  function updateLine(index, patch) {
    setLines((previous) => previous.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function chooseProduct(index, id) {
    const product = products.find((item) => item.id === id);
    updateLine(index, product ? {
      productId: product.id,
      productName: product.name,
      unit: product.unit || '',
      unitPrice: product.defaultUnitPrice || '',
    } : { productId: '', productName: '', unit: '', unitPrice: '' });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!date) return setError(labels.dateRequired);
    if (!lines.length) return setError(labels.linesRequired);
    if (lines.some((line) => !line.productId)) return setError(labels.productRequired);
    if (lines.some((line) => !line.quantity)) return setError(labels.quantityRequired);

    setBusy(true);
    try {
      await api('/deliveries', {
        method: 'POST',
        body: {
          id: idRef.current,
          deliveryDate: date,
          note: note || null,
          items: lines.map((line) => ({
            productId: line.productId,
            unit: line.unit || null,
            quantity: normalizeQuantityInput(line.quantity),
            unitPrice: line.unitPrice ? normalizeAmountInput(line.unitPrice) : null,
            note: line.note || null,
          })),
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
    <Modal open={open} onClose={onClose} title={labels.addDelivery} wide footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>{labels.cancel}</button>
        <button form="delivery-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
      </div>
    }>
      <form id="delivery-form" onSubmit={submit} className="space-y-4">
        <Field label={labels.date}>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
        </Field>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={labels.selectProduct}>
                  <select className="input" value={line.productId} onChange={(event) => chooseProduct(index, event.target.value)}>
                    <option value="">{labels.selectProduct}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label={labels.quantity}>
                  <input className="input" inputMode="decimal" value={line.quantity} placeholder="0" onChange={(event) => updateLine(index, { quantity: normalizeQuantityInput(event.target.value) })} />
                </Field>
                <Field label={labels.unitPrice}>
                  <input className="input" inputMode="numeric" value={line.unitPrice} placeholder="0" onChange={(event) => updateLine(index, { unitPrice: normalizeAmountInput(event.target.value) })} />
                </Field>
              </div>
              {lines.length > 1 && (
                <button type="button" className="mt-2 text-xs font-bold text-red-600 underline" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                  {labels.removeLine}
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary w-full" onClick={() => setLines((prev) => [...prev, emptyLine()])}>{labels.addLine}</button>
        </div>

        <Field label={labels.note}>
          <textarea className="input min-h-[70px] py-2" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {warning && <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{warning}</p>}
        <InlineError message={error} />
      </form>
    </Modal>
  );
}
