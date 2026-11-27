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

/** Entry ids come from the browser so a retried save cannot create a second row. */
export const newEntryId = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
