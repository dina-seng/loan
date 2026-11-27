import { toISODate } from './dates.js';
import { money } from './money.js';

const dateOrNull = (value) => (value ? toISODate(value) : null);

export function lendingJson(row) {
  return {
    id: row.id,
    reference: row.reference,
    date: toISODate(row.transactionDate),
    amount: money(row.amount),
    note: row.note,
    voidedAt: dateOrNull(row.voidedAt),
    voidReason: row.voidReason,
    createdAt: row.createdAt,
  };
}

export function productJson(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    description: row.description,
    unitPrice: money(row.unitPrice),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function deliveryJson(row) {
  return {
    id: row.id,
    reference: row.reference,
    date: toISODate(row.deliveryDate),
    totalAmount: money(row.totalAmount),
    note: row.note,
    voidedAt: dateOrNull(row.voidedAt),
    voidReason: row.voidReason,
    items: row.items?.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
      sortOrder: item.sortOrder,
    })) || [],
    createdAt: row.createdAt,
  };
}

export function paymentJson(row) {
  return {
    id: row.id,
    reference: row.reference,
    date: toISODate(row.paymentDate),
    direction: row.direction,
    amount: money(row.amount),
    method: row.method,
    note: row.note,
    settlementId: row.settlementId,
    voidedAt: dateOrNull(row.voidedAt),
    voidReason: row.voidReason,
    createdAt: row.createdAt,
  };
}

export function settlementJson(row) {
  return {
    id: row.id,
    reference: row.reference,
    amount: money(row.amount),
    direction: row.direction,
    method: row.method,
    note: row.note,
    status: row.status,
    balanceAfter: money(row.balanceAfter),
    periodClosingId: row.periodClosingId,
    paymentId: row.payments?.[0]?.id || null,
    createdAt: row.createdAt,
  };
}

export function closingJson(row) {
  return {
    id: row.id,
    startDate: toISODate(row.periodStart),
    endDate: toISODate(row.periodEnd),
    closedAt: row.closedAt,
    status: row.status,
    note: row.note,
    openingBalance: money(row.openingBalance),
    totalLent: money(row.totalLent),
    totalDelivered: money(row.totalDelivered),
    totalReceived: money(row.totalReceived),
    totalPaidOut: money(row.totalPaidOut),
    settlementAmount: money(row.settlementAmount),
    closingBalance: money(row.closingBalance),
    snapshot: row.snapshot,
  };
}
