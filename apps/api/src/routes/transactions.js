import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { ENTRY_INCLUDE, monthlyTotals } from '../ledger.js';
import { assertUuidParam } from '../partner.js';
import { entryJson } from '../serialize.js';
import { entryListSchema, validate } from '../schemas.js';

export const transactionsRouter = Router();

const KIND_TYPES = {
  LENDING: ['LEND'],
  DELIVERY: ['PRODUCT'],
  PAYMENT: ['SETTLE_IN', 'SETTLE_OUT'],
};

/** One chronological transaction list across lending, deliveries and payments. */
transactionsRouter.get('/', validate(entryListSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, type, kind, search, includeVoided } = req.valid;
  const types = type ? [type] : (kind ? KIND_TYPES[kind] : undefined);
  const where = {
    partnerId: req.partnerId,
    ...(from || to ? {
      entryDate: {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
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
  ok(res, rows.map(entryJson), {
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    monthlyTotals: monthlyTotals(rows).map((bucket) => ({
      month: bucket.month,
      totalLent: bucket.totalLent.toString(),
      totalProductValue: bucket.totalDelivered.toString(),
      transactionCount: bucket.count,
    })),
  });
}));

transactionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.entry.findFirst({
    where: { id: assertUuidParam(req.params.id), partnerId: req.partnerId },
    include: ENTRY_INCLUDE,
  });
  if (!row) throw notFound();
  ok(res, entryJson(row));
}));
