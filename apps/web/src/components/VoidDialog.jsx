import { useEffect, useState } from 'react';
import { labels } from '../strings.km.js';
import { Field, Modal } from './Ui.jsx';

/** Soft-delete with an optional reason recorded in the audit trail. */
export default function VoidDialog({ open, entry, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open, entry?.id]);

  return (
    <Modal open={open} onClose={onClose} title={labels.delete} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>{labels.cancel}</button>
        <button type="button" className="btn-danger flex-1" onClick={() => onConfirm(reason)} disabled={busy}>
          {busy ? labels.loading : labels.delete}
        </button>
      </div>
    }>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">{labels.deleteConfirm}</p>
        <Field label={labels.reason}>
          <textarea className="input min-h-[70px] py-2" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
