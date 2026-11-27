import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { createEntry, ENTRY_INCLUDE, fetchEntries, voidEntry } from '../ledger.js';
import { parseAmount } from '../money.js';
import { parseDate } from '../dates.js';
import { assertUuidParam } from '../partner.js';
import { entryJson } from '../serialize.js';
import { entryCreateSchema, entryListSchema, validate, voidSchema } from '../schemas.js';

export const entriesRouter = Router();

const KIND_TYPES = {
  LENDING: ['LEND'],
  DELIVERY: ['PRODUCT'],
  PAYMENT: ['SETTLE_IN', 'SETTLE_OUT'],
};

/** Newest first. Voided rows are included only when explicitly requested. */
entriesRouter.get('/', validate(entryListSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, type, kind, search, includeVoided } = req.valid;
  const types = type ? [type] : (kind ? KIND_TYPES[kind] : undefined);
  const where = {
    partnerId: req.partnerId,
    ...(from || to ? {
      entryDate: {
        ...(from ? { gte: parseDate(from, 'from') } : {}),
        ...(to ? { lte: parseDate(to, 'to') } : {}),
      },
    } : {}),
    ...(includeVoided ? {} : { voidedAt: null }),
    ...(types ? { type: { in: types } } : {}),
    ...(search ? {
      OR: [
        { note: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { deliveryItems: { some: { productName: { contains: search, mode: 'insensitive' } } } },
      ],
    } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: ENTRY_INCLUDE,
    }),
    prisma.entry.count({ where }),
  ]);
  ok(res, rows.map(entryJson), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

entriesRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const row = await prisma.entry.findFirst({
    where: { id, partnerId: req.partnerId },
    include: ENTRY_INCLUDE,
  });
  if (!row) throw notFound();
  ok(res, entryJson(row));
}));

/** Only LEND and PRODUCT can be entered by hand; settling is its own action. */
entriesRouter.post('/', validate(entryCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const { row, created } = await createEntry({
    id: data.id,
    partnerId: req.partnerId,
    type: data.type,
    date: parseDate(data.date),
    amount: parseAmount(data.amount),
    note: data.note,
    reference: data.reference,
    userId: req.user.id,
  });
  ok(res, entryJson(row), undefined, created ? 201 : 200);
}));

/** Soft delete: the row is kept and excluded from every balance. */
entriesRouter.post('/:id/void', validate(voidSchema), asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const updated = await voidEntry({
    partnerId: req.partnerId,
    id,
    reason: req.valid.reason,
    userId: req.user.id,
  });
  ok(res, entryJson(updated));
}));

/** Backwards-compatible alias used by older clients. */
entriesRouter.get('/list/all', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({ partnerId: req.partnerId, includeVoided: true, withDetails: true });
  ok(res, rows.map(entryJson));
}));
