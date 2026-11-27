import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { createSettlement, fetchEntries, getPartnerBalance } from '../ledger.js';
import { parseDate } from '../dates.js';
import { money, parseAmount } from '../money.js';
import { assertUuidParam } from '../partner.js';
import { settlementJson } from '../serialize.js';
import { settlementCreateSchema, validate } from '../schemas.js';

export const settlementsRouter = Router();

/** The canonical settlement view. /payments is a compatible alias. */
settlementsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({
    partnerId: req.partnerId,
    includeVoided: req.query.includeVoided === 'true',
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    withDetails: true,
  });
  ok(res, rows.filter((row) => row.settlement).reverse().map((row) => settlementJson({ ...row.settlement, entry: row })));
}));

settlementsRouter.get('/current', asyncHandler(async (req, res) => {
  const balance = await getPartnerBalance(req.partnerId);
  ok(res, {
    partnerId: req.partnerId,
    balance: money(balance),
    direction: balance > 0n ? 'PARTNER_TO_DAD' : balance < 0n ? 'DAD_TO_PARTNER' : 'SETTLED',
    suggestedAmount: money(balance < 0n ? -balance : balance),
  });
}));

settlementsRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const row = await prisma.entry.findFirst({
    where: {
      partnerId: req.partnerId,
      OR: [{ id }, { settlement: { id } }],
    },
    include: { settlement: { include: { entry: true } } },
  });
  if (!row?.settlement) throw notFound();
  ok(res, settlementJson(row.settlement));
}));

/**
 * A settlement may clear the whole balance (`fullBalance: true`) or accept a
 * partial `amount`. When direction is omitted it follows the current balance.
 */
settlementsRouter.post('/', validate(settlementCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const { row, created, balanceBefore, balanceAfter } = await createSettlement({
    id: data.id,
    partnerId: req.partnerId,
    date: parseDate(data.paymentDate),
    direction: data.direction ?? null,
    amount: data.amount == null ? null : parseAmount(data.amount),
    fullBalance: data.fullBalance,
    method: data.method,
    note: data.note,
    reference: data.reference,
    periodClosingId: data.periodClosingId ?? null,
    userId: req.user.id,
  });
  ok(res, {
    ...settlementJson({ ...row.settlement, entry: row }),
    balanceBefore: money(balanceBefore),
    balanceAfter: money(balanceAfter),
  }, undefined, created ? 201 : 200);
}));
