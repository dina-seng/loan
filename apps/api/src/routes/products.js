import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { audit, jsonSafe } from '../audit.js';
import { asyncHandler, conflict, notFound, ok } from '../errors.js';
import { parseAmount } from '../money.js';
import { assertUuidParam } from '../partner.js';
import { productJson } from '../serialize.js';
import { listQuerySchema, productCreateSchema, productUpdateSchema, validate } from '../schemas.js';

export const productsRouter = Router();
productsRouter.use(authRequired);

/** The product catalog is shared by all partners, not owned by one partner. */
productsRouter.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize } = req.valid;
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count(),
  ]);
  ok(res, rows.map(productJson), { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));

productsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.product.findUnique({ where: { id: assertUuidParam(req.params.id) } });
  if (!row) throw notFound();
  ok(res, productJson(row));
}));

productsRouter.post('/', validate(productCreateSchema), asyncHandler(async (req, res) => {
  const data = req.valid;
  const existing = await prisma.product.findFirst({
    where: { name: { equals: data.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw conflict('CONFLICT', { name: 'ឈ្មោះទំនិញនេះមានរួចហើយ' });
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: data.name,
        unit: data.unit ?? null,
        defaultUnitPrice: data.defaultUnitPrice == null
          ? null
          : parseAmount(data.defaultUnitPrice, { field: 'defaultUnitPrice', allowZero: true }),
        note: data.note ?? null,
      },
    });
    await audit(req.user.id, 'PRODUCT_CREATE', 'Product', created.id, {
      after: jsonSafe(productJson(created)),
    }, tx);
    return created;
  });
  ok(res, productJson(row), undefined, 201);
}));

productsRouter.patch('/:id', validate(productUpdateSchema), asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw notFound();
  const data = req.valid;
  if (data.name && data.name !== before.name) {
    const existing = await prisma.product.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' }, id: { not: id } },
      select: { id: true },
    });
    if (existing) throw conflict('CONFLICT', { name: 'ឈ្មោះទំនិញនេះមានរួចហើយ' });
  }
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.defaultUnitPrice !== undefined ? {
          defaultUnitPrice: data.defaultUnitPrice == null
            ? null
            : parseAmount(data.defaultUnitPrice, { field: 'defaultUnitPrice', allowZero: true }),
        } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await audit(req.user.id, 'PRODUCT_UPDATE', 'Product', updated.id, {
      before: jsonSafe(productJson(before)),
      after: jsonSafe(productJson(updated)),
    }, tx);
    return updated;
  });
  ok(res, productJson(row));
}));

/** Deactivate instead of delete so historical delivery snapshots stay intact. */
productsRouter.post('/:id/deactivate', asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: { isActive: false } });
    await audit(req.user.id, 'PRODUCT_DEACTIVATE', 'Product', updated.id, {
      after: jsonSafe(productJson(updated)),
    }, tx);
    return updated;
  });
  ok(res, productJson(row));
}));
