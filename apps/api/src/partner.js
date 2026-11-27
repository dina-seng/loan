import { prisma } from './db.js';
import { asyncHandler, badRequest, notFound } from './errors.js';

export const DEFAULT_PARTNER_ID = '00000000-0000-4000-8000-000000000001';

/** One canonical spelling: trimmed, single spaces, Unicode-normalized. */
export function normalizePartnerName(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

/** Reject malformed path ids with a 404 instead of letting Prisma throw a 500. */
export function assertUuidParam(value) {
  if (!isUuid(value)) throw notFound();
  return value;
}

/** The selected partner is sent on every request via the X-Partner-Id header. */
export function resolvePartnerId(req) {
  const raw = req.get('X-Partner-Id') || (typeof req.query?.partnerId === 'string' ? req.query.partnerId : '');
  if (!raw || !UUID.test(raw)) {
    throw badRequest('VALIDATION_ERROR', { partner: 'សូមជ្រើសរើសដៃគូឱ្យបានត្រឹមត្រូវ' });
  }
  return raw;
}

/** Any authenticated user may read and write for any partner. */
export const partnerRequired = asyncHandler(async (req, _res, next) => {
  const id = resolvePartnerId(req);
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw notFound();
  req.partnerId = partner.id;
  req.partner = partner;
  next();
});

/** Ensure a loaded row belongs to the selected partner. */
export function assertPartnerAccess(row, req) {
  if (!row || row.partnerId !== req.partnerId) throw notFound();
  return row;
}
