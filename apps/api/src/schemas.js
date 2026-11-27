import { z } from 'zod';
import { parseDate } from './dates.js';
import { AppError } from './errors.js';

const dateString = z.string().refine((value) => {
  try { parseDate(value); return true; } catch { return false; }
}, 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ');

const amountString = z.union([
  z.string().regex(/^\d{1,18}$/, 'តម្លៃត្រូវជាលេខគត់'),
  z.number().int().nonnegative(),
]);

const note = z.string().trim().max(500).optional().nullable().transform((v) => v || null);

// The browser generates the entry id, so a retried save cannot create a second row.
const entryId = z.string().uuid('លេខសម្គាល់ប្រតិបត្តិការមិនត្រឹមត្រូវ');

/** Hand-entered entries are lend or product only; settling has its own endpoint. */
export const entryCreateSchema = z.object({
  id: entryId,
  type: z.enum(['LEND', 'PRODUCT'], 'ប្រភេទប្រតិបត្តិការមិនត្រឹមត្រូវ'),
  date: dateString,
  amount: amountString,
  note,
});

export const settleSchema = z.object({
  id: entryId,
  date: dateString.optional(),
  note,
});

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(1, 'សូមបញ្ចូលឈ្មោះដៃគូ').max(120),
});

export const partnerUpdateSchema = partnerCreateSchema;

export const voidSchema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

export const entryListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(['LEND', 'PRODUCT', 'SETTLE_IN', 'SETTLE_OUT']).optional(),
  search: z.string().trim().max(120).optional(),
  includeVoided: z.coerce.boolean().default(false),
});

/** Express middleware: validate and normalize req.body / req.query into req.valid. */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'form';
        details[key] = issue.message;
      }
      return next(new AppError('VALIDATION_ERROR', 400, details));
    }
    req.valid = result.data;
    next();
  };
}
