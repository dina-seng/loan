import { Prisma } from '@prisma/client';

const MESSAGES = {
  VALIDATION_ERROR: 'ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ',
  UNAUTHORIZED: 'សូមចូលប្រើគណនីឡើងវិញ',
  INVALID_CREDENTIALS: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
  ACCOUNT_DISABLED: 'គណនីនេះត្រូវបានបិទ',
  TOO_MANY_ATTEMPTS: 'បានព្យាយាមច្រើនដង សូមរង់ចាំបន្តិចហើយព្យាយាមម្តងទៀត',
  FORBIDDEN: 'អ្នកមិនមានសិទ្ធិធ្វើសកម្មភាពនេះទេ',
  NOT_FOUND: 'រកមិនឃើញទិន្នន័យនេះទេ',
  CONFLICT: 'ទិន្នន័យនេះមានរួចហើយ',
  NOTHING_TO_SETTLE: 'មិនមានសមតុល្យត្រូវទូទាត់ទេ',
  INTERNAL_ERROR: 'មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្តងទៀត',
};

export class AppError extends Error {
  constructor(code, status = 400, details = undefined, customMessage = undefined) {
    super(customMessage || MESSAGES[code] || code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (code = 'VALIDATION_ERROR', details, message) => new AppError(code, 400, details, message);
export const unauthorized = (code = 'UNAUTHORIZED') => new AppError(code, 401);
export const forbidden = () => new AppError('FORBIDDEN', 403);
export const notFound = () => new AppError('NOT_FOUND', 404);
export const conflict = (code = 'CONFLICT', details, message) => new AppError(code, 409, details, message);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: MESSAGES.CONFLICT } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: MESSAGES.NOT_FOUND } });
    }
  }
  // Never expose internal error details in production.
  console.error('[error]', err);
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: configIsProduction() ? MESSAGES.INTERNAL_ERROR : String(err.message || err),
    },
  });
}

function configIsProduction() {
  return process.env.NODE_ENV === 'production';
}

export function ok(res, data, meta, status = 200) {
  return res.status(status).json({ ok: true, data, ...(meta ? { meta } : {}) });
}
