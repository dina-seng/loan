import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../db.js';
import { notFound, ok, asyncHandler } from '../errors.js';
import { assertNotClosed } from '../ledger.js';
import { lineTotalFromScaled, parseAmount, parseQuantity } from '../money.js';
import { parseDate, dateWhere } from '../dates.js';
import { deliveryJson } from '../serialize.js';
import { deliveryCreateSchema, listQuerySchema, validate, voidSchema } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { assertPartnerAccess } from '../partner.js';
import { audit, jsonSafe } from '../audit.js';

export const deliveriesRouter = Router();
const include = { items: true };

deliveriesRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, search, includeVoided } = req.valid;
  const where = {
    partnerId: req.partnerId,
    ...dateWhere('deliveryDate', from, to),
    ...(includeVoided ? {} : { voidedAt: null }),
    ...(search ? { OR: [{ reference: { contains: search, mode: 'insensitive' } }, { note: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.productDelivery.findMany({
      where, include, orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.productDelivery.count({ where }),
  ]);
  ok(res, rows.map(deliveryJson), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

deliveriesRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.productDelivery.findFirst({ where: { id: req.params.id, partnerId: req.partnerId }, include });
  if (!row) throw notFound();
  ok(res, deliveryJson(row));
}));

/** Quantity × unit price is computed here from validated inputs; clients never send totals. */
deliveriesRouter.post('/', validate(deliveryCreateSchema), idempotent('delivery'), asyncHandler(async (req, res) => {
  const data = req.valid;
  const deliveryDate = parseDate(data.deliveryDate);
  await assertNotClosed(deliveryDate, prisma, req.partnerId);

  const computed = data.items.map((item) => {
    const quantity = parseQuantity(item.quantity);
    const unitPrice = parseAmount(item.unitPrice, { field: 'unitPrice', allowZero: true });
    return {
      quantity: quantity.decimal,
      unitPrice,
      lineTotal: lineTotalFromScaled(quantity.scaled, unitPrice),
      note: item.note || null,
    };
  });
  const totalAmount = computed.reduce((sum, item) => sum + item.lineTotal, 0n);

  const row = await prisma.productDelivery.create({
    data: {
      // Internal reference only; Dad never sees or enters a delivery code.
      reference: data.reference || `DL-${Date.now()}-${randomUUID().slice(0, 8)}`,
      partnerId: req.partnerId,
      deliveryDate,
      note: data.note,
      totalAmount,
      createdById: req.user.id,
      items: { create: computed },
    },
    include,
  });
  await audit(req.user.id, 'DELIVERY_CREATE', 'ProductDelivery', row.id, { after: jsonSafe(deliveryJson(row)) });
  ok(res, deliveryJson(row), undefined, 201);
}));

deliveriesRouter.post('/:id/void', validate(voidSchema), idempotent('delivery-void'), asyncHandler(async (req, res) => {
  const row = assertPartnerAccess(
    await prisma.productDelivery.findUnique({ where: { id: req.params.id }, include }), req,
  );
  if (row.voidedAt) throw notFound();
  await assertNotClosed(row.deliveryDate, prisma, req.partnerId);
  const updated = await prisma.productDelivery.update({
    where: { id: row.id },
    data: { voidedAt: new Date(), voidedById: req.user.id, voidReason: req.valid.reason || null },
    include,
  });
  await audit(req.user.id, 'DELIVERY_VOID', 'ProductDelivery', row.id, {
    before: jsonSafe(deliveryJson(row)), after: jsonSafe(deliveryJson(updated)), metadata: { reason: req.valid.reason || null },
  });
  ok(res, deliveryJson(updated));
}));
