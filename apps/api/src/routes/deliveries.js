import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { createDelivery, fetchEntries, voidEntry } from '../ledger.js';
import { parseDate } from '../dates.js';
import { assertUuidParam } from '../partner.js';
import { entryJson } from '../serialize.js';
import { deliveryCreateSchema, validate, voidSchema } from '../schemas.js';

export const deliveriesRouter = Router();

/** Every PRODUCT entry is one delivery with one or more priced lines. */
deliveriesRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({
    partnerId: req.partnerId,
    type: 'PRODUCT',
    includeVoided: req.query.includeVoided === 'true',
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    withDetails: true,
  });
  ok(res, [...rows].reverse().map(entryJson));
}));

deliveriesRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.entry.findFirst({
    where: { id: assertUuidParam(req.params.id), partnerId: req.partnerId, type: 'PRODUCT' },
    include: { deliveryItems: { orderBy: [{ sortOrder: 'asc' }] }, settlement: true },
  });
  if (!row) throw notFound();
  ok(res, entryJson(row));
}));

deliveriesRouter.post('/', validate(deliveryCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const { row, created } = await createDelivery({
    id: data.id,
    partnerId: req.partnerId,
    date: parseDate(data.deliveryDate),
    note: data.note,
    reference: data.reference,
    items: data.items,
    userId: req.user.id,
  });
  ok(res, entryJson(row), undefined, created ? 201 : 200);
}));

deliveriesRouter.post('/:id/void', validate(voidSchema), asyncHandler(async (req, res) => {
  ok(res, entryJson(await voidEntry({
    partnerId: req.partnerId,
    id: assertUuidParam(req.params.id),
    reason: req.valid.reason,
    userId: req.user.id,
  })));
}));
