import { Router } from 'express';
import { asyncHandler, ok } from '../errors.js';
import { buildPeriodPreview, fetchEntries, summarize } from '../ledger.js';
import { toISODate } from '../dates.js';
import { money } from '../money.js';
import { periodFilterSchema, periodQuerySchema, validate } from '../schemas.js';

export const reportsRouter = Router();

function csvCell(value) {
  let str = String(value ?? '');
  // Neutralize spreadsheet formula injection in user-entered notes/names.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Backup export: every entry for the selected partner, including voided rows. */
reportsRouter.get('/transactions.csv', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({
    partnerId: req.partnerId,
    includeVoided: true,
    withDetails: true,
  });
  const header = [
    'Date', 'Type', 'Amount(KHR)', 'Note', 'Reference', 'Voided',
    'Product', 'Quantity', 'UnitPrice', 'LineTotal', 'PaymentDirection', 'Status', 'BalanceAfter',
  ].map(csvCell).join(',');
  const lines = rows.map((row) => {
    const item = row.deliveryItems?.[0];
    const settlement = row.settlement;
    return [
      toISODate(row.entryDate), row.type, row.amount.toString(), row.note || '', row.reference || '',
      row.voidedAt ? toBusinessDate(row.voidedAt) : '',
      item?.productName || '', item?.quantity?.toString?.() || '', item?.unitPrice?.toString?.() || '',
      item?.lineTotal?.toString?.() || '', settlement?.direction || '', settlement?.status || '',
      settlement?.balanceAfter?.toString?.() || '',
    ].map(csvCell).join(',');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ledger-${req.partnerId.slice(0, 8)}-${toISODate(new Date())}.csv"`);
  res.send(`\uFEFF${[header, ...lines].join('\r\n')}`);
}));

function toBusinessDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

/** Arbitrary-period totals, identical to the dashboard and closing preview. */
reportsRouter.get('/summary', validate(periodFilterSchema, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = req.valid;
  const rows = await fetchEntries({ partnerId: req.partnerId, from, to });
  const totals = summarize(rows);
  ok(res, {
    partnerId: req.partnerId,
    period: { from: from || null, to: to || null },
    openingBalance: money(req.partner.openingBalance),
    totalLent: money(totals.totalLent),
    totalProductValue: money(totals.totalDelivered),
    receivedPayments: money(totals.totalReceived),
    outgoingPayments: money(totals.totalPaidOut),
    transactionCount: totals.count,
  });
}));

/** Running-balance statement with the opening balance carried into the period. */
reportsRouter.get('/statement', validate(periodFilterSchema, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = req.valid;
  const preview = await buildPeriodPreview(from || '0001-01-01', to || '9999-12-31', {
    partnerId: req.partnerId,
    openingBalance: BigInt(req.partner.openingBalance),
  });
  let running = preview.openingBalance;
  const lines = preview.entries.map((entry) => {
    const signed = ({
      LEND: entry.amount, SETTLE_OUT: entry.amount,
      PRODUCT: -entry.amount, SETTLE_IN: -entry.amount,
    })[entry.type];
    running += signed;
    return {
      id: entry.id,
      date: toISODate(entry.entryDate),
      type: entry.type,
      reference: entry.reference ?? null,
      note: entry.note ?? null,
      amount: money(entry.amount),
      signedAmount: money(signed),
      balanceAfter: money(running),
      voidedAt: entry.voidedAt ? toBusinessDate(entry.voidedAt) : null,
    };
  });
  ok(res, {
    partnerId: req.partnerId,
    period: { from: preview.startDate, to: preview.endDate },
    openingBalance: money(preview.openingBalance),
    closingBalance: money(running),
    lines,
  });
}));

/** Preview a proposed closing period without writing anything. */
reportsRouter.get('/closing-preview', validate(periodQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const preview = await buildPeriodPreview(req.valid.startDate, req.valid.endDate, {
    partnerId: req.partnerId,
    openingBalance: BigInt(req.partner.openingBalance),
  });
  ok(res, {
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
    previousClosingId: preview.previousClosingId,
    previousClosingBalance: preview.previousClosingBalance == null
      ? null : money(preview.previousClosingBalance),
  });
}));
