import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, conflict, notFound, ok } from '../errors.js';
import { balanceDirection, getPartnerBalance, listPartnerBalances, settlePartner, serializeEntry } from '../ledger.js';
import { money } from '../money.js';
import { normalizePartnerName } from '../partner.js';
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
  ok(res, await listPartnerBalances());
}));

partnersRouter.post('/', validate(partnerCreateSchema), asyncHandler(async (req, res) => {
  const name = normalizePartnerName(req.valid.name);
  await assertUniqueName(name);
  const partner = await prisma.partner.create({ data: { name } });
  ok(res, {
    id: partner.id, name: partner.name, balance: '0', direction: 'SETTLED',
    createdAt: partner.createdAt, updatedAt: partner.updatedAt,
  }, undefined, 201);
}));

partnersRouter.patch('/:id', validate(partnerUpdateSchema), asyncHandler(async (req, res) => {
  const before = await prisma.partner.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const name = normalizePartnerName(req.valid.name);
  await assertUniqueName(name, before.id);
  const partner = await prisma.partner.update({ where: { id: before.id }, data: { name } });
  const balance = await getPartnerBalance(partner.id);
  ok(res, {
    id: partner.id,
    name: partner.name,
    balance: money(balance),
    direction: balanceDirection(balance),
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  });
}));

/** The single settle action: one entry for the whole current balance. */
partnersRouter.post('/:id/settle', validate(settleSchema), asyncHandler(async (req, res) => {
  const partner = await prisma.partner.findUnique({ where: { id: req.params.id } });
  if (!partner) throw notFound();
  const { row, created } = await settlePartner({
    partnerId: partner.id,
    id: req.valid.id,
    date: parseDate(req.valid.date || todayISO()),
    note: req.valid.note,
    userId: req.user.id,
  });
  ok(res, serializeEntry(row), undefined, created ? 201 : 200);
}));
