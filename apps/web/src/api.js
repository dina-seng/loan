import { errorMessage } from './strings.km.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const PARTNER_KEY = 'bl_partner_id';

export function getSelectedPartnerId() {
  try { return localStorage.getItem(PARTNER_KEY) || ''; } catch { return ''; }
}

export function setSelectedPartnerId(id) {
  try { if (id) localStorage.setItem(PARTNER_KEY, id); else localStorage.removeItem(PARTNER_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(payload) {
    super(errorMessage(payload?.error));
    this.code = payload?.error?.code;
    this.details = payload?.error?.details;
  }
}

function withPartner(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const id = getSelectedPartnerId();
  return id ? { ...body, partnerId: id } : body;
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(getSelectedPartnerId() ? { 'X-Partner-Id': getSelectedPartnerId() } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(withPartner(body)) } : {}),
    });
  } catch {
    throw new ApiError({ error: { code: 'NETWORK' } });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError({ error: { code: 'INTERNAL_ERROR' } });
  }
  if (!response.ok || payload.ok === false) throw new ApiError(payload);
  return { data: payload.data, meta: payload.meta };
}

/** Authenticated CSV download (a plain <a href> would not send the session cookie). */
export async function downloadCsv(path, fallbackName = 'export.csv') {
  const response = await fetch(`${BASE}/api/v1${path}`, { credentials: 'include' });
  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch { /* ignore */ }
    throw new ApiError(payload || { error: { code: 'NETWORK' } });
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match?.[1] || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Entry ids come from the browser so a retried save cannot create a second row. */
export const newEntryId = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
