import { z } from 'zod';
import { parseDate } from './dates.js';
import { AppError } from './errors.js';

const dateString = z.string().refine((value) => {
  try { parseDate(value); return true; } catch { return false; }
}, 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ');

// parseAmount() performs the exact integer/Khmer-digit validation. Zod only
// checks the shape so separators (1,200,000) are accepted at this stage.
const amountString = z.union([
  z.string().trim().min(1).max(40),
  z.number().int(),
]);

const quantityString = z.union([
  z.string().trim().min(1).max(20),
  z.number(),
]);

const note = z.string().trim().max(500).optional().nullable().transform((v) => v || null);
const reference = z.string().trim().min(1).max(80).optional().nullable().transform((v) => v || null);
const uuid = z.string().uuid('លេខសម្គាល់មិនត្រឹមត្រូវ');
const optionalId = uuid.optional();

/** Query strings arrive as "true"/"false"; z.coerce.boolean() would make "false" true. */
const booleanQuery = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}, z.boolean());

/** Hand-entered entries are lend or product only; settling has its own endpoint. */
export const entryCreateSchema = z.object({
  id: uuid,
  type: z.enum(['LEND', 'PRODUCT'], 'ប្រភេទប្រតិបត្តិការមិនត្រឹមត្រូវ'),
  date: dateString,
  amount: amountString,
  note,
  reference,
});

export const lendingCreateSchema = z.object({
  id: optionalId,
  transactionDate: dateString,
  amount: amountString,
  note,
  reference,
});

export const settleSchema = z.object({
  id: uuid,
  date: dateString.optional(),
  note,
});

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(1, 'សូមបញ្ចូលឈ្មោះដៃគូ').max(120),
  openingBalance: amountString.optional(),
});

export const partnerUpdateSchema = z.object({
  name: z.string().trim().min(1, 'សូមបញ្ចូលឈ្មោះដៃគូ').max(120).optional(),
  openingBalance: amountString.optional(),
}).refine((value) => value.name !== undefined || value.openingBalance !== undefined, {
  message: 'សូមបញ្ចូលទិន្នន័យដែលត្រូវកែ',
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'សូមបញ្ចូលឈ្មោះទំនិញ').max(120),
  unit: z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  defaultUnitPrice: amountString.optional().nullable(),
  note,
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1, 'សូមបញ្ចូលឈ្មោះទំនិញ').max(120).optional(),
  unit: z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  defaultUnitPrice: amountString.optional().nullable(),
  note,
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'សូមបញ្ចូលទិន្នន័យដែលត្រូវកែ' });

const deliveryItemSchema = z.object({
  productId: uuid.optional().nullable(),
  productName: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  unit: z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  quantity: quantityString,
  unitPrice: amountString.optional().nullable(),
  note: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
}).refine((value) => Boolean(value.productId || value.productName), {
  message: 'សូមជ្រើសរើស ឬបញ្ចូលឈ្មោះទំនិញ',
  path: ['productName'],
});

export const deliveryCreateSchema = z.object({
  id: optionalId,
  deliveryDate: dateString,
  note,
  reference,
  items: z.array(deliveryItemSchema)
    .min(1, 'ត្រូវមានទំនិញយ៉ាងតិចមួយ')
    .max(100, 'ទំនិញច្រើនពេក'),
});

export const paymentCreateSchema = z.object({
  id: optionalId,
  paymentDate: dateString,
  direction: z.enum(['PARTNER_TO_DAD', 'DAD_TO_PARTNER'], 'ទិសដៅទូទាត់មិនត្រឹមត្រូវ'),
  amount: amountString,
  method: z.string().trim().min(1).max(50).default('cash'),
  note,
  reference,
});

export const settlementCreateSchema = z.object({
  id: optionalId,
  paymentDate: dateString,
  amount: amountString.optional(),
  fullBalance: z.boolean().optional().default(false),
  direction: z.enum(['PARTNER_TO_DAD', 'DAD_TO_PARTNER'], 'ទិសដៅទូទាត់មិនត្រឹមត្រូវ').optional(),
  method: z.string().trim().min(1).max(50).default('cash'),
  note,
  reference,
  periodClosingId: uuid.optional().nullable(),
});

export const voidSchema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

export const closingCreateSchema = z.object({
  startDate: dateString,
  endDate: dateString,
  note,
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(1, 'សូមបញ្ចូលមូលហេតុ').max(300),
});

export const entryListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(['LEND', 'PRODUCT', 'SETTLE_IN', 'SETTLE_OUT']).optional(),
  kind: z.enum(['LENDING', 'DELIVERY', 'PAYMENT']).optional(),
  search: z.string().trim().max(120).optional(),
  includeVoided: booleanQuery.default(false),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(['LEND', 'PRODUCT', 'SETTLE_IN', 'SETTLE_OUT']).optional(),
  kind: z.enum(['LENDING', 'DELIVERY', 'PAYMENT']).optional(),
  search: z.string().trim().max(120).optional(),
  includeVoided: booleanQuery.default(false),
});

export const periodQuerySchema = z.object({
  startDate: dateString,
  endDate: dateString,
});

/** Dashboard/report filters: both bounds optional, but validated when present. */
export const periodFilterSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'ថ្ងៃបញ្ចប់ត្រូវនៅក្រោយថ្ងៃចាប់ផ្តើម',
  path: ['to'],
});

export const auditListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
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
