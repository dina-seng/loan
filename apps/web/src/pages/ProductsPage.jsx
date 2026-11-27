import { useCallback, useEffect, useState } from 'react';
import { api, newEntryId } from '../api.js';
import { labels, errorMessage, RIER } from '../strings.km.js';
import { useToast } from '../components/Toast.jsx';
import { ConfirmDialog, EmptyState, Field, InlineError, Modal, PageHeader } from '../components/Ui.jsx';
import { normalizeAmountInput } from '../utils/money.js';

const emptyForm = () => ({ id: null, name: '', unit: '', defaultUnitPrice: '', note: '' });

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [deactivate, setDeactivate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { show } = useToast();

  const load = useCallback(async () => {
    try {
      const { data } = await api('/products?pageSize=100');
      setProducts(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        unit: form.unit || null,
        defaultUnitPrice: form.defaultUnitPrice ? normalizeAmountInput(form.defaultUnitPrice) : null,
        note: form.note || null,
      };
      if (form.id) await api(`/products/${form.id}`, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body: { id: newEntryId(), ...body } });
      show(labels.saved);
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeactivate = async () => {
    setBusy(true);
    try {
      await api(`/products/${deactivate.id}/deactivate`, { method: 'POST' });
      show(labels.saved);
      setDeactivate(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={labels.products} action={
        <button type="button" className="btn-primary" onClick={() => setForm(emptyForm())}>{labels.addProduct}</button>
      } />
      <InlineError message={error} />
      {!products.length ? <EmptyState message={labels.noProducts} /> : (
        <div className="space-y-2">
          {products.map((product) => (
            <article key={product.id} className={`card flex items-start justify-between gap-3 p-3 ${product.isActive ? '' : 'opacity-60'}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-900">{product.name}</p>
                <p className="text-xs text-slate-500">
                  {product.defaultUnitPrice == null ? '' : `${RIER}${product.defaultUnitPrice}`}
                  {product.unit ? ` / ${product.unit}` : ''}
                  {!product.isActive ? ` · ${labels.deactivate}` : ''}
                </p>
                {product.note && <p className="mt-1 truncate text-xs text-slate-600">{product.note}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button type="button" className="text-xs font-bold text-brand-700 underline" onClick={() => setForm({
                  id: product.id,
                  name: product.name,
                  unit: product.unit || '',
                  defaultUnitPrice: product.defaultUnitPrice || '',
                  note: product.note || '',
                })}>{labels.editName}</button>
                {product.isActive && (
                  <button type="button" className="text-xs font-bold text-red-600 underline" onClick={() => setDeactivate(product)}>{labels.deactivate}</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? labels.editName : labels.addProduct} footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setForm(null)}>{labels.cancel}</button>
          <button form="product-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
        </div>
      }>
        <form id="product-form" onSubmit={save} className="space-y-3">
          <Field label={labels.productName}>
            <input className="input" value={form?.name || ''} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label={labels.unit}>
            <input className="input" value={form?.unit || ''} maxLength={40} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </Field>
          <Field label={labels.defaultUnitPrice}>
            <input className="input amount text-right" inputMode="numeric" value={form?.defaultUnitPrice || ''} placeholder="0" onChange={(event) => setForm({ ...form, defaultUnitPrice: normalizeAmountInput(event.target.value) })} />
          </Field>
          <Field label={labels.note}>
            <textarea className="input min-h-[70px] py-2" value={form?.note || ''} maxLength={500} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deactivate)} onClose={() => setDeactivate(null)} onConfirm={confirmDeactivate} busy={busy} danger
        title={labels.deactivate} message={labels.deactivateConfirm} confirmLabel={labels.deactivate} />
    </>
  );
}
