import { prisma } from './db.js';
import { dateWhere, parseDate, toISODate } from './dates.js';
import { AppError } from './errors.js';
import { money, sumAmounts } from './money.js';

/**
 * The sign each validated ledger record contributes to the mutual balance.
 * Positive means Oudom owes Dad more. Negative means Dad owes Oudom more.
 * This is the ONLY place in the backend where financial direction is defined.
 */
export const EFFECT = Object.freeze({
  LENDING: 1n,
  DELIVERY: -1n,
  OUDOM_TO_DAD: -1n,
  DAD_TO_OUDOM: 1n,
});

export const DIRECTION_LABEL = Object.freeze({
  LENDING: 'ការឱ្យខ្ចីប្រាក់',
  DELIVERY: 'ការទទួលទំនិញ',
  OUDOM_TO_DAD: 'អ៊ូដុំ → ប៉ា',
  DAD_TO_OUDOM: 'ប៉ា → អ៊ូដុំ',
});

/** Pure balance calculation. `entries` must provide exact `signedAmount` bigints. */
export function computeBalance(entries = [], openingBalance = 0n) {
  return entries.reduce((balance, entry) => balance + BigInt(entry.signedAmount), BigInt(openingBalance));
}

/** Pure period totals used by dashboard, statements and closing snapshots. */
export function summarize(entries = []) {
  const totals = {
    totalLent: 0n,
    totalDelivered: 0n,
    totalReceived: 0n,
    totalPaidOut: 0n,
    count: 0,
  };
  for (const entry of entries) {
    if (entry.voidedAt) continue;
    totals.count += 1;
    switch (entry.kind) {
      case 'LENDING': totals.totalLent += BigInt(entry.amount); break;
      case 'DELIVERY': totals.totalDelivered += BigInt(entry.amount); break;
      case 'PAYMENT':
        if (entry.direction === 'OUDOM_TO_DAD') totals.totalReceived += BigInt(entry.amount);
        else totals.totalPaidOut += BigInt(entry.amount);
        break;
      default: break;
    }
  }
  return totals;
}

function normalizeEntry(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    date: toISODate(entry.date),
    reference: entry.reference || null,
    description: entry.description || DIRECTION_LABEL[entry.kind] || '',
    amount: BigInt(entry.amount),
    direction: entry.direction || entry.kind,
    signedAmount: BigInt(entry.signedAmount),
    voidedAt: entry.voidedAt || null,
    createdAt: entry.createdAt,
  };
}

/** JSON-safe version for API responses. */
export function serializeEntry(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    date: entry.date,
    reference: entry.reference,
    description: entry.description,
    amount: money(entry.amount),
    direction: entry.direction,
    effect: entry.signedAmount > 0n ? 'INCREASE' : 'DECREASE',
    signedAmount: money(entry.signedAmount),
    voidedAt: entry.voidedAt ? toISODate(entry.voidedAt) : null,
  };
}

/**
 * Read the validated, non-voided ledger records for an optional date range.
 * All balance calculations in the app go through here.
 */
