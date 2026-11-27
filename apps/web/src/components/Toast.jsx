import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircleIcon, XIcon } from './Icons.jsx';
import { labels } from '../i18n/labels.js';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() });
    setTimeout(() => setToast(null), 4500);
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div role="status" className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md lg:bottom-6">
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-lg ${toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-700 text-white'}`}>
            <CheckCircleIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} aria-label={labels.cancel} className="min-h-[32px] min-w-[32px]"><XIcon className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
