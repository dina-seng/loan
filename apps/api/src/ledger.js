import { prisma } from './db.js';
import { dateWhere, parseDate, toISODate } from './dates.js';
import { AppError } from './errors.js';
import { money, sumAmounts } from './money.js';

/**
 * The sign each validated ledger record contributes to its partner's mutual
 * balance. Positive means the partner owes Dad more; negative means Dad owes
 * the partner more. This is the ONLY place where financial direction is defined.
 */
export const EFFECT = Object.freeze({
  LENDING: 1n,
  DELIVERY: -1n,
  PARTNER_TO_DAD: -1n,
  DAD_TO_PARTNER: 1n,
});

export const KIND_LABEL = Object.freeze({
  LENDING: 'ការឱ្យខ្ចីប្រាក់',
  DELIVERY: 'ការទទួលទំនិញ',
});

/** Backwards-compatible alias for callers that only need the static labels. */
export const DIRECTION_LABEL = KIND_LABEL;

export function directionLabel(kind, direction, partnerName = 'អ៊ូដុំ') {
  if (kind === 'PAYMENT') {
    return direction === 'PARTNER_TO_DAD'
      ? `${partnerName} → ប៉ា`
      : `ប៉ា → ${partnerName}`;
  }
  return KIND_LABEL[kind] || '';
}

export function balanceDirection(balance) {
  if (balance > 0n) return 'PARTNER_OWES_DAD';
  if (balance < 0n) return 'DAD_OWES_PARTNER';
  return 'SETTLED';
}

/** Pure balance calculation. `entries` must provide exact `signedAmount` bigints. */
export function computeBalance(entries = [], openingBalance = 0n) {
  return entries.reduce((balance, entry) => balance + BigInt(entry.signedAmount), BigInt(openingBalance));
}

