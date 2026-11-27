import { errorMessage } from './i18n/labels.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(payload) {
    super(errorMessage(payload?.error));
    this.code = payload?.error?.code;
    this.details = payload?.error?.details;
  }
}

export async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError({ error: { code: 'NETWORK', message: 'មិនអាចភ្ជាប់ប្រព័ន្ធបានទេ សូមពិនិត្យអ៊ីនធឺណិត' } });
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

export const newIdempotencyKey = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
