import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound, ok } from '../errors.js';
import { balanceDirection, fetchLedgerEntries, serializeEntry, summarize } from '../ledger.js';
import { money } from '../money.js';
import { toISODate } from '../dates.js';
import { closingJson } from '../serialize.js';
import { validate } from '../schemas.js';
import { z } from 'zod';

export const dashboardRouter = Router();

const periodSchema = z.object({ periodId: z.string().uuid().optional() });

dashboardRouter.get('/', validate(periodSchema, 'query'), asyncHandler(async (req, res) => {
  const { periodId } = req.valid;
  const { partnerId, partner } = req;
  const periods = await prisma.periodClosing.findMany({
    where: { partnerId }, orderBy: { periodEnd: 'desc' }, take: 20,
  });

  let from;
  let to;
  let snapshotBalance = null;
  if (periodId) {
    const closing = periods.find((item) => item.id === periodId)
      || await prisma.periodClosing.findFirst({ where: { id: periodId, partnerId } });
    if (!closing) throw notFound();
    from = toISODate(closing.periodStart);
    to = toISODate(closing.periodEnd);
    snapshotBalance = closing.closingBalance;
  }

  const entries = await fetchLedgerEntries({ partnerId, partnerName: partner.name, from, to });
  const totals = summarize(entries);
  const balance = snapshotBalance ?? entries.reduce((sum, entry) => sum + entry.signedAmount, partner.openingBalance);
  const recent = [...entries].reverse().slice(0, 8);

  ok(res, {
    account: {
      businessName: 'Business Ledger',
      ownerName: 'ប៉ា',
      partnerName: partner.name,
      openingBalance: money(partner.openingBalance),
    },
    partner: { id: partner.id, name: partner.name },
    period: periodId ? { id: periodId, startDate: from, endDate: to, isHistorical: true } : null,
    balance: money(balance),
    direction: balanceDirection(balance),
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