export async function fetchLedgerEntries({ from, to, includeVoided = false, client = prisma } = {}) {
  const active = includeVoided ? {} : { voidedAt: null };
  const [lendings, deliveries, payments] = await Promise.all([
    client.lendingTransaction.findMany({ where: { ...dateWhere('transactionDate', from, to), ...active } }),
    client.productDelivery.findMany({ where: { ...dateWhere('deliveryDate', from, to), ...active } }),
    client.payment.findMany({ where: { ...dateWhere('paymentDate', from, to), ...active } }),
  ]);

  const entries = [
    ...lendings.map((row) => normalizeEntry({
      id: row.id, kind: 'LENDING', date: row.transactionDate, reference: row.reference,
      description: row.note || DIRECTION_LABEL.LENDING, amount: row.amount,
      signedAmount: row.amount * EFFECT.LENDING, voidedAt: row.voidedAt, createdAt: row.createdAt,
    })),
    ...deliveries.map((row) => normalizeEntry({
      id: row.id, kind: 'DELIVERY', date: row.deliveryDate, reference: row.reference,
      description: `OD-${row.reference}${row.note ? ` · ${row.note}` : ''}`,
      amount: row.totalAmount, signedAmount: row.totalAmount * EFFECT.DELIVERY,
      voidedAt: row.voidedAt, createdAt: row.createdAt,
    })),
    ...payments.map((row) => normalizeEntry({
      id: row.id, kind: 'PAYMENT', date: row.paymentDate, reference: row.reference,
      description: row.note || DIRECTION_LABEL[row.direction], amount: row.amount,
      direction: row.direction,
      signedAmount: row.amount * EFFECT[row.direction], voidedAt: row.voidedAt, createdAt: row.createdAt,
    })),
  ];

  return entries.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

export async function getAccountSettings(client = prisma) {
  const settings = await client.accountSettings.findUnique({ where: { id: 'main' } });
  if (!settings) throw new AppError('INTERNAL_ERROR', 500, undefined, 'Account settings are missing. Run the seed script.');
  return settings;
}

export async function getBalance({ from, to } = {}, client = prisma) {
  const [entries, settings] = await Promise.all([
    fetchLedgerEntries({ from, to, client }),
    getAccountSettings(client),
  ]);
  return computeBalance(entries, settings.openingBalance);
}

/** Reject writes inside an actively closed period. */
export async function assertNotClosed(date, client = prisma) {
  const closed = await client.periodClosing.findFirst({
    where: { status: 'ACTIVE', periodStart: { lte: date }, periodEnd: { gte: date } },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  if (closed) throw new AppError('PERIOD_CLOSED', 409);
  return closed;
}

export async function latestActiveClosing(client = prisma) {
  return client.periodClosing.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { periodEnd: 'desc' },
  });
}

/**
 * Compute a settlement preview for any custom [start, end] period.
 * Snapshot values are computed from the ledger, never from the client.
 */
export async function buildPeriodPreview(startValue, endValue, { start, end, client = prisma } = {}) {
  const periodStart = start || parseDate(startValue, 'startDate');
  const periodEnd = end || parseDate(endValue, 'endDate');
  const [allEntries, settings, previousClosing] = await Promise.all([
    fetchLedgerEntries({ client }),
    getAccountSettings(client),
    client.periodClosing.findFirst({
      where: { status: 'ACTIVE', periodEnd: { lt: periodStart } },
      orderBy: { periodEnd: 'desc' },
    }),
  ]);

  const openingBalance = computeBalance(
    allEntries.filter((entry) => entry.date < toISODate(periodStart)),
    settings.openingBalance,
  );
  const periodEntries = allEntries.filter(
    (entry) => entry.date >= toISODate(periodStart) && entry.date <= toISODate(periodEnd),
  );
  const totals = summarize(periodEntries);
  const signedSum = sumAmounts(periodEntries.map((entry) => entry.signedAmount));
  const closingBalance = openingBalance + signedSum;

  return {
    periodStart,
    periodEnd,
    startDate: toISODate(periodStart),
    endDate: toISODate(periodEnd),
    openingBalance,
    previousClosingId: previousClosing?.id || null,
    previousClosingBalance: previousClosing?.closingBalance ?? null,
    totalLent: totals.totalLent,
    totalDelivered: totals.totalDelivered,
    totalReceived: totals.totalReceived,
    totalPaidOut: totals.totalPaidOut,
    netBeforeSettlement: openingBalance + signedSum,
    closingBalance,
    transactionCount: totals.count,
    entries: periodEntries.map(serializeEntry),
  };
}

/** Convert a preview (bigints) into a JSON-safe snapshot stored on a closing. */
export function previewToSnapshot(preview) {
  return {
    openingBalance: money(preview.openingBalance),
    totalLent: money(preview.totalLent),
    totalDelivered: money(preview.totalDelivered),
    totalReceived: money(preview.totalReceived),
    totalPaidOut: money(preview.totalPaidOut),
    netBeforeSettlement: money(preview.netBeforeSettlement),
    closingBalance: money(preview.closingBalance),
    transactionCount: preview.transactionCount,
    generatedAt: new Date().toISOString(),
  };
}
