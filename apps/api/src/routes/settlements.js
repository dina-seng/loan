import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound, ok } from '../errors.js';
import { assertNotClosed, fetchLedgerEntries, EFFECT } from '../ledger.js';
import { parseAmount } from '../money.js';
import { parseDate, dateWhere } from '../dates.js';
import { settlementJson } from '../serialize.js';
import { listQuerySchema, settlementCreateSchema, validate } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { audit, jsonSafe } from '../audit.js';

export const settlementsRouter = Router();

settlementsRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, search } = req.valid;
  const where = {
    partnerId: req.partnerId,
    ...dateWhere('createdAt', from, to),
    ...(search ? { OR: [{ note: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.settlement.findMany({
      where, include: { payments: true }, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.settlement.count({ where }),
  ]);
  ok(res, rows.map(settlementJson), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

settlementsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.settlement.findFirst({
    where: { id: req.params.id, partnerId: req.partnerId }, include: { payments: true },
  });
  if (!row) throw notFound();
  ok(res, settlementJson(row));
}));

/** A settlement payment is a normal ledger entry for this partner only. */
settlementsRouter.post('/', validate(settlementCreateSchema), idempotent('settlement'), asyncHandler(async (req, res) => {
  const data = req.valid;
  const paymentDate = parseDate(data.paymentDate);
  const amount = parseAmount(data.amount);
  await assertNotClosed(paymentDate, prisma, req.partnerId);

  const result = await prisma.$transaction(async (tx) => {
    const entries = await fetchLedgerEntries({
      partnerId: req.partnerId, partnerName: req.partner.name, client: tx,
    });
    const balanceBefore = entries.reduce((sum, entry) => sum + entry.signedAmount, req.partner.openingBalance);
    const direction = data.direction || (balanceBefore > 0n ? 'PARTNER_TO_DAD' : 'DAD_TO_PARTNER');
    if (balanceBefore === 0n && !data.direction) {
      throw badRequest('VALIDATION_ERROR', { direction: 'សូមជ្រើសរើសទិសដៅទូទាត់' });
    }
    if (data.periodClosingId) {
      const closing = await tx.periodClosing.findFirst({
        where: { id: data.periodClosingId, partnerId: req.partnerId },
      });
      if (!closing) throw notFound();
    }
    const balanceAfter = balanceBefore + amount * EFFECT[direction];
    const status = balanceAfter === 0n ? 'FULL' : 'PARTIAL';

    const settlement = await tx.settlement.create({
      data: {
        reference: data.reference || null,
        partnerId: req.partnerId,
        periodClosingId: data.periodClosingId || null,
        amount, direction, method: data.method, note: data.note,
        status, balanceAfter, createdById: req.user.id,
      },
    });
    const payment = await tx.payment.create({
      data: {
        partnerId: req.partnerId,
        paymentDate, direction, amount, method: data.method,
        note: data.note || `Settlement ${settlement.id}`,
        settlementId: settlement.id, createdById: req.user.id,
      },
    });
    await audit(req.user.id, 'SETTLEMENT_CREATE', 'Settlement', settlement.id, {
      after: jsonSafe({ ...settlementJson({ ...settlement, payments: [payment] }), balanceAfter: balanceAfter.toString() }),
      metadata: { balanceBefore: balanceBefore.toString(), balanceAfter: balanceAfter.toString() },
    }, tx);
    return { settlement, payment, balanceBefore, balanceAfter };
  });

  ok(res, {
    ...settlementJson({ ...result.settlement, payments: [result.payment] }),
    balanceBefore: result.balanceBefore.toString(),
    balanceAfter: result.balanceAfter.toString(),
  }, undefined, 201);
}));
