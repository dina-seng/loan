import { Router } from 'express';
import { authRequired, requireOwner } from '../auth.js';
import { prisma } from '../db.js';
import { AppError, asyncHandler, notFound, ok } from '../errors.js';
import { addDays, assertRange, toISODate } from '../dates.js';
import { buildPeriodPreview, fetchLedgerEntries, getAccountSettings, previewToSnapshot, serializeEntry } from '../ledger.js';
import { money } from '../money.js';
import { closingJson } from '../serialize.js';
import { closingCreateSchema, periodQuerySchema, reopenSchema, validate } from '../schemas.js';
import { idempotent } from '../idempotency.js';
import { audit, jsonSafe } from '../audit.js';

export const periodClosingsRouter = Router();
periodClosingsRouter.use(authRequired);

periodClosingsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.periodClosing.findMany({ orderBy: { periodEnd: 'desc' } });
  ok(res, rows.map(closingJson));
}));

periodClosingsRouter.get('/preview', validate(periodQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.valid;
  assertRange(startDate, endDate);
  const preview = await buildPeriodPreview(startDate, endDate);
  const last = await prisma.periodClosing.findFirst({ where: { status: 'ACTIVE' }, orderBy: { periodEnd: 'desc' } });
  const contiguous = !last || toISODate(addDays(last.periodEnd, 1)) === preview.startDate;
  ok(res, {
    ...serializePreview(preview),
    canClose: contiguous,
    blockingClosing: contiguous ? null : closingJson(last),
    expectedNextStart: last ? toISODate(addDays(last.periodEnd, 1)) : null,
  });
}));

periodClosingsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.periodClosing.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound();
  const entries = await fetchLedgerEntries({ from: toISODate(row.periodStart), to: toISODate(row.periodEnd) });
  ok(res, { ...closingJson(row), entries: entries.map(serializeEntry) });
}));

/** Printable statement data. The stored snapshot is authoritative for history. */
periodClosingsRouter.get('/:id/statement', asyncHandler(async (req, res) => {
  const row = await prisma.periodClosing.findUnique({
    where: { id: req.params.id },
    include: { settlements: true },
  });
  if (!row) throw notFound();
  const [settings, entries] = await Promise.all([
    getAccountSettings(),
    fetchLedgerEntries({ from: toISODate(row.periodStart), to: toISODate(row.periodEnd) }),
  ]);
  ok(res, {
    businessName: settings.businessName,
    ownerName: settings.ownerName,
    partnerName: settings.partnerName,
    closing: closingJson(row),
    entries: entries.map(serializeEntry),
    settlements: row.settlements.map((s) => ({
      id: s.id, amount: money(s.amount), direction: s.direction, status: s.status, note: s.note,
    })),
  });
}));

periodClosingsRouter.post('/', requireOwner, validate(closingCreateSchema), idempotent('period-closing'), asyncHandler(async (req, res) => {
  const { startDate, endDate, note } = req.valid;
  assertRange(startDate, endDate);

  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.periodClosing.findFirst({
      where: { status: 'ACTIVE' }, orderBy: { periodEnd: 'desc' },
    });
    if (last && toISODate(addDays(last.periodEnd, 1)) !== startDate) {
      throw new AppError('PERIOD_OVERLAP', 409, {
        expectedStartDate: toISODate(addDays(last.periodEnd, 1)),
        previousClosingEnd: toISODate(last.periodEnd),
      });
    }
    const overlapping = await tx.periodClosing.findFirst({
      where: {
        status: 'ACTIVE',
        periodStart: { lte: parse(endDate) },
        periodEnd: { gte: parse(startDate) },
      },
    });
    if (overlapping) throw new AppError('PERIOD_OVERLAP', 409);

    const preview = await buildPeriodPreview(startDate, endDate, { client: tx });
    const snapshot = previewToSnapshot(preview);
    const created = await tx.periodClosing.create({
      data: {
        closingKey: `${preview.startDate}_${preview.endDate}`,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        closedById: req.user.id,
        status: 'ACTIVE',
        note: note || null,
        openingBalance: preview.openingBalance,
        totalLent: preview.totalLent,
        totalDelivered: preview.totalDelivered,
        totalReceived: preview.totalReceived,
        totalPaidOut: preview.totalPaidOut,
        closingBalance: preview.closingBalance,
        snapshot,
      },
    });
    await audit(req.user.id, 'PERIOD_CLOSE', 'PeriodClosing', created.id, {
      after: jsonSafe(closingJson(created)),
      metadata: { periodStart: preview.startDate, periodEnd: preview.endDate },
    }, tx);
    return created;
  });

  ok(res, closingJson(row), undefined, 201);
}));

periodClosingsRouter.post('/:id/reopen', requireOwner, validate(reopenSchema), idempotent('period-reopen'), asyncHandler(async (req, res) => {
  const before = await prisma.periodClosing.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  if (before.status === 'REOPENED') throw new AppError('CONFLICT', 409, undefined, 'ខួបនេះត្រូវបានបើកឡើងវិញរួចហើយ');

  const updated = await prisma.$transaction(async (tx) => {
    const later = await tx.periodClosing.findFirst({
      where: { status: 'ACTIVE', periodStart: { gt: before.periodStart } },
      orderBy: { periodStart: 'asc' },
    });
    if (later) throw new AppError('PERIOD_HAS_LATER_CLOSING', 409);
    const changed = await tx.periodClosing.update({
      where: { id: before.id },
      data: { status: 'REOPENED', closingKey: null, note: req.valid.reason },
    });
    await audit(req.user.id, 'PERIOD_REOPEN', 'PeriodClosing', before.id, {
      before: jsonSafe(closingJson(before)), after: jsonSafe(closingJson(changed)), metadata: { reason: req.valid.reason },
    }, tx);
    return changed;
  });

  ok(res, closingJson(updated));
}));

function parse(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function serializePreview(preview) {
  return {
    startDate: preview.startDate,
    endDate: preview.endDate,
    openingBalance: money(preview.openingBalance),
    previousClosingBalance: preview.previousClosingBalance === null ? null : money(preview.previousClosingBalance),
    previousClosingId: preview.previousClosingId,
    totalLent: money(preview.totalLent),
    totalDelivered: money(preview.totalDelivered),
    totalReceived: money(preview.totalReceived),
    totalPaidOut: money(preview.totalPaidOut),
    netBeforeSettlement: money(preview.netBeforeSettlement),
    closingBalance: money(preview.closingBalance),
    transactionCount: preview.transactionCount,
    entries: preview.entries,
  };
}