/** Pure period totals used by dashboard, statements and closing snapshots. */
export function summarize(entries = []) {
  const totals = { totalLent: 0n, totalDelivered: 0n, totalReceived: 0n, totalPaidOut: 0n, count: 0 };
  for (const entry of entries) {
    if (entry.voidedAt) continue;
    totals.count += 1;
    switch (entry.kind) {
      case 'LENDING': totals.totalLent += BigInt(entry.amount); break;
      case 'DELIVERY': totals.totalDelivered += BigInt(entry.amount); break;
      case 'PAYMENT':
        if (entry.direction === 'PARTNER_TO_DAD') totals.totalReceived += BigInt(entry.amount);
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
    partnerId: entry.partnerId,
    kind: entry.kind,
    date: toISODate(entry.date),
    reference: entry.reference || null,
    description: entry.description || '',
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
    partnerId: entry.partnerId,
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
 * Read validated, non-voided ledger records for one partner (optionally a date range).
 * All balance calculations in the app go through here.
 */
export async function fetchLedgerEntries({ partnerId, partnerName = 'អ៊ូដុំ', from, to, includeVoided = false, client = prisma } = {}) {
  const active = includeVoided ? {} : { voidedAt: null };
  const scope = partnerId ? { partnerId } : {};
  const [lendings, deliveries, payments] = await Promise.all([
    client.lendingTransaction.findMany({ where: { ...scope, ...dateWhere('transactionDate', from, to), ...active } }),
    client.productDelivery.findMany({ where: { ...scope, ...dateWhere('deliveryDate', from, to), ...active } }),
    client.payment.findMany({ where: { ...scope, ...dateWhere('paymentDate', from, to), ...active } }),
  ]);

  const entries = [
    ...lendings.map((row) => normalizeEntry({
      id: row.id, partnerId: row.partnerId, kind: 'LENDING', date: row.transactionDate,
      reference: row.reference,
      description: row.note ? `${directionLabel('LENDING')} · ${row.note}` : directionLabel('LENDING'),
      amount: row.amount, signedAmount: row.amount * EFFECT.LENDING,
      voidedAt: row.voidedAt, createdAt: row.createdAt,
    })),
    ...deliveries.map((row) => normalizeEntry({
      id: row.id, partnerId: row.partnerId, kind: 'DELIVERY', date: row.deliveryDate,
      reference: null, // internal delivery codes are never shown to the user
      description: `${directionLabel('DELIVERY')}${row.note ? ` · ${row.note}` : ''}`,
      amount: row.totalAmount, signedAmount: row.totalAmount * EFFECT.DELIVERY,
      voidedAt: row.voidedAt, createdAt: row.createdAt,
    })),
    ...payments.map((row) => normalizeEntry({
      id: row.id, partnerId: row.partnerId, kind: 'PAYMENT', date: row.paymentDate,
      reference: row.reference,
      description: row.note || directionLabel('PAYMENT', row.direction, partnerName),
      amount: row.amount, direction: row.direction,
      signedAmount: row.amount * EFFECT[row.direction],
      voidedAt: row.voidedAt, createdAt: row.createdAt,
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

export async function getBalance({ partnerId, from, to } = {}, client = prisma) {
  const partner = await client.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('NOT_FOUND', 404);
  const entries = await fetchLedgerEntries({ partnerId, from, to, client });
  return computeBalance(entries, partner.openingBalance);
}

/** Reject writes inside an actively closed period for this partner only. */
export async function assertNotClosed(date, client = prisma, partnerId) {
  const closed = await client.periodClosing.findFirst({
    where: {
      ...(partnerId ? { partnerId } : {}),
      status: 'ACTIVE',
      periodStart: { lte: date },
      periodEnd: { gte: date },
    },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  if (closed) throw new AppError('PERIOD_CLOSED', 409);
  return closed;
}

export async function latestActiveClosing(client = prisma, partnerId) {
  return client.periodClosing.findFirst({
    where: { ...(partnerId ? { partnerId } : {}), status: 'ACTIVE' },
    orderBy: { periodEnd: 'desc' },
  });
}

/** Compute a settlement preview for any custom [start, end] period of one partner. */
export async function buildPeriodPreview(startValue, endValue, {
  start, end, client = prisma, partnerId, partnerName, openingBalance = 0n,
} = {}) {
  const periodStart = start || parseDate(startValue, 'startDate');
  const periodEnd = end || parseDate(endValue, 'endDate');
  const [allEntries, previousClosing] = await Promise.all([
    fetchLedgerEntries({ partnerId, partnerName, client }),
    client.periodClosing.findFirst({
      where: { ...(partnerId ? { partnerId } : {}), status: 'ACTIVE', periodEnd: { lt: periodStart } },
      orderBy: { periodEnd: 'desc' },
    }),
  ]);

  const opening = computeBalance(
    allEntries.filter((entry) => entry.date < toISODate(periodStart)),
    openingBalance,
  );
  const periodEntries = allEntries.filter(
    (entry) => entry.date >= toISODate(periodStart) && entry.date <= toISODate(periodEnd),
  );
  const totals = summarize(periodEntries);
  const signedSum = sumAmounts(periodEntries.map((entry) => entry.signedAmount));

  return {
    partnerId,
    periodStart,
    periodEnd,
    startDate: toISODate(periodStart),
    endDate: toISODate(periodEnd),
    openingBalance: opening,
    previousClosingId: previousClosing?.id || null,
    previousClosingBalance: previousClosing?.closingBalance ?? null,
    totalLent: totals.totalLent,
    totalDelivered: totals.totalDelivered,
    totalReceived: totals.totalReceived,
    totalPaidOut: totals.totalPaidOut,
    netBeforeSettlement: opening + signedSum,
    closingBalance: opening + signedSum,
    transactionCount: totals.count,
    entries: periodEntries.map(serializeEntry),
  };
}

/** Convert a preview (bigints) into a JSON-safe snapshot stored on a closing. */
export function previewToSnapshot(preview) {
  return {
    partnerId: preview.partnerId,
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
