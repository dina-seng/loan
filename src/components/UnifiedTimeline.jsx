import { useState, useMemo } from 'react';
import { formatMoney, formatDate, normalizeDate } from '../utils';
import {
  BanknoteIcon,
  PackageIcon,
  Trash2Icon,
  AlertCircleIcon,
} from './Icons';

export default function UnifiedTimeline({
  transactions = [],
  products = [],
  isSpecificBorrower = false,
  activeBorrower = '',
  onDeleteTransaction,
  onDeleteProduct,
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'lend' | 'goods'
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Combine lending and goods into a single chronological timeline
  const timelineItems = useMemo(() => {
    const list = [];

    // 1. Lending transactions
    for (const t of transactions) {
      if (t.type === 'Lend') {
        list.push({
          id: t.id,
          kind: 'transaction',
          date: t.date,
          borrower: t.borrower,
          type: 'Lend',
          amount: Number(t.amount) || 0,
          note: t.note || '',
        });
      }
    }

    // 2. Received goods
    for (const p of products) {
      const itemTotal =
        p.total != null && !isNaN(p.total)
          ? Number(p.total)
          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
      list.push({
        id: p.id,
        kind: 'product',
        date: p.date,
        borrower: p.borrower,
        type: 'Goods',
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        amount: itemTotal,
        note: p.note || '',
      });
    }

    // Sort newest date first, then by id for stability
    list.sort((a, b) => {
      const dateCompare = normalizeDate(b.date).localeCompare(
        normalizeDate(a.date),
      );
      if (dateCompare !== 0) return dateCompare;
      return String(b.id).localeCompare(String(a.id));
    });

    return list;
  }, [transactions, products]);

  // Filter items (all | lend | goods)
  const filteredItems = useMemo(() => {
    if (filter === 'all') return timelineItems;
    if (filter === 'lend') return timelineItems.filter((i) => i.type === 'Lend');
    if (filter === 'goods') return timelineItems.filter((i) => i.kind === 'product');
    return timelineItems;
  }, [timelineItems, filter]);

  // Counts for pills
  const counts = useMemo(() => {
    let lendCount = 0;
    let goodsCount = 0;
    for (const item of timelineItems) {
      if (item.type === 'Lend') lendCount++;
      else if (item.kind === 'product') goodsCount++;
    }
    return {
      all: timelineItems.length,
      lend: lendCount,
      goods: goodsCount,
    };
  }, [timelineItems]);

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.kind === 'product') {
        await onDeleteProduct(confirmDelete.id);
      } else {
        await onDeleteTransaction(confirmDelete.id);
      }
      setConfirmDelete(null);
    } catch (err) {
      alert('មិនអាចលុបបានទេ: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card space-y-4 p-4 sm:p-6 shadow-sm border border-slate-100 rounded-2xl bg-white">
      {/* Header & 3-Pill Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">
            ប្រវត្តិនៃការកត់ត្រា
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
            {isSpecificBorrower
              ? `រាល់ការឱ្យខ្ចី និងទទួលទំនិញរបស់ ${activeBorrower}`
              : 'រាល់ការឱ្យខ្ចី និងទទួលទំនិញរួម'}
          </p>
        </div>

        {/* 3 Simple Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-[42px] px-4 py-2 rounded-full text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>ទាំងអស់</span>
            <span className="text-xs opacity-75">({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('lend')}
            className={`min-h-[42px] px-4 py-2 rounded-full text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              filter === 'lend'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <BanknoteIcon className="w-4 h-4" />
            <span>ឱ្យខ្ចីលុយ</span>
            <span className="text-xs opacity-75">({counts.lend})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('goods')}
            className={`min-h-[42px] px-4 py-2 rounded-full text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              filter === 'goods'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <PackageIcon className="w-4 h-4" />
            <span>ទទួលទំនិញ</span>
            <span className="text-xs opacity-75">({counts.goods})</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <p className="text-base font-bold text-slate-500">
            មិនទាន់មានទិន្នន័យនៅឡើយទេ
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="space-y-3 sm:hidden">
            {filteredItems.map((item) => {
              const isLend = item.type === 'Lend';

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 shadow-sm"
                >
                  {/* Top row: Date + Type Badge with vector icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {formatDate(item.date)}
                    </span>
                    {isLend ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 text-xs font-black">
                        <BanknoteIcon className="w-3.5 h-3.5" />
                        <span>ឱ្យខ្ចីលុយ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 text-xs font-black">
                        <PackageIcon className="w-3.5 h-3.5" />
                        <span>ទទួលទំនិញ</span>
                      </span>
                    )}
                  </div>

                  {/* Person name if viewing all */}
                  {!isSpecificBorrower && (
                    <div className="text-sm font-bold text-slate-800">
                      <span>ឈ្មោះ: </span>
                      <span className="text-primary-700">{item.borrower}</span>
                    </div>
                  )}

                  {/* Details row: [Quantity] x [Unit Price]៛ for goods, note for loans */}
                  <div className="text-sm text-slate-700">
                    {!isLend ? (
                      <div>
                        <span className="font-bold text-slate-900">
                          {item.quantity} × {formatMoney(item.unitPrice)}
                        </span>
                        {item.note && (
                          <p className="text-xs text-slate-500 italic mt-0.5">
                            ចំណាំ: {item.note}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {item.note ? (
                          <span className="text-slate-600">
                            ចំណាំ: {item.note}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom row: Total Amount + Trash2 Delete Button */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 block font-semibold">
                        ទឹកប្រាក់សរុប
                      </span>
                      <span
                        className={`text-xl font-black tabular-nums tracking-tight ${
                          isLend ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(item.amount)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-colors"
                      title="លុប"
                      aria-label="លុប"
                    >
                      <Trash2Icon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View — NO ITEM NAME COLUMN */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-600 text-sm">
                  <th className="py-3 px-3 text-left font-bold">កាលបរិច្ឆេទ</th>
                  {!isSpecificBorrower && (
                    <th className="py-3 px-3 text-left font-bold">ឈ្មោះ</th>
                  )}
                  <th className="py-3 px-3 text-center font-bold">ប្រភេទ</th>
                  <th className="py-3 px-3 text-left font-bold">ព័ត៌មានលម្អិត</th>
                  <th className="py-3 px-3 text-right font-bold">ទឹកប្រាក់សរុប</th>
                  <th className="py-3 px-3 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isLend = item.type === 'Lend';

                  return (
                    <tr
                      key={`${item.kind}-${item.id}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>

                      {/* Borrower (if viewing all) */}
                      {!isSpecificBorrower && (
                        <td className="py-3.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {item.borrower}
                        </td>
                      )}

                      {/* Type Badge with Vector Icon */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isLend ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 text-xs font-black">
                            <BanknoteIcon className="w-3.5 h-3.5" />
                            <span>ឱ្យខ្ចីលុយ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 text-xs font-black">
                            <PackageIcon className="w-3.5 h-3.5" />
                            <span>ទទួលទំនិញ</span>
                          </span>
                        )}
                      </td>

                      {/* Details: [Quantity] × [Unit Price]៛ for goods, note for loans */}
                      <td className="py-3.5 px-3 text-slate-700">
                        {!isLend ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              {item.quantity} × {formatMoney(item.unitPrice)}
                            </span>
                            {item.note && (
                              <span className="text-xs text-slate-500 italic block mt-0.5">
                                ({item.note})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-600">
                            {item.note || '—'}
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={`text-lg sm:text-xl font-black ${
                            isLend ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatMoney(item.amount)}
                        </span>
                      </td>

                      {/* Delete Button with Trash2 Vector Icon */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="លុប"
                          aria-label="លុប"
                        >
                          <Trash2Icon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Clean Delete Confirmation Modal (NO Emojis) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                បញ្ជាក់ការលុប
              </h3>
              <p className="text-base font-bold text-slate-700">
                តើប៉ាពិតជាចង់លុបទិន្នន័យនេះមែនទេ?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="btn-outline flex-1 min-h-[48px] text-base font-bold"
                disabled={deleting}
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="btn-danger flex-1 min-h-[48px] text-base font-bold shadow-md"
                disabled={deleting}
              >
                {deleting ? 'កំពុងលុប...' : 'លុប'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
