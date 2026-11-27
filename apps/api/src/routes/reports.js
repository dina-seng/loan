import { Router } from 'express';
import { asyncHandler } from '../errors.js';
import { fetchEntries } from '../ledger.js';
import { toISODate } from '../dates.js';

export const reportsRouter = Router();

/** Backup export: every entry for the selected partner, including voided rows. */
reportsRouter.get('/transactions.csv', asyncHandler(async (req, res) => {
  const rows = await fetchEntries({ partnerId: req.partnerId, includeVoided: true });
  const escape = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };
  const header = ['Date', 'Type', 'Amount(KHR)', 'Note', 'Voided'].map(escape).join(',');
  const lines = rows.map((row) => [
    toISODate(row.entryDate), row.type, row.amount.toString(), row.note || '',
    row.voidedAt ? toISODate(row.voidedAt) : '',
  ].map(escape).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ledger-${req.partnerId.slice(0, 8)}-${toISODate(new Date())}.csv"`);
  res.send(`\uFEFF${[header, ...lines].join('\r\n')}`);
}));
