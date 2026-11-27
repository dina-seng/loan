import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { createEntry, fetchEntries, voidEntry } from '../ledger.js';
import { parseAmount } from '../money.js';
import { parseDate } from '../dates.js';
import { assertUuidParam } from '../partner.js';
import { entryJson } from '../serialize.js';
import { lendingCreateSchema, validate, voidSchema } from '../schemas.js';

export const lendingRouter = Router();

/** Money we gave the partner — always a positive amount in the ledger. */
lendingRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({
    partnerId: req.partnerId,
    type: 'LEND',
    includeVoided: req.query.includeVoided === 'true',
    withDetails: true,
  });
  ok(res, [...rows].reverse().map(entryJson));
}));

lendingRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.entry.findFirst({
    where: { id: assertUuidParam(req.params.id), partnerId: req.partnerId, type: 'LEND' },
    include: { deliveryItems: true, settlement: true },
  });
  if (!row) throw notFound();
  ok(res, entryJson(row));
}));

lendingRouter.post('/', validate(lendingCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const { row, created } = await createEntry({
    id: data.id,
    partnerId: req.partnerId,
    type: 'LEND',
    date: parseDate(data.transactionDate),
    amount: parseAmount(data.amount),
    note: data.note,
    reference: data.reference,
    userId: req.user.id,
  });
  ok(res, entryJson(row), undefined, created ? 201 : 200);
}));

lendingRouter.post('/:id/void', validate(voidSchema), asyncHandler(async (req, res) => {
  ok(res, entryJson(await voidEntry({
    partnerId: req.partnerId,
    id: assertUuidParam(req.params.id),
    reason: req.valid.reason,
    userId: req.user.id,
  })));
}));
