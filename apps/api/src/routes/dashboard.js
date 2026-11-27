import { Router } from 'express';
import { authRequired } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { fetchLedgerEntries, getAccountSettings, serializeEntry, summarize } from '../ledger.js';
import { money } from '../money.js';
import { toISODate } from '../dates.js';
import { closingJson } from '../serialize.js';
import { validate } from '../schemas.js';
import { z } from 'zod';

export const dashboardRouter = Router();

const periodSchema = z.object({ periodId: z.string().uuid().optional() });

function directionOf(balance) {
  if (balance > 0n) return 'OUDOM_OWES_DAD';
  if (balance < 0n) return 'DAD_OWES_OUDOM';
  return 'SETTLED';
}

dashboardRouter.get('/', authRequired, validate(periodSchema, 'query'), asyncHandler(async (req, res) => {
  const { periodId } = req.valid;
  const [settings, periods] = await Promise.all([
    getAccountSettings(),
    prisma.periodClosing.findMany({ orderBy: { periodEnd: 'desc' }, take: 20 }),
  ]);

  let from;
  let to;
  let snapshotBalance = null;
  if (periodId) {
    const closing = periods.find((item) => item.id === periodId)
      || await prisma.periodClosing.findUnique({ where: { id: periodId } });
    if (!closing) throw notFound();
    from = toISODate(closing.periodStart);
    to = toISODate(closing.periodEnd);
    snapshotBalance = closing.closingBalance;
  }

  const entries = await fetchLedgerEntries({ from, to });
  const totals = summarize(entries);
  const balance = snapshotBalance ?? entries.reduce((sum, e) => sum + e.signedAmount, settings.openingBalance);
  const recent = [...entries].reverse().slice(0, 8);

  ok(res, {
    account: {
      businessName: settings.businessName,
      ownerName: settings.ownerName,
      partnerName: settings.partnerName,
      openingBalance: money(settings.openingBalance),
    },
    period: periodId ? { id: periodId, startDate: from, endDate: to, isHistorical: true } : null,
    balance: money(balance),
    direction: directionOf(balance),
    totals: {
      totalLent: money(totals.totalLent),
      totalProductValue: money(totals.totalDelivered),
      receivedPayments: money(totals.totalReceived),
      outgoingPayments: money(totals.totalPaidOut),
    },
    recentTransactions: recent.map(serializeEntry),
    periods: periods.map(closingJson),
  });
}));
