import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { addDays, assertRange, dateWhere, parseDate, toISODate } from './dates.js';
import { AppError, badRequest, conflict, notFound } from './errors.js';
import { lineTotalFromScaled, money, parseAmount, parseQuantity, sumAmounts } from './money.js';
import { audit, jsonSafe } from './audit.js';

/**
 * The sign each entry type contributes to its partner's mutual balance.
 * Positive means the partner owes us more; negative means we owe the partner more.
 * This is the ONLY place where financial direction is defined.
 */
export const TYPE_EFFECT = Object.freeze({
  LEND: 1n,
  PRODUCT: -1n,
  SETTLE_IN: -1n,
  SETTLE_OUT: 1n,
});

/** User-facing grouping used by the unified transaction list. */
export const KIND_BY_TYPE = Object.freeze({
  LEND: 'LENDING',
  PRODUCT: 'DELIVERY',
  SETTLE_IN: 'PAYMENT',
  SETTLE_OUT: 'PAYMENT',
});

export const ENTRY_INCLUDE = Object.freeze({
  deliveryItems: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  settlement: true,
});

/** Exact signed value of one entry. */
export function signedAmount(type, amount) {
  return BigInt(amount) * TYPE_EFFECT[type];
}

/**
 * THE balance function. Every balance in the app (dashboard, partner list,
 * history, statements and settle) is produced here and nowhere else.
 */
export function computeBalance(entries = [], openingBalance = 0n) {
  return entries.reduce((total, entry) => total + signedAmount(entry.type, entry.amount), BigInt(openingBalance));
}

/** Pure period totals used by the dashboard, statements and closing snapshots. */
export function summarize(entries = []) {
  const totals = { totalLent: 0n, totalDelivered: 0n, totalReceived: 0n, totalPaidOut: 0n, count: 0 };
  for (const entry of entries) {
    if (entry.voidedAt) continue;
    totals.count += 1;
    switch (entry.type) {
      case 'LEND': totals.totalLent += BigInt(entry.amount); break;
      case 'PRODUCT': totals.totalDelivered += BigInt(entry.amount); break;
      case 'SETTLE_IN': totals.totalReceived += BigInt(entry.amount); break;
      case 'SETTLE_OUT': totals.totalPaidOut += BigInt(entry.amount); break;
      default: break;
    }
  }
  return totals;
}

export function balanceDirection(balance) {
  if (balance > 0n) return 'PARTNER_OWES_US';
  if (balance < 0n) return 'WE_OWE_PARTNER';
  return 'SETTLED';
}

/** Non-voided entries for one partner, oldest first. */
export async function fetchEntries({
  partnerId,
  includeVoided = false,
  from,
  to,
  type,
  search,
  withDetails = false,
  client = prisma,
} = {}) {
  return client.entry.findMany({
    where: {
      ...(partnerId ? { partnerId } : {}),
      ...(includeVoided ? {} : { voidedAt: null }),
      ...dateWhere('entryDate', from, to),
      ...(type ? { type } : {}),
      ...(search ? {
        OR: [
          { note: { contains: search, mode: 'insensitive' } },
          { reference: { contains: search, mode: 'insensitive' } },
          { deliveryItems: { some: { productName: { contains: search, mode: 'insensitive' } } } },
        ],
      } : {}),
    },
    orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    ...(withDetails ? { include: ENTRY_INCLUDE } : {}),
  });
}

export async function getPartner(partnerId, client = prisma) {
  const partner = await client.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw notFound();
  return partner;
}

/** The one balance lookup used by the dashboard, partner list and settle. */
export async function getPartnerBalance(partnerId, client = prisma) {
  const partner = await getPartner(partnerId, client);
  return computeBalance(await fetchEntries({ partnerId, client }), partner.openingBalance);
}

