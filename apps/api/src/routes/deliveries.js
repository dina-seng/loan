import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { assertNotClosed } from '../ledger.js';
import { lineTotalFromScaled, parseAmount, parseQuantity } from '../money.js';
import { parseDate, dateWhere } from '../dates.js';
import { deliveryJson } from '../serialize.js';
import { deliveryCreateSchema, listQuerySchema, validate, voidSchema } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { audit, jsonSafe } from '../audit.js';

export const deliveriesRouter = Router();
deliveriesRouter.use(authRequired);

const include = { items: { orderBy: { sortOrder: 'asc' } } };

deliveriesRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, from, to, search, includeVoided } = req.valid;
  const where = {
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
  const row = await prisma.productDelivery.findUnique({ where: { id: req.params.id }, include });
  if (!row) throw notFound();
  ok(res, deliveryJson(row));
}));

/** All item totals are computed here from validated inputs; the client never sends totals. */
deliveriesRouter.post('/', validate(deliveryCreateSchema), idempotent('delivery'), asyncHandler(async (req, res) => {
  const data = req.valid;
  const deliveryDate = parseDate(data.deliveryDate);
  await assertNotClosed(deliveryDate);
  const productIds = [...new Set(data.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const byId = new Map(products.map((product) => [product.id, product]));

  const computed = data.items.map((item, index) => {
    const product = byId.get(item.productId);
    if (!product) throw notFound();
    const quantity = parseQuantity(item.quantity);
    const unitPrice = parseAmount(item.unitPrice, { field: 'unitPrice', allowZero: true });
    return {
      productId: product.id,
      productNameSnapshot: product.name,
      unit: product.unit,
      quantity: quantity.decimal,
      unitPrice,
      lineTotal: lineTotalFromScaled(quantity.scaled, unitPrice),
      sortOrder: index,
    };
  });
  const totalAmount = computed.reduce((sum, item) => sum + item.lineTotal, 0n);

  const row = await prisma.productDelivery.create({
    data: {
      reference: data.reference,
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
  const row = await prisma.productDelivery.findUnique({ where: { id: req.params.id }, include });
  if (!row) throw notFound();
  if (row.voidedAt) throw notFound();
  await assertNotClosed(row.deliveryDate);
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
