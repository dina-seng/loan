import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { audit, jsonSafe } from '../audit.js';
import { asyncHandler, conflict, notFound, ok } from '../errors.js';
import {
  balanceDirection,
  getPartnerBalance,
  getPartnerSummary,
  listPartnerBalances,
  settlePartner,
} from '../ledger.js';
import { parseAmount, money } from '../money.js';
import { assertUuidParam, normalizePartnerName } from '../partner.js';
import { entryJson, partnerJson } from '../serialize.js';
import { parseDate, todayISO } from '../dates.js';
import { settleSchema, partnerCreateSchema, partnerUpdateSchema, validate } from '../schemas.js';

export const partnersRouter = Router();
partnersRouter.use(authRequired);

async function assertUniqueName(name, excludeId) {
  const existing = await prisma.partner.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw conflict('CONFLICT', { name: 'ឈ្មោះដៃគូនេះមានរួចហើយ' }, 'ឈ្មោះដៃគូនេះមានរួចហើយ');
}

/** Every partner with the balance produced by the single balance function. */
partnersRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await listPartnerBalances();
  ok(res, rows.map(({ partner, balance, totals }) => partnerJson(partner, balance, totals)));
}));

partnersRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw notFound();
  const { balance, totals } = await getPartnerSummary(id);
  ok(res, partnerJson(partner, balance, totals));
}));

partnersRouter.post('/', validate(partnerCreateSchema), asyncHandler(async (req, res) => {
  const name = normalizePartnerName(req.valid.name);
  await assertUniqueName(name);
  const openingBalance = req.valid.openingBalance == null ? 0n : parseAmount(req.valid.openingBalance, {
    field: 'openingBalance',
    allowZero: true,
  });
  const partner = await prisma.$transaction(async (tx) => {
    const created = await tx.partner.create({ data: { name, openingBalance } });
    await audit(req.user.id, 'PARTNER_CREATE', 'Partner', created.id, {
      after: jsonSafe({ id: created.id, name: created.name, openingBalance: created.openingBalance.toString() }),
      partnerId: created.id,
    }, tx);
    return created;
  });
  ok(res, partnerJson(partner, openingBalance), undefined, 201);
}));

partnersRouter.patch('/:id', validate(partnerUpdateSchema), asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const before = await prisma.partner.findUnique({ where: { id } });
  if (!before) throw notFound();
  const name = req.valid.name === undefined ? before.name : normalizePartnerName(req.valid.name);
  await assertUniqueName(name, before.id);
  const openingBalance = req.valid.openingBalance == null
    ? before.openingBalance
    : parseAmount(req.valid.openingBalance, { field: 'openingBalance', allowZero: true });
  const partner = await prisma.$transaction(async (tx) => {
    const updated = await tx.partner.update({ where: { id }, data: { name, openingBalance } });
    await audit(req.user.id, 'PARTNER_UPDATE', 'Partner', updated.id, {
      before: jsonSafe({ name: before.name, openingBalance: before.openingBalance.toString() }),
      after: jsonSafe({ name: updated.name, openingBalance: updated.openingBalance.toString() }),
      partnerId: updated.id,
    }, tx);
    return updated;
  });
  const balance = await getPartnerBalance(partner.id);
  ok(res, partnerJson(partner, balance));
}));

/** Clear a partner's balance with ONE entry for its full amount. */
partnersRouter.post('/:id/settle', validate(settleSchema), asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw notFound();
  const { row, created } = await settlePartner({
    partnerId: partner.id,
    id: req.valid.id,
    date: parseDate(req.valid.date || todayISO()),
    note: req.valid.note,
    userId: req.user.id,
  });
  ok(res, entryJson(row), undefined, created ? 201 : 200);
}));

/** Opening-balance direction, useful when rendering a negative starting balance. */
partnersRouter.get('/:id/opening-balance', asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw notFound();
  ok(res, {
    amount: money(partner.openingBalance),
    direction: balanceDirection(BigInt(partner.openingBalance)),
  });
}));
