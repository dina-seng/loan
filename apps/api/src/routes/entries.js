import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { createOrReuse, serializeEntry } from '../ledger.js';
import { parseAmount } from '../money.js';
import { parseDate, dateWhere } from '../dates.js';
import { entryCreateSchema, entryListSchema, validate, voidSchema } from '../schemas.js';

export const entriesRouter = Router();

/** Newest first. Voided rows are included only when explicitly requested. */
entriesRouter.get('/', validate(entryListSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, type, search, includeVoided } = req.valid;
  const where = {
    partnerId: req.partnerId,
    ...dateWhere('entryDate', from, to),
    ...(includeVoided ? {} : { voidedAt: null }),
    ...(type ? { type } : {}),
    ...(search ? { note: { contains: search, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.entry.findMany({
      where, orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.entry.count({ where }),
  ]);
  ok(res, rows.map(serializeEntry), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

entriesRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.entry.findFirst({ where: { id: req.params.id, partnerId: req.partnerId } });
  if (!row) throw notFound();
  ok(res, serializeEntry(row));
}));

/** Only LEND and PRODUCT can be entered by hand; settling is its own action. */
entriesRouter.post('/', validate(entryCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const { row, created } = await createOrReuse({
    id: data.id,
    partnerId: req.partnerId,
    type: data.type,
    entryDate: parseDate(data.date),
    amount: parseAmount(data.amount),
    note: data.note,
    createdById: req.user.id,
  });
  ok(res, serializeEntry(row), undefined, created ? 201 : 200);
}));

/** Soft delete: the row is kept and excluded from every balance. */
entriesRouter.post('/:id/void', validate(voidSchema), asyncHandler(async (req, res) => {
  const row = await prisma.entry.findFirst({ where: { id: req.params.id, partnerId: req.partnerId } });
  if (!row || row.voidedAt) throw notFound();
  const updated = await prisma.entry.update({ where: { id: row.id }, data: { voidedAt: new Date() } });
  ok(res, serializeEntry(updated));
}));