/** Period totals plus the current balance from the same entry set. */
export async function getPartnerSummary(partnerId, { from, to, client = prisma } = {}) {
  const partner = await getPartner(partnerId, client);
  const entries = await fetchEntries({ partnerId, from, to, client });
  const allEntries = from || to ? await fetchEntries({ partnerId, client }) : entries;
  return {
    balance: computeBalance(allEntries, partner.openingBalance),
    totals: summarize(entries),
  };
}

/** All partners with their current balance, computed by computeBalance. */
export async function listPartnerBalances(client = prisma) {
  const [partners, entries] = await Promise.all([
    client.partner.findMany({ orderBy: { name: 'asc' } }),
    fetchEntries({ client }),
  ]);
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.partnerId)) grouped.set(entry.partnerId, []);
    grouped.get(entry.partnerId).push(entry);
  }
  return partners.map((partner) => {
    const own = grouped.get(partner.id) || [];
    return {
      partner,
      balance: computeBalance(own, partner.openingBalance),
      totals: summarize(own),
    };
  });
}

/**
 * Serialize financial writes for one partner. Called inside the same database
 * transaction as the balance read, so two concurrent settles/payments cannot
 * both use the same starting balance.
 */
export async function lockPartner(tx, partnerId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${partnerId}))`;
}

/** Reject writes inside an actively closed period for this partner only. */
export async function assertNotClosed(date, client = prisma, partnerId) {
  const target = date instanceof Date ? date : parseDate(date);
  const closed = await client.periodClosing.findFirst({
    where: {
      partnerId,
      status: 'ACTIVE',
      periodStart: { lte: target },
      periodEnd: { gte: target },
    },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  if (closed) {
    const lastClosedDate = toISODate(closed.periodEnd);
    const earliestAllowedDate = toISODate(addDays(closed.periodEnd, 1));
    throw conflict(
      'PERIOD_CLOSED',
      { closingId: closed.id, lastClosedDate, earliestAllowedDate },
      `កាលបរិច្ឆេទនេះស្ថិតក្នុងកំឡុងពេលដែលបានបិទហើយ។ ថ្ងៃបិទចុងក្រោយ ${lastClosedDate}។ ថ្ងៃដំបូងដែលអាចបញ្ចូលបាន ${earliestAllowedDate}។`,
    );
  }
  return closed;
}

export async function latestActiveClosing(client = prisma, partnerId) {
  return client.periodClosing.findFirst({
    where: { partnerId, status: 'ACTIVE' },
    orderBy: { periodEnd: 'desc' },
  });
}

/** Earliest date a new entry may use, after the latest active closing. */
export async function getFirstOpenDate(partnerId, client = prisma) {
  const latest = await latestActiveClosing(client, partnerId);
  if (!latest) return null;
  return toISODate(addDays(latest.periodEnd, 1));
}

/** Server-computed monthly subtotals — the browser never adds money itself. */
export function monthlyTotals(entries = []) {
  const months = new Map();
  for (const entry of entries) {
    const key = toISODate(entry.entryDate).slice(0, 7);
    if (!months.has(key)) months.set(key, { month: key, ...summarize([]) });
    const bucket = months.get(key);
    if (!entry.voidedAt) {
      bucket.count += 1;
      switch (entry.type) {
        case 'LEND': bucket.totalLent += BigInt(entry.amount); break;
        case 'PRODUCT': bucket.totalDelivered += BigInt(entry.amount); break;
        case 'SETTLE_IN': bucket.totalReceived += BigInt(entry.amount); break;
        case 'SETTLE_OUT': bucket.totalPaidOut += BigInt(entry.amount); break;
        default: break;
      }
    }
  }
  return [...months.values()].reverse();
}

/** Compute a settlement preview for any custom [start, end] period of one partner. */
export async function buildPeriodPreview(startValue, endValue, {
  client = prisma,
  partnerId,
  openingBalance = 0n,
} = {}) {
  const { startDate, endDate } = assertRange(startValue, endValue);
  const startISO = toISODate(startDate);
  const endISO = toISODate(endDate);

  const [entries, previousClosing] = await Promise.all([
    fetchEntries({ partnerId, client }),
    client.periodClosing.findFirst({
      where: { partnerId, status: 'ACTIVE', periodEnd: { lt: startDate } },
      orderBy: { periodEnd: 'desc' },
    }),
  ]);

  const before = entries.filter((entry) => toISODate(entry.entryDate) < startISO);
  const periodEntries = entries.filter((entry) => {
    const date = toISODate(entry.entryDate);
    return date >= startISO && date <= endISO;
  });
  const totals = summarize(periodEntries);
  const signedSum = sumAmounts(periodEntries.map((entry) => signedAmount(entry.type, entry.amount)));
  const opening = computeBalance(before, openingBalance);
  const settlementAmount = totals.totalReceived - totals.totalPaidOut;

  return {
    partnerId,
    periodStart: startDate,
    periodEnd: endDate,
    startDate: startISO,
    endDate: endISO,
    openingBalance: opening,
    previousClosingId: previousClosing?.id || null,
    previousClosingBalance: previousClosing?.closingBalance ?? null,
    totalLent: totals.totalLent,
    totalDelivered: totals.totalDelivered,
    totalReceived: totals.totalReceived,
    totalPaidOut: totals.totalPaidOut,
    settlementAmount,
    netBeforeSettlement: opening + signedSum,
    closingBalance: opening + signedSum,
    transactionCount: totals.count,
    entries: periodEntries,
  };
}

/** Convert a preview (bigints) into a JSON-safe snapshot stored on a closing. */
export function previewToSnapshot(preview) {
  return {
    partnerId: preview.partnerId,
    startDate: preview.startDate,
    endDate: preview.endDate,
    openingBalance: money(preview.openingBalance),
    totalLent: money(preview.totalLent),
    totalDelivered: money(preview.totalDelivered),
    totalReceived: money(preview.totalReceived),
    totalPaidOut: money(preview.totalPaidOut),
    settlementAmount: money(preview.settlementAmount),
    netBeforeSettlement: money(preview.netBeforeSettlement),
    closingBalance: money(preview.closingBalance),
    transactionCount: preview.transactionCount,
    generatedAt: new Date().toISOString(),
  };
}

function isUniqueViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function existingEntry(id, partnerId, client = prisma) {
  const row = await client.entry.findUnique({ where: { id }, include: ENTRY_INCLUDE });
  if (!row) return null;
  if (row.partnerId !== partnerId) {
    throw conflict('CONFLICT', undefined, 'លេខសម្គាល់ប្រតិបត្តិការនេះត្រូវបានប្រើរួចហើយ');
  }
  return row;
}

/**
 * A repeated browser-generated id means the request was already handled.
 * The existing row is returned instead of writing a second row.
 */
async function runIdempotent({ id, partnerId, fn }) {
  if (id) {
    const existing = await existingEntry(id, partnerId);
    if (existing) return { row: existing, created: false };
  }
  try {
    return await fn();
  } catch (error) {
    if (id && isUniqueViolation(error)) {
      const existing = await existingEntry(id, partnerId);
      if (existing) return { row: existing, created: false };
    }
    throw error;
  }
}

function auditShape(row) {
  return {
    id: row.id,
    partnerId: row.partnerId,
    type: row.type,
    date: toISODate(row.entryDate),
    amount: row.amount.toString(),
    note: row.note ?? null,
    reference: row.reference ?? null,
  };
}

/** Create one LEND/PRODUCT entry without delivery lines (legacy /entries route). */
export async function createEntry({ id, partnerId, type, date, amount, note, reference, userId }) {
  const entryId = id || randomUUID();
  return runIdempotent({
    id,
    partnerId,
    fn: async () => prisma.$transaction(async (tx) => {
      await lockPartner(tx, partnerId);
      await getPartner(partnerId, tx);
      await assertNotClosed(date, tx, partnerId);
      const row = await tx.entry.create({
        data: {
          id: entryId,
          partnerId,
          type,
          entryDate: date,
          amount,
          note: note ?? null,
          reference: reference ?? null,
          createdById: userId,
        },
        include: ENTRY_INCLUDE,
      });
      await audit(userId, 'ENTRY_CREATE', 'Entry', row.id, {
        after: jsonSafe(auditShape(row)),
        partnerId,
      }, tx);
      return { row, created: true };
    }),
  });
}

/** Create one PRODUCT entry with server-computed multi-line delivery items. */
export async function createDelivery({ id, partnerId, date, note, reference, items, userId }) {
  const entryId = id || randomUUID();
  return runIdempotent({
    id,
    partnerId,
    fn: async () => prisma.$transaction(async (tx) => {
      await lockPartner(tx, partnerId);
      await getPartner(partnerId, tx);
      await assertNotClosed(date, tx, partnerId);

      const computed = [];
      for (const [index, item] of items.entries()) {
        let product = null;
        if (item.productId) {
          product = await tx.product.findFirst({ where: { id: item.productId, isActive: true } });
          if (!product) throw badRequest('PRODUCT_NOT_FOUND', { [`items.${index}.productId`]: 'រកមិនឃើញទំនិញនេះទេ' });
        }
        const quantity = parseQuantity(item.quantity, `items.${index}.quantity`);
        const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
          ? parseAmount(item.unitPrice, { field: `items.${index}.unitPrice`, allowZero: true })
          : (product?.defaultUnitPrice == null ? null : BigInt(product.defaultUnitPrice));
        if (unitPrice === null) {
          throw badRequest('VALIDATION_ERROR', { [`items.${index}.unitPrice`]: 'សូមបញ្ចូលតម្លៃឯកតា' });
        }
        const productName = product?.name || String(item.productName || '').trim();
        if (!productName) {
          throw badRequest('VALIDATION_ERROR', { [`items.${index}.productName`]: 'សូមបញ្ចូលឈ្មោះទំនិញ' });
        }
        computed.push({
          productId: product?.id ?? null,
          productName,
          unit: product?.unit ?? item.unit ?? null,
          quantity: quantity.decimal,
          unitPrice,
          lineTotal: lineTotalFromScaled(quantity.scaled, unitPrice),
          sortOrder: index,
          note: item.note ?? null,
        });
      }

      const totalAmount = computed.reduce((sum, item) => sum + item.lineTotal, 0n);
      if (totalAmount <= 0n) {
        throw badRequest('VALIDATION_ERROR', { items: 'តម្លៃទំនិញសរុបត្រូវធំជាង ០' });
      }

      const row = await tx.entry.create({
        data: {
          id: entryId,
          partnerId,
          type: 'PRODUCT',
          entryDate: date,
          amount: totalAmount,
          note: note ?? null,
          reference: reference ?? null,
          createdById: userId,
          deliveryItems: { create: computed },
        },
        include: ENTRY_INCLUDE,
      });
      await audit(userId, 'DELIVERY_CREATE', 'Entry', row.id, {
        after: jsonSafe({ ...auditShape(row), items: computed.map((item) => ({ ...item, unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString() })) }),
        partnerId,
      }, tx);
      return { row, created: true };
    }),
  });
}

/**
 * Create a SETTLE_IN / SETTLE_OUT entry plus its payment detail.
 * `fullBalance` clears the exact outstanding balance; otherwise `amount` is a
 * partial payment and the residual carries forward.
 */
export async function createSettlement({
  id,
  partnerId,
  date,
  amount = null,
  direction = null,
  method = 'cash',
  note = null,
  reference = null,
  periodClosingId = null,
  userId,
  fullBalance = false,
}) {
  const entryId = id || randomUUID();
  return runIdempotent({
    id,
    partnerId,
    fn: async () => prisma.$transaction(async (tx) => {
      await lockPartner(tx, partnerId);
      const partner = await getPartner(partnerId, tx);
      await assertNotClosed(date, tx, partnerId);

      const entries = await fetchEntries({ partnerId, client: tx });
      const balanceBefore = computeBalance(entries, partner.openingBalance);

      let settledAmount = amount;
      if (fullBalance) {
        if (balanceBefore === 0n) throw new AppError('NOTHING_TO_SETTLE', 409);
        settledAmount = balanceBefore > 0n ? balanceBefore : -balanceBefore;
      }
      if (settledAmount == null || settledAmount <= 0n) {
        throw badRequest('VALIDATION_ERROR', { amount: 'តម្លៃត្រូវធំជាង ០' });
      }

      let settledDirection = direction;
      if (!settledDirection) {
        if (balanceBefore === 0n) {
          throw badRequest('VALIDATION_ERROR', { direction: 'សូមជ្រើសរើសទិសដៅទូទាត់' });
        }
        settledDirection = balanceBefore > 0n ? 'PARTNER_TO_DAD' : 'DAD_TO_PARTNER';
      }
      if (settledDirection !== 'PARTNER_TO_DAD' && settledDirection !== 'DAD_TO_PARTNER') {
        throw badRequest('VALIDATION_ERROR', { direction: 'ទិសដៅទូទាត់មិនត្រឹមត្រូវ' });
      }

      if (periodClosingId) {
        const closing = await tx.periodClosing.findFirst({ where: { id: periodClosingId, partnerId } });
        if (!closing) throw notFound();
      }

      const type = settledDirection === 'PARTNER_TO_DAD' ? 'SETTLE_IN' : 'SETTLE_OUT';
      const balanceAfter = balanceBefore + signedAmount(type, settledAmount);
      const status = balanceAfter === 0n ? 'FULL' : 'PARTIAL';

      const row = await tx.entry.create({
        data: {
          id: entryId,
          partnerId,
          type,
          entryDate: date,
          amount: settledAmount,
          note: note ?? null,
          reference: reference ?? null,
          createdById: userId,
          settlement: {
            create: {
              partnerId,
              direction: settledDirection,
              amount: settledAmount,
              method,
              status,
              balanceAfter,
              periodClosingId: periodClosingId ?? null,
              note: note ?? null,
              reference: reference ?? null,
            },
          },
        },
        include: ENTRY_INCLUDE,
      });

      await audit(userId, 'SETTLEMENT_CREATE', 'Settlement', row.settlement.id, {
        after: jsonSafe({ ...auditShape(row), direction: settledDirection, status, balanceAfter: balanceAfter.toString() }),
        metadata: { balanceBefore: balanceBefore.toString(), balanceAfter: balanceAfter.toString() },
        partnerId,
      }, tx);
      return { row, created: true, balanceBefore, balanceAfter };
    }),
  });
}

/** Clear a partner's balance with ONE entry for its full amount. */
export async function settlePartner({ partnerId, id, date, note, userId }) {
  return createSettlement({ partnerId, id, date, note, userId, fullBalance: true });
}

/** Soft-delete an entry and record who voided it and why. */
export async function voidEntry({ partnerId, id, reason, userId }) {
  return prisma.$transaction(async (tx) => {
    await lockPartner(tx, partnerId);
    const row = await tx.entry.findFirst({ where: { id, partnerId }, include: ENTRY_INCLUDE });
    if (!row || row.voidedAt) throw notFound();
    await assertNotClosed(row.entryDate, tx, partnerId);
    const updated = await tx.entry.update({
      where: { id: row.id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason ?? null },
      include: ENTRY_INCLUDE,
    });
    await audit(userId, 'ENTRY_VOID', 'Entry', row.id, {
      before: jsonSafe(auditShape(row)),
      after: jsonSafe({ ...auditShape(updated), voidedAt: updated.voidedAt, voidReason: updated.voidReason }),
      metadata: { reason: reason ?? null },
      partnerId,
    }, tx);
    return updated;
  });
}
