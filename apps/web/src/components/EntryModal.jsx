import { useEffect, useMemo, useRef, useState } from 'react';
import { api, newIdempotencyKey } from '../api.js';
import { labels } from '../i18n/labels.js';
import { errorMessage } from '../i18n/labels.js';
import { formatMoney, normalizeAmountInput, todayISO } from '../utils/money.js';
import { AmountField, Field, InlineError, Modal } from './Ui.jsx';

const tabs = [
  { id: 'lending', label: labels.moneyLending },
  { id: 'delivery', label: labels.productDelivery },
  { id: 'payment', label: labels.payment },
];

const emptyItem = () => ({ productId: '', quantity: '', unitPrice: '' });

export default function EntryModal({ open, onClose, defaultTab = 'lending', onSaved }) {
  const [tab, setTab] = useState(defaultTab);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [direction, setDirection] = useState('OUDOM_TO_DAD');
  const [method, setMethod] = useState('cash');
  const [items, setItems] = useState([emptyItem()]);
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keyRef = useRef(newIdempotencyKey());

  useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
    setDate(todayISO());
    setAmount('');
    setNote('');
    setReference('');
    setDirection('OUDOM_TO_DAD');
    setMethod('cash');
    setItems([emptyItem()]);
    setError('');
    keyRef.current = newIdempotencyKey();
    api('/products').then(({ data }) => setProducts(data)).catch(() => setProducts([]));
  }, [open, defaultTab]);

  const deliveryTotal = useMemo(() => items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(normalizeAmountInput(item.unitPrice)) || 0;
    return sum + Math.round(quantity * price);
  }, 0), [items]);

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  async function submit(event) {
    event.preventDefault();
    setError('');
    const money = normalizeAmountInput(amount);
    if (!date) return setError('សូមជ្រើសរើសកាលបរិច្ឆេទ');
    if ((tab === 'lending' || tab === 'payment') && !money) return setError('សូមបញ្ចូលចំនួនលុយ');

    setBusy(true);
    try {
      if (tab === 'lending') {
        await api('/lending', { method: 'POST', idempotencyKey: keyRef.current, body: { transactionDate: date, amount: money, note: note || null } });
      } else if (tab === 'payment') {
        await api('/payments', { method: 'POST', idempotencyKey: keyRef.current, body: { paymentDate: date, direction, amount: money, method, note: note || null } });
      } else {
        if (!reference.trim()) return setError('សូមបញ្ចូលលេខយោង');
        if (items.some((item) => !item.productId || !item.quantity || !normalizeAmountInput(item.unitPrice))) {
          return setError('សូមបំពេញទំនិញគ្រប់ជួរ');
        }
        await api('/deliveries', {
          method: 'POST', idempotencyKey: keyRef.current,
          body: {
            reference: reference.trim(), deliveryDate: date, note: note || null,
            items: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: normalizeAmountInput(item.unitPrice),
            })),
          },
        });
      }
      keyRef.current = newIdempotencyKey();
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={labels.addTransaction} wide={tab === 'delivery'} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>{labels.cancel}</button>
        <button form="entry-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
      </div>
    }>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((item) => (
          <button key={item.id} type="button" onClick={() => { setTab(item.id); setError(''); }}
            className={`min-h-[40px] rounded-lg px-1 text-[11px] font-bold leading-tight sm:text-sm ${tab === item.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <form id="entry-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.date}>
            <input className="input" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
          </Field>
          {tab === 'delivery' && (
            <Field label={labels.reference}>
              <input className="input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="DO-0001" maxLength={80} />
            </Field>
          )}
        </div>

        {tab === 'lending' && <AmountField label={labels.amount} value={amount} onChange={setAmount} hint={labels.moneyLending} />}

        {tab === 'payment' && (
          <>
            <Field label={labels.direction}>
              <select className="input" value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="OUDOM_TO_DAD">{labels.oudomPaysDad}</option>
                <option value="DAD_TO_OUDOM">{labels.dadPaysOudom}</option>
              </select>
            </Field>
            <AmountField label={labels.amount} value={amount} onChange={setAmount} />
            <Field label={labels.note}>
              <select className="input" value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="cash">{labels.cash}</option>
                <option value="bank">{labels.bank}</option>
                <option value="other">{labels.other}</option>
              </select>
            </Field>
          </>
        )}

        {tab === 'delivery' && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">{labels.productDelivery}</p>
            {items.map((item, index) => {
              const lineTotal = Math.round((Number(item.quantity) || 0) * (Number(normalizeAmountInput(item.unitPrice)) || 0));
              return (
                <div key={index} className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                    {items.length > 1 && (
                      <button type="button" className="text-xs font-bold text-red-600" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}>{labels.removeItem}</button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label={labels.productName}>
                      <select className="input" value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)}>
                        <option value="">—</option>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </select>
                    </Field>
                    <Field label={`${labels.quantity} (${products.find((p) => p.id === item.productId)?.unit || ''})`}>
                      <input className="input" inputMode="decimal" value={item.quantity} placeholder="0" onChange={(event) => updateItem(index, 'quantity', event.target.value.replace(/[^\d.]/g, ''))} />
                    </Field>
                    <Field label={labels.unitPrice}>
                      <input className="input" inputMode="numeric" value={item.unitPrice} placeholder="0" onChange={(event) => updateItem(index, 'unitPrice', event.target.value.replace(/[^\d]/g, ''))} />
                    </Field>
                  </div>
                  <p className="mt-2 text-right text-xs font-bold text-slate-600">{labels.lineTotal}: {formatMoney(lineTotal)}</p>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn-secondary" onClick={() => setItems((prev) => [...prev, emptyItem()])}>+ {labels.addItem}</button>
              <p className="amount text-lg font-extrabold text-brand-800" data-testid="delivery-total">{labels.total}: {formatMoney(deliveryTotal)}</p>
            </div>
          </div>
        )}

        <Field label={labels.note}>
          <textarea className="input min-h-[70px] py-2" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <InlineError message={error} />
      </form>
    </Modal>
  );
}
