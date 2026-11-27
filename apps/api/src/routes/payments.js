import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { createSettlement, fetchEntries } from '../ledger.js';
import { parseDate } from '../dates.js';
import { parseAmount } from '../money.js';
import { assertUuidParam } from '../partner.js';
import { settlementJson } from '../serialize.js';
import { paymentCreateSchema, validate, voidSchema } from '../schemas.js';
import { voidEntry } from '../ledger.js';

export const paymentsRouter = Router();

/**
 * Payments are SETTLE_IN / SETTLE_OUT entries with a Settlement detail row.
 * Both /payments and /settlements expose the same underlying records.
 */
paymentsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({
    partnerId: req.partnerId,
    type: typeof req.query.direction === 'string'
      ? (req.query.direction === 'DAD_TO_PARTNER' ? 'SETTLE_OUT' : 'SETTLE_IN')
      : undefined,
    includeVoided: req.query.includeVoided === 'true',
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    withDetails: true,
  });
  const direction = typeof req.query.direction === 'string' ? req.query.direction : null;
  ok(res, rows.filter((row) => {
    if (!direction) return true;
    return (row.settlement?.direction || (row.type === 'SETTLE_IN' ? 'PARTNER_TO_DAD' : 'DAD_TO_PARTNER')) === direction;
  }).reverse().map(settlementJson));
}));

/** Accept either the entry id or the settlement id returned by this API. */
export async function findPaymentEntry(partnerId, id) {
  return prisma.entry.findFirst({
    where: {
      partnerId,
      OR: [{ id }, { settlement: { id } }],
    },
    include: { settlement: { include: { entry: true } }, deliveryItems: true },
  });
}

paymentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await findPaymentEntry(req.partnerId, assertUuidParam(req.params.id));
  if (!row?.settlement) throw notFound();
  ok(res, settlementJson(row.settlement));
}));

paymentsRouter.post('/', validate(paymentCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const { row, created } = await createSettlement({
    id: data.id,
    partnerId: req.partnerId,
    date: parseDate(data.paymentDate),
    direction: data.direction,
    amount: parseAmount(data.amount),
    method: data.method,
    note: data.note,
    reference: data.reference,
    userId: req.user.id,
  });
  ok(res, settlementJson({ ...row.settlement, entry: row }), undefined, created ? 201 : 200);
}));

paymentsRouter.post('/:id/void', validate(voidSchema), asyncHandler(async (req, res) => {
  const target = await findPaymentEntry(req.partnerId, assertUuidParam(req.params.id));
  if (!target?.settlement) throw notFound();
  const updated = await voidEntry({
    partnerId: req.partnerId,
    id: target.id,
    reason: req.valid.reason,
    userId: req.user.id,
  });
  ok(res, settlementJson({ ...updated.settlement, entry: updated }));
}));
