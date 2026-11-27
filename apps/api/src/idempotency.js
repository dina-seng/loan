import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { asyncHandler, badRequest, conflict } from './errors.js';

/**
 * Require an Idempotency-Key on financial write requests.
 * The key is scoped per user + route, so replaying a request returns the first
 * result and concurrent duplicates are rejected instead of creating twice.
 */
export function idempotent(scope) {
  return asyncHandler(async (req, res, next) => {
    const key = String(req.get('Idempotency-Key') || '').trim();
    if (key.length < 8 || key.length > 200) {
      throw badRequest('IDEMPOTENCY_KEY_REQUIRED');
    }
    const scopeKey = `${req.partnerId || 'global'}:${scope}:${req.route?.path || req.path}`;
    let record;
    try {
      record = await prisma.idempotencyKey.create({
        data: {
          userId: req.user.id,
          key,
          scope: scopeKey,
          result: { status: 0 },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      const existing = await prisma.idempotencyKey.findUnique({
        where: { userId_key_scope: { userId: req.user.id, key, scope: scopeKey } },
      });
      if (!existing || existing.result?.status === 0) {
        throw conflict('CONFLICT', undefined, 'ការបញ្ជូននេះកំពុងដំណើរការ សូមព្យាយាមម្តងទៀត');
      }
      return res.status(existing.result.status).json(existing.result.body);
    }

    const originalJson = res.json.bind(res);
    let settled = false;
    res.json = (body) => {
      if (!settled) {
        settled = true;
        if (res.statusCode < 400) {
          prisma.idempotencyKey
            .update({ where: { id: record.id }, data: { result: { status: res.statusCode, body } } })
            .catch((err) => console.error('[idempotency] update failed', err));
        } else {
          prisma.idempotencyKey
            .delete({ where: { id: record.id } })
            .catch((err) => console.error('[idempotency] cleanup failed', err));
        }
      }
      return originalJson(body);
    };
    next();
  });
}
