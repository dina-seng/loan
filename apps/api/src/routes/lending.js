import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { assertNotClosed } from '../ledger.js';
import { parseAmount } from '../money.js';
import { parseDate, dateWhere } from '../dates.js';
import { lendingJson } from '../serialize.js';
import { lendingCreateSchema, listQuerySchema, validate, voidSchema } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { audit, jsonSafe } from '../audit.js';

export const lendingRouter = Router();

lendingRouter.use(authRequired);

lendingRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, search, includeVoided } = req.valid;
  const where = {
    ...dateWhere('transactionDate', from, to),
    ...(includeVoided ? {} : { voidedAt: null }),
    ...(search ? { OR: [{ note: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.lendingTransaction.findMany({
      where, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.lendingTransaction.count({ where }),
  ]);
  ok(res, rows.map(lendingJson), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

lendingRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.lendingTransaction.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound();
  ok(res, lendingJson(row));
}));

lendingRouter.post('/', validate(lendingCreateSchema), idempotent('lending'), asyncHandler(async (req, res) => {
  const data = req.valid;
  const transactionDate = parseDate(data.transactionDate);
  const amount = parseAmount(data.amount);
  await assertNotClosed(transactionDate);
  const row = await prisma.lendingTransaction.create({
    data: {
      transactionDate, amount, note: data.note, reference: data.reference || null,
      createdById: req.user.id,
    },
  });
  await audit(req.user.id, 'LENDING_CREATE', 'LendingTransaction', row.id, { after: jsonSafe(lendingJson(row)) });
  ok(res, lendingJson(row), undefined, 201);
}));

lendingRouter.post('/:id/void', validate(voidSchema), idempotent('lending-void'), asyncHandler(async (req, res) => {
  const row = await prisma.lendingTransaction.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound();
  if (row.voidedAt) throw notFound();
  await assertNotClosed(row.transactionDate);
  const updated = await prisma.lendingTransaction.update({
    where: { id: row.id },
    data: { voidedAt: new Date(), voidedById: req.user.id, voidReason: req.valid.reason || null },
  });
  await audit(req.user.id, 'LENDING_VOID', 'LendingTransaction', row.id, {
    before: jsonSafe(lendingJson(row)), after: jsonSafe(lendingJson(updated)), metadata: { reason: req.valid.reason || null },
  });
  ok(res, lendingJson(updated));
}));
