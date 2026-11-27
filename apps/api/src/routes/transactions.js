import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { fetchLedgerEntries, serializeEntry } from '../ledger.js';
import { listQuerySchema, validate } from '../schemas.js';
import { paymentJson, lendingJson, deliveryJson } from '../serialize.js';

export const transactionsRouter = Router();
transactionsRouter.use(authRequired);

/** One unified, filtered, paginated view over all validated ledger records. */
transactionsRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, type, search, includeVoided } = req.valid;
  let entries = await fetchLedgerEntries({ from, to, includeVoided });
  if (type) entries = entries.filter((entry) => entry.kind === type);
  if (search) {
    const needle = search.toLowerCase();
    entries = entries.filter((entry) =>
      `${entry.description} ${entry.reference || ''}`.toLowerCase().includes(needle));
  }
  const total = entries.length;
  const items = entries.reverse().slice((page - 1) * pageSize, page * pageSize).map(serializeEntry);
  ok(res, items, { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

transactionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const [lending, delivery, payment] = await Promise.all([
    prisma.lendingTransaction.findUnique({ where: { id }, include: { createdBy: { select: { displayName: true } } } }),
    prisma.productDelivery.findUnique({ where: { id }, include: { items: true, createdBy: { select: { displayName: true } } } }),
    prisma.payment.findUnique({ where: { id }, include: { createdBy: { select: { displayName: true } } } }),
  ]);
  if (lending) return ok(res, { kind: 'LENDING', ...lendingJson(lending), recordedBy: lending.createdBy.displayName });
  if (delivery) return ok(res, { kind: 'DELIVERY', ...deliveryJson(delivery), recordedBy: delivery.createdBy.displayName });
  if (payment) return ok(res, { kind: 'PAYMENT', ...paymentJson(payment), recordedBy: payment.createdBy.displayName });
  throw notFound();
}));
