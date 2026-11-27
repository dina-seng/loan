import { Router } from 'express';
import { asyncHandler, ok } from '../errors.js';
import { balanceDirection, computeBalance, fetchEntries, serializeEntry } from '../ledger.js';
import { money } from '../money.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({ partnerId: req.partnerId });
  const balance = computeBalance(rows);
  const recent = [...rows].reverse().slice(0, 8);

  ok(res, {
    partner: { id: req.partner.id, name: req.partner.name },
    balance: money(balance),
    direction: balanceDirection(balance),
    recentEntries: recent.map(serializeEntry),
  });
}));
