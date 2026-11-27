import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ok } from '../errors.js';
import { balanceDirection, fetchLedgerEntries, summarize } from '../ledger.js';
import { money } from '../money.js';
import { toISODate } from '../dates.js';
import { closingJson } from '../serialize.js';
import { validate } from '../schemas.js';
import { z } from 'zod';

export const reportsRouter = Router();

const rangeSchema = z.object({ from: z.string().optional(), to: z.string().optional() });

reportsRouter.get('/summary', validate(rangeSchema, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = req.valid;
  const entries = await fetchLedgerEntries({
    partnerId: req.partnerId, partnerName: req.partner.name, from, to,
  });
  const totals = summarize(entries);
  const balance = entries.reduce((sum, entry) => sum + entry.signedAmount, req.partner.openingBalance);
  ok(res, {
    partnerId: req.partnerId,
    partnerName: req.partner.name,
    from: from || null,
    to: to || null,
    balance: money(balance),
    direction: balanceDirection(balance),
    totals: {
      totalLent: money(totals.totalLent),
      totalProductValue: money(totals.totalDelivered),
      receivedPayments: money(totals.totalReceived),
      outgoingPayments: money(totals.totalPaidOut),
    },
    transactionCount: totals.count,
  });
}));

reportsRouter.get('/statements', asyncHandler(async (req, res) => {
  const rows = await prisma.periodClosing.findMany({
    where: { partnerId: req.partnerId }, orderBy: { periodEnd: 'desc' },
  });
  ok(res, rows.map(closingJson));
}));

reportsRouter.get('/statement/:id', asyncHandler(async (req, res) => {
  const row = await prisma.periodClosing.findFirst({
    where: { id: req.params.id, partnerId: req.partnerId }, include: { settlements: true },
  });
  if (!row) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'រកមិនឃើញរបាយការណ៍នេះទេ' } });
  ok(res, {
    closing: closingJson(row),
    snapshot: row.snapshot,
    partnerName: req.partner.name,
    settlements: row.settlements.map((s) => ({ id: s.id, amount: money(s.amount), status: s.status })),
  });
}));

/** CSV export with spreadsheet-formula escaping, scoped to the selected partner. */
reportsRouter.get('/transactions.csv', asyncHandler(async (req, res) => {
  const entries = await fetchLedgerEntries({
    partnerId: req.partnerId,
    partnerName: req.partner.name,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  });
  const escape = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };
  const header = ['Date', 'Type', 'Reference', 'Description', 'Direction', 'Amount(KHR)'].map(escape).join(',');
  const lines = entries.map((entry) => [
    entry.date, entry.kind, entry.reference || '', entry.description, entry.direction, entry.amount.toString(),
  ].map(escape).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ledger-${req.partnerId.slice(0, 8)}-${toISODate(new Date())}.csv"`);
  res.send(`\uFEFF${[header, ...lines].join('\r\n')}`);
}));
