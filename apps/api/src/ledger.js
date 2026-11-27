import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { toISODate } from './dates.js';
import { AppError, conflict } from './errors.js';
import { money } from './money.js';

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

/** Exact signed value of one entry. */
export function signedAmount(type, amount) {
  return BigInt(amount) * TYPE_EFFECT[type];
}

/**
 * THE balance function. Every balance in the app (dashboard, partner list,
 * history and settle) is produced here and nowhere else.
 */
export function computeBalance(entries = []) {
  return entries.reduce((total, entry) => total + signedAmount(entry.type, entry.amount), 0n);
}

export function balanceDirection(balance) {
  if (balance > 0n) return 'PARTNER_OWES_US';
  if (balance < 0n) return 'WE_OWE_PARTNER';
  return 'SETTLED';
}

export function serializeEntry(row) {
  return {
    id: row.id,
    partnerId: row.partnerId,
    type: row.type,
    date: toISODate(row.entryDate),
    amount: money(row.amount),
    signedAmount: money(signedAmount(row.type, row.amount)),
    note: row.note,
    voidedAt: row.voidedAt ? toISODate(row.voidedAt) : null,
    createdAt: row.createdAt,
  };
}

/** Non-voided entries for one partner, oldest first. */
export async function fetchEntries({ partnerId, includeVoided = false, client = prisma } = {}) {
  return client.entry.findMany({
    where: { ...(partnerId ? { partnerId } : {}), ...(includeVoided ? {} : { voidedAt: null }) },
    orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
  });
}

/** The one balance lookup used by the dashboard, partner list and settle. */
export async function getPartnerBalance(partnerId, client = prisma) {
  const partner = await client.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('NOT_FOUND', 404);
  return computeBalance(await fetchEntries({ partnerId, client }));
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
    const balance = computeBalance(grouped.get(partner.id) || []);
    return {
      id: partner.id,
      name: partner.name,
      balance: money(balance),
      direction: balanceDirection(balance),
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
    };
  });
}

/**
 * Insert an entry whose id came from the browser. A repeated id means the
 * request was already handled, so the existing row is returned instead of
 * writing a second row (or failing the save).
 */
export async function createOrReuse(data, client = prisma) {
  try {
    return { row: await client.entry.create({ data }), created: true };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const existing = await client.entry.findUnique({ where: { id: data.id } });
    if (!existing || existing.partnerId !== data.partnerId) throw conflict('CONFLICT');
    return { row: existing, created: false };
  }
}

/**
 * Clear a partner's balance with ONE entry for its full amount.
 * Nothing is locked afterwards; a later entry on the same day is accepted.
 */
export async function settlePartner({ partnerId, id, date, note, userId }) {
  return prisma.$transaction(async (tx) => {
    const balance = await getPartnerBalance(partnerId, tx);
    if (balance === 0n) throw new AppError('NOTHING_TO_SETTLE', 409);
    const type = balance > 0n ? 'SETTLE_IN' : 'SETTLE_OUT';
    return createOrReuse({
      id,
      partnerId,
      type,
      entryDate: date,
      amount: balance < 0n ? -balance : balance,
      note: note ?? null,
      createdById: userId,
    }, tx);
  });
}
