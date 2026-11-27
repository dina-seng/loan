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
const reference = z.string().trim().min(1).max(80);

export const lendingCreateSchema = z.object({
  transactionDate: dateString,
  amount: amountString,
  note,
  reference: reference.optional().nullable(),
});

export const deliveryCreateSchema = z.object({
  reference,
  deliveryDate: dateString,
  note,
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, 'បរិមាណមិនត្រឹមត្រូវ'),
    unitPrice: amountString,
  })).min(1, 'ត្រូវបញ្ចូលយ៉ាងតិចមួយទំនិញ').max(100),
});

export const paymentCreateSchema = z.object({
  paymentDate: dateString,
  direction: z.enum(['OUDOM_TO_DAD', 'DAD_TO_OUDOM']),
  amount: amountString,
  method: z.string().trim().min(1).max(50).default('cash'),
  note,
  reference: reference.optional().nullable(),
  settlementId: z.string().uuid().optional().nullable(),
});

export const settlementCreateSchema = z.object({
  paymentDate: dateString,
  amount: amountString,
  direction: z.enum(['OUDOM_TO_DAD', 'DAD_TO_OUDOM']).optional(),
  method: z.string().trim().min(1).max(50).default('cash'),
  note,
  periodClosingId: z.string().uuid().optional().nullable(),
  reference: reference.optional().nullable(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40),
  description: z.string().trim().max(500).optional().nullable(),
  unitPrice: amountString.optional(),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const voidSchema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

export const closingCreateSchema = z.object({
  startDate: dateString,
  endDate: dateString,
  note: z.string().trim().max(500).optional().nullable(),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(1, 'សូមបញ្ជាក់មូលហេតុ').max(300),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(['LENDING', 'DELIVERY', 'PAYMENT']).optional(),
  search: z.string().trim().max(120).optional(),
  includeVoided: z.coerce.boolean().default(false),
});

export const periodQuerySchema = z.object({
  startDate: dateString,
  endDate: dateString,
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
