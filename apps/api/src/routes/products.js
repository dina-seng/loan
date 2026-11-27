import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { AppError, asyncHandler, notFound, ok } from '../errors.js';
import { parseAmount } from '../money.js';
import { productJson } from '../serialize.js';
import { productCreateSchema, productUpdateSchema, validate } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { audit, jsonSafe } from '../audit.js';

export const productsRouter = Router();
productsRouter.use(authRequired);

productsRouter.get('/', asyncHandler(async (req, res) => {
  const includeInactive = String(req.query.includeInactive || '') === 'true';
  const rows = await prisma.product.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  ok(res, rows.map(productJson));
}));

productsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound();
  ok(res, productJson(row));
}));

productsRouter.post('/', validate(productCreateSchema), idempotent('product'), asyncHandler(async (req, res) => {
  const data = req.valid;
  const row = await prisma.product.create({
    data: {
      name: data.name,
      unit: data.unit,
      description: data.description || null,
      unitPrice: data.unitPrice !== undefined ? parseAmount(data.unitPrice, { field: 'unitPrice', allowZero: true }) : 0n,
    },
  });
  await audit(req.user.id, 'PRODUCT_CREATE', 'Product', row.id, { after: jsonSafe(productJson(row)) });
  ok(res, productJson(row), undefined, 201);
}));

productsRouter.patch('/:id', validate(productUpdateSchema), asyncHandler(async (req, res) => {
  const before = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const data = req.valid;
  const row = await prisma.product.update({
    where: { id: before.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.unitPrice !== undefined ? { unitPrice: parseAmount(data.unitPrice, { field: 'unitPrice', allowZero: true }) } : {}),
    },
  });
  await audit(req.user.id, data.isActive === false ? 'PRODUCT_DEACTIVATE' : 'PRODUCT_UPDATE', 'Product', row.id, {
    before: jsonSafe(productJson(before)), after: jsonSafe(productJson(row)),
  });
  ok(res, productJson(row));
}));

productsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.product.findUnique({
    where: { id: req.params.id }, include: { _count: { select: { deliveryItems: true } } },
  });
  if (!row) throw notFound();
  if (row._count.deliveryItems > 0) throw new AppError('PRODUCT_IN_USE', 409);
  await prisma.product.delete({ where: { id: row.id } });
  await audit(req.user.id, 'PRODUCT_DELETE', 'Product', row.id, { before: jsonSafe(productJson(row)) });
  ok(res, { deleted: true });
}));
