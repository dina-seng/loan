import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { fetchLedgerEntries, serializeEntry } from '../ledger.js';
import { listQuerySchema, validate } from '../schemas.js';
import { paymentJson, lendingJson, deliveryJson } from '../serialize.js';

export const transactionsRouter = Router();

transactionsRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, type, search, includeVoided } = req.valid;
  let entries = await fetchLedgerEntries({
    partnerId: req.partnerId, partnerName: req.partner.name, from, to, includeVoided,
  });
  if (type) entries = entries.filter((entry) => entry.kind === type);
  if (search) {
    const needle = search.toLowerCase();
    entries = entries.filter((entry) =>
      `${entry.description} ${entry.reference || ''}`.toLowerCase().includes(needle));
  }
  const total = entries.length;
  const items = [...entries].reverse().slice((page - 1) * pageSize, page * pageSize).map(serializeEntry);
  ok(res, items, { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

transactionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const scope = { id, partnerId: req.partnerId };
  const [lending, delivery, payment] = await Promise.all([
    prisma.lendingTransaction.findFirst({ where: scope }),
    prisma.productDelivery.findFirst({ where: scope, include: { items: true } }),
    prisma.payment.findFirst({ where: scope }),
  ]);
  if (lending) return ok(res, { kind: 'LENDING', ...lendingJson(lending) });
  if (delivery) return ok(res, { kind: 'DELIVERY', ...deliveryJson(delivery) });
  if (payment) return ok(res, { kind: 'PAYMENT', ...paymentJson(payment) });
  throw notFound();
}));
