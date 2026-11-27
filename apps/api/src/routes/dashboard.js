import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ok } from '../errors.js';
import {
  balanceDirection,
  computeBalance,
  fetchEntries,
  getPartnerSummary,
  summarize,
} from '../ledger.js';
import { money } from '../money.js';
import { getFirstOpenDate, latestActiveClosing } from '../ledger.js';
import { entryJson } from '../serialize.js';
import { periodFilterSchema, validate } from '../schemas.js';

export const dashboardRouter = Router();

/**
 * One request gives the headline balance, the four period totals and the
 * recent activity. `?from=&to=` selects any custom reporting period; without
 * it the totals cover all recorded activity for the partner.
 */
dashboardRouter.get('/', validate(periodFilterSchema, 'query'), asyncHandler(async (req, res) => {
  const { from, to } = req.valid;
  const [all, periodEntries, summary, firstOpenDate, latestClosing] = await Promise.all([
    fetchEntries({ partnerId: req.partnerId }),
    fetchEntries({ partnerId: req.partnerId, from, to }),
    getPartnerSummary(req.partnerId, { from, to }),
    getFirstOpenDate(req.partnerId),
    latestActiveClosing(prisma, req.partnerId),
  ]);
  const balance = computeBalance(all, BigInt(req.partner.openingBalance));
  const totals = summarize(periodEntries);
  const recent = await (async () => {
    const rows = await fetchEntries({ partnerId: req.partnerId, withDetails: true });
    return [...rows].reverse().slice(0, 8).map(entryJson);
  })();

  ok(res, {
    partner: {
      id: req.partner.id,
      name: req.partner.name,
      openingBalance: money(req.partner.openingBalance),
    },
    period: { from: from || null, to: to || null },
    balance: money(balance),
    direction: balanceDirection(balance),
    totals: {
      totalLent: money(totals.totalLent),
      totalProductValue: money(totals.totalDelivered),
      receivedPayments: money(totals.totalReceived),
      outgoingPayments: money(totals.totalPaidOut),
      transactionCount: totals.count,
    },
    netFlow: money(summary.balance - BigInt(req.partner.openingBalance)),
    // The browser uses this as the default entry date and warns about it.
    firstOpenDate,
    closedPeriod: latestClosing ? {
      startDate: latestClosing.periodStart.toISOString().slice(0, 10),
      endDate: latestClosing.periodEnd.toISOString().slice(0, 10),
    } : null,
    recentEntries: recent,
  });
}));
