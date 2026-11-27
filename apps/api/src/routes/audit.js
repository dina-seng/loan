import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ok } from '../errors.js';
import { auditListSchema, validate } from '../schemas.js';

export const auditRouter = Router();

/** Append-only trail for the selected partner, plus partner-independent actions. */
auditRouter.get('/', validate(auditListSchema, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, action, entityType, entityId } = req.valid;
  const where = {
    OR: [{ partnerId: req.partnerId }, { partnerId: null }],
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  ok(res, rows, { page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));
