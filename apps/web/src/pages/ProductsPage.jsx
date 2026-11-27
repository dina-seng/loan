import { useCallback, useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api.js';
import { labels, errorMessage } from '../i18n/labels.js';
import { useToast } from '../components/Toast.jsx';
import { ConfirmDialog, Field, InlineError, Modal, PageHeader } from '../components/Ui.jsx';
import { PackageIcon, PlusIcon } from '../components/Icons.jsx';
import { formatMoney, normalizeAmountInput } from '../utils/money.js';

const empty = { name: '', unit: '', description: '', unitPrice: '' };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [toggle, setToggle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { show } = useToast();

  const load = useCallback(async () => {
    try {
      const { data } = await api('/products?includeInactive=true');
      setProducts(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEdit = (product) => {
    setEditing(product || { id: null });
    setForm(product ? { name: product.name, unit: product.unit, description: product.description || '', unitPrice: String(product.unitPrice) } : empty);
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.unit.trim()) return setError('សូមបញ្ចូលឈ្មោះ និងឯកតា');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), unit: form.unit.trim(), description: form.description || null, unitPrice: normalizeAmountInput(form.unitPrice) || '0' };
      if (editing.id) await api(`/products/${editing.id}`, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body, idempotencyKey: newIdempotencyKey() });
      show(labels.saved);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    setBusy(true);
    try {
      await api(`/products/${toggle.id}`, { method: 'PATCH', body: { isActive: !toggle.isActive } });
      show(labels.saved);
      setToggle(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const visible = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHeader title={labels.products} subtitle={`${products.length} ប្រភេទទំនិញ`} action={
        <button type="button" className="btn-primary" onClick={() => openEdit(null)}><PlusIcon className="h-5 w-5" />{labels.addProduct}</button>
      } />

      <div className="mb-4"><input className="input" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <InlineError message={error} />

      {visible.length === 0 ? <p className="card p-6 text-center text-sm text-slate-500">{labels.noData}</p> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <article key={product.id} className={`card flex flex-col gap-2 p-3 ${product.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-extrabold text-slate-900">{product.name}</h3>
                  <p className="text-xs text-slate-500">{product.unit} · {product.isActive ? labels.active : labels.inactive}</p>
                </div>
                <PackageIcon className="h-5 w-5 shrink-0 text-brand-600" />
              </div>
              <p className="text-xs text-slate-600">{formatMoney(product.unitPrice)} / {product.unit}</p>
              {product.description && <p className="line-clamp-2 text-xs text-slate-500">{product.description}</p>}
              <div className="mt-auto flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={() => openEdit(product)}>{labels.edit}</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setToggle(product)}>{product.isActive ? labels.deactivate : labels.activate}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? labels.edit : labels.addProduct} footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(null)}>{labels.cancel}</button>
          <button form="product-form" type="submit" className="btn-primary flex-[2]" disabled={busy}>{busy ? labels.loading : labels.save}</button>
        </div>
      }>
        <form id="product-form" onSubmit={save} className="space-y-3">
          <Field label={labels.productName}><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={labels.unit}><input className="input" value={form.unit} placeholder="កាប់, គីឡូក្រាម..." onChange={(event) => setForm({ ...form, unit: event.target.value })} maxLength={40} /></Field>
            <Field label={labels.unitPrice} hint="តម្លៃបច្ចុប្បន្ន (ការទទួលទំនិញចាស់មិនប្រែប្រួល)">
              <input className="input" inputMode="numeric" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value.replace(/[^\d]/g, '') })} />
            </Field>
          </div>
          <Field label={labels.note}><textarea className="input min-h-[70px] py-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={500} /></Field>
          <InlineError message={error} />
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(toggle)} onClose={() => setToggle(null)} onConfirm={confirmToggle} busy={busy}
        title={toggle?.isActive ? labels.deactivate : labels.activate}
        message={`${labels.areYouSure} ${toggle?.isActive ? labels.deactivate : labels.activate} «${toggle?.name || ''}»?`} />
    </>
  );
}
