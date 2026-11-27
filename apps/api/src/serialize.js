import { toBusinessISODate, toISODate } from './dates.js';
import { money } from './money.js';
import { KIND_BY_TYPE, signedAmount } from './ledger.js';

const dateOrNull = (value) => (value ? toISODate(value) : null);

export function deliveryItemJson(item) {
  return {
    id: item.id,
    productId: item.productId ?? null,
    productName: item.productName,
    unit: item.unit ?? null,
    quantity: typeof item.quantity?.toFixed === 'function'
      ? item.quantity.toFixed(3)
      : String(item.quantity),
    unitPrice: money(item.unitPrice),
    lineTotal: money(item.lineTotal),
    sortOrder: item.sortOrder,
    note: item.note ?? null,
  };
}

export function settlementJson(row) {
  if (!row) return null;
  return {
    id: row.id,
    entryId: row.entryId,
    paymentId: row.entryId,
    partnerId: row.partnerId,
    date: row.entry ? toISODate(row.entry.entryDate) : null,
    direction: row.direction,
    amount: money(row.amount),
    method: row.method,
    status: row.status,
    balanceAfter: money(row.balanceAfter),
    periodClosingId: row.periodClosingId ?? null,
    note: row.note ?? null,
    reference: row.reference ?? null,
    voidedAt: row.entry?.voidedAt ? toBusinessISODate(row.entry.voidedAt) : null,
    voidReason: row.entry?.voidReason ?? null,
    createdAt: row.createdAt,
  };
}

export function entryJson(row) {
  const signed = signedAmount(row.type, row.amount);
  return {
    id: row.id,
    partnerId: row.partnerId,
    type: row.type,
    kind: KIND_BY_TYPE[row.type],
    date: toISODate(row.entryDate),
    reference: row.reference ?? null,
    amount: money(row.amount),
    totalAmount: row.type === 'PRODUCT' ? money(row.amount) : undefined,
    signedAmount: money(signed),
    effect: signed > 0n ? 'INCREASE' : 'DECREASE',
    direction: row.type === 'SETTLE_IN'
      ? 'PARTNER_TO_DAD'
      : row.type === 'SETTLE_OUT' ? 'DAD_TO_PARTNER' : row.type,
    note: row.note ?? null,
    voidedAt: row.voidedAt ? toBusinessISODate(row.voidedAt) : null,
    voidReason: row.voidReason ?? null,
    deliveryItems: row.deliveryItems ? row.deliveryItems.map(deliveryItemJson) : undefined,
    settlement: row.settlement ? settlementJson({ ...row.settlement, entry: row }) : null,
    createdAt: row.createdAt,
  };
}

export function closingJson(row) {
  return {
    id: row.id,
    partnerId: row.partnerId,
    startDate: toISODate(row.periodStart),
    endDate: toISODate(row.periodEnd),
    closedAt: row.closedAt,
    status: row.status,
    note: row.note ?? null,
    openingBalance: money(row.openingBalance),
    totalLent: money(row.totalLent),
    totalDelivered: money(row.totalDelivered),
    totalReceived: money(row.totalReceived),
    totalPaidOut: money(row.totalPaidOut),
    settlementAmount: money(row.settlementAmount),
    closingBalance: money(row.closingBalance),
    snapshot: row.snapshot,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function productJson(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit ?? null,
    defaultUnitPrice: row.defaultUnitPrice == null ? null : money(row.defaultUnitPrice),
    note: row.note ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function partnerJson(partner, balance, totals) {
  return {
    id: partner.id,
    name: partner.name,
    openingBalance: money(partner.openingBalance),
    balance: money(balance),
    direction: balance > 0n ? 'PARTNER_OWES_US' : balance < 0n ? 'WE_OWE_PARTNER' : 'SETTLED',
    totals: totals ? {
      totalLent: money(totals.totalLent),
      totalProductValue: money(totals.totalDelivered),
      receivedPayments: money(totals.totalReceived),
      outgoingPayments: money(totals.totalPaidOut),
    } : undefined,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
}

export { dateOrNull };
