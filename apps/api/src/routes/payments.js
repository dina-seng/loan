import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { assertNotClosed } from '../ledger.js';
import { parseAmount } from '../money.js';
import { parseDate, dateWhere } from '../dates.js';
import { paymentJson } from '../serialize.js';
import { listQuerySchema, paymentCreateSchema, validate, voidSchema } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { audit, jsonSafe } from '../audit.js';

export const paymentsRouter = Router();
paymentsRouter.use(authRequired);

paymentsRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, search, includeVoided } = req.valid;
  const where = {
    ...dateWhere('paymentDate', from, to),
    ...(includeVoided ? {} : { voidedAt: null }),
    ...(search ? { OR: [{ note: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where, orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);
  ok(res, rows.map(paymentJson), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

paymentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound();
  ok(res, paymentJson(row));
}));

paymentsRouter.post('/', validate(paymentCreateSchema), idempotent('payment'), asyncHandler(async (req, res) => {
  const data = req.valid;
  const paymentDate = parseDate(data.paymentDate);
  const amount = parseAmount(data.amount);
  await assertNotClosed(paymentDate);
  const row = await prisma.payment.create({
    data: {
      paymentDate,
      direction: data.direction,
      amount,
      method: data.method,
      note: data.note,
      reference: data.reference || null,
      settlementId: data.settlementId || null,
      createdById: req.user.id,
    },
  });
  await audit(req.user.id, 'PAYMENT_CREATE', 'Payment', row.id, { after: jsonSafe(paymentJson(row)) });
  ok(res, paymentJson(row), undefined, 201);
}));

paymentsRouter.post('/:id/void', validate(voidSchema), idempotent('payment-void'), asyncHandler(async (req, res) => {
  const row = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound();
  if (row.voidedAt) throw notFound();
  await assertNotClosed(row.paymentDate);
  const updated = await prisma.payment.update({
    where: { id: row.id },
    data: { voidedAt: new Date(), voidedById: req.user.id, voidReason: req.valid.reason || null },
  });
  await audit(req.user.id, 'PAYMENT_VOID', 'Payment', row.id, {
    before: jsonSafe(paymentJson(row)), after: jsonSafe(paymentJson(updated)), metadata: { reason: req.valid.reason || null },
  });
  ok(res, paymentJson(updated));
}));
