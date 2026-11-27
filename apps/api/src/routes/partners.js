import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { fetchLedgerEntries, computeBalance, balanceDirection, summarize } from '../ledger.js';
import { money } from '../money.js';
import { audit, jsonSafe } from '../audit.js';
import { validate } from '../schemas.js';
import { partnerCreateSchema, partnerUpdateSchema } from '../schemas.js';

export const partnersRouter = Router();
partnersRouter.use(authRequired);

function partnerJson(partner, balance, totals) {
  return {
    id: partner.id,
    name: partner.name,
    phone: partner.phone,
    note: partner.note,
    isActive: partner.isActive,
    openingBalance: money(partner.openingBalance),
    balance: money(balance),
    direction: balanceDirection(balance),
    totals: totals ? {
      totalLent: money(totals.totalLent),
      totalProductValue: money(totals.totalDelivered),
      receivedPayments: money(totals.totalReceived),
      outgoingPayments: money(totals.totalPaidOut),
    } : undefined,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
}

partnersRouter.get('/', asyncHandler(async (req, res) => {
  const includeInactive = String(req.query.includeInactive || '') === 'true';
  const [partners, entries] = await Promise.all([
    prisma.partner.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    fetchLedgerEntries({ partnerName: '' }),
  ]);
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.partnerId)) grouped.set(entry.partnerId, []);
    grouped.get(entry.partnerId).push(entry);
  }
  ok(res, partners.map((partner) => {
    const own = grouped.get(partner.id) || [];
    return partnerJson(partner, computeBalance(own, partner.openingBalance), summarize(own));
  }));
}));

partnersRouter.post('/', validate(partnerCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const partner = await prisma.partner.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      note: data.note || null,
      openingBalance: data.openingBalance !== undefined ? BigInt(data.openingBalance) : 0n,
    },
  });
  await audit(req.user.id, 'PARTNER_CREATE', 'Partner', partner.id, { after: jsonSafe(partnerJson(partner, partner.openingBalance)) });
  ok(res, partnerJson(partner, partner.openingBalance), undefined, 201);
}));

partnersRouter.patch('/:id', validate(partnerUpdateSchema), asyncHandler(async (req, res) => {
  const before = await prisma.partner.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const data = req.valid;
  const partner = await prisma.partner.update({
    where: { id: before.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.note !== undefined ? { note: data.note || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.openingBalance !== undefined ? { openingBalance: BigInt(data.openingBalance) } : {}),
    },
  });
  const balance = computeBalance(await fetchLedgerEntries({ partnerId: partner.id }), partner.openingBalance);
  await audit(req.user.id, 'PARTNER_UPDATE', 'Partner', partner.id, {
    before: jsonSafe(partnerJson(before, 0n)), after: jsonSafe(partnerJson(partner, balance)),
  });
  ok(res, partnerJson(partner, balance));
}));
