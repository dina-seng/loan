import { Router } from 'express';
import { ownerRequired } from '../auth.js';
import { prisma } from '../db.js';
import { audit, jsonSafe } from '../audit.js';
import { asyncHandler, conflict, notFound, ok } from '../errors.js';
import { assertUuidParam } from '../partner.js';
import {
  buildPeriodPreview,
  lockPartner,
  previewToSnapshot,
} from '../ledger.js';
import { assertRange as validateRange, toISODate } from '../dates.js';
import { closingJson } from '../serialize.js';
import { closingCreateSchema, periodQuerySchema, reopenSchema, validate } from '../schemas.js';

export const periodClosingsRouter = Router();

/** Immutable snapshots of closed periods, newest first. */
periodClosingsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.periodClosing.findMany({
    where: { partnerId: req.partnerId },
    orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
  });
  ok(res, rows.map(closingJson));
}));

/** Read-only preview — never writes, so any authenticated user may use it. */
periodClosingsRouter.get('/preview', validate(periodQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const preview = await buildPeriodPreview(req.valid.startDate, req.valid.endDate, {
    partnerId: req.partnerId,
    openingBalance: BigInt(req.partner.openingBalance),
  });
  const snapshot = previewToSnapshot(preview);
  ok(res, {
    ...snapshot,
    previousClosingId: preview.previousClosingId,
    previousClosingBalance: preview.previousClosingBalance == null
      ? null : String(preview.previousClosingBalance),
    transactionCount: preview.transactionCount,
    warning: preview.entries.length === 0
      ? 'គ្មានប្រតិបត្តិការក្នុងកំឡុងពេលនេះទេ' : null,
  });
}));

periodClosingsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.periodClosing.findFirst({
    where: { id: assertUuidParam(req.params.id), partnerId: req.partnerId },
  });
  if (!row) throw notFound();
  ok(res, closingJson(row));
}));

/** Close a custom date range. Overlapping an ACTIVE closing is rejected. */
periodClosingsRouter.post('/', ownerRequired, validate(closingCreateSchema), asyncHandler(async (req, res) => {
  const { startDate, endDate, note } = req.valid;
  const { startDate: from, endDate: to } = validateRange(startDate, endDate);

  const row = await prisma.$transaction(async (tx) => {
    await lockPartner(tx, req.partnerId);

    const overlapping = await tx.periodClosing.findFirst({
      where: {
        partnerId: req.partnerId,
        status: 'ACTIVE',
        periodStart: { lte: to },
        periodEnd: { gte: from },
      },
      orderBy: { periodEnd: 'desc' },
    });
    if (overlapping) {
      const lastClosedDate = toISODate(overlapping.periodEnd);
      const earliestAllowedDate = toISODate(new Date(overlapping.periodEnd.getTime() + 86_400_000));
      throw conflict(
        'PERIOD_OVERLAP',
        {
          closingId: overlapping.id,
          lastClosedDate,
          earliestAllowedDate,
        },
        `កំឡុងពេលនេះត្រួតគ្នានឹងកំឡុងពេលដែលបានបិទរួច។ ថ្ងៃបិទចុងក្រោយ ${lastClosedDate}។ ថ្ងៃដំបូងដែលអាចបិទបាន ${earliestAllowedDate}។`,
      );
    }

    const preview = await buildPeriodPreview(from, to, {
      client: tx,
      partnerId: req.partnerId,
      openingBalance: BigInt(req.partner.openingBalance),
    });
    const snapshot = previewToSnapshot(preview);
    const closingKey = `${snapshot.startDate}_${snapshot.endDate}`;

    const created = await tx.periodClosing.create({
      data: {
        partnerId: req.partnerId,
        closingKey,
        periodStart: from,
        periodEnd: to,
        closedById: req.user.id,
        openingBalance: preview.openingBalance,
        totalLent: preview.totalLent,
        totalDelivered: preview.totalDelivered,
        totalReceived: preview.totalReceived,
        totalPaidOut: preview.totalPaidOut,
        settlementAmount: preview.settlementAmount,
        closingBalance: preview.closingBalance,
        note: note ?? null,
        snapshot,
      },
    });

    // Attach the settlements recorded inside the closed range to this snapshot.
    await tx.settlement.updateMany({
      where: {
        partnerId: req.partnerId,
        periodClosingId: null,
        entry: {
          voidedAt: null,
          entryDate: { gte: from, lte: to },
        },
      },
      data: { periodClosingId: created.id },
    });

    await audit(req.user.id, 'PERIOD_CLOSE', 'PeriodClosing', created.id, {
      after: jsonSafe(closingJson(created)),
      metadata: { closingKey },
      partnerId: req.partnerId,
    }, tx);
    return created;
  });

  ok(res, closingJson(row), undefined, 201);
}));

/** Reopen only the latest ACTIVE closing; audit who did it and why. */
periodClosingsRouter.post('/:id/reopen', ownerRequired, validate(reopenSchema), asyncHandler(async (req, res) => {
  const id = assertUuidParam(req.params.id);
  const row = await prisma.$transaction(async (tx) => {
    await lockPartner(tx, req.partnerId);
    const closing = await tx.periodClosing.findFirst({ where: { id, partnerId: req.partnerId } });
    if (!closing || closing.status !== 'ACTIVE') throw notFound();

    const latest = await tx.periodClosing.findFirst({
      where: { partnerId: req.partnerId, status: 'ACTIVE' },
      orderBy: { periodEnd: 'desc' },
      select: { id: true, periodEnd: true },
    });
    if (latest && latest.id !== closing.id) {
      const lastClosedDate = toISODate(latest.periodEnd);
      const earliestAllowedDate = toISODate(new Date(latest.periodEnd.getTime() + 86_400_000));
      throw conflict(
        'PERIOD_HAS_LATER_CLOSING',
        { closingId: latest.id, lastClosedDate, earliestAllowedDate },
        `សូមបើកកំឡុងពេលក្រោយជាមុនសិន។ ថ្ងៃបិទចុងក្រោយ ${lastClosedDate}។`,
      );
    }

    const reopened = await tx.periodClosing.update({
      where: { id },
      data: { status: 'REOPENED' },
    });
    await tx.settlement.updateMany({
      where: { periodClosingId: id },
      data: { periodClosingId: null },
    });
    await audit(req.user.id, 'PERIOD_REOPEN', 'PeriodClosing', id, {
      before: jsonSafe(closingJson(closing)),
      after: jsonSafe(closingJson(reopened)),
      metadata: { reason: req.valid.reason },
      partnerId: req.partnerId,
    }, tx);
    return reopened;
  });
  ok(res, closingJson(row));
}));
