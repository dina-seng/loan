# Migration plan — Google Sheets → Business Ledger

The legacy app (React + Google Apps Script + Google Sheets) was audited, then removed from the working tree once the new app was verified. Its files remain recoverable from git history. The new app is in `apps/api` and `apps/web`.

## What was inspected

- Legacy `apps-script/Code.gs`: `list`, `add`, `delete`, `list_products`, `add_product`, `delete_product`, `list_settlements`, `settle_month`, `reopen_month`, `rename_borrower`. Shared credential in Script Properties; `LockService` per write; client-generated UUIDs as duplicate keys.
- `src/App.jsx`, `src/components/*`: one scrollable page, optimistic UI, credentials in `localStorage`, no router.
- `src/utils.js`, `lib/math.ts`, `lib/validation.ts`, `lib/dates.ts`: `Balance = Lend − Repay − Goods + Refund`, Khmer digit parsing, Cambodia timezone helpers, fuzzy borrower matching.
- `__tests__/**`, `e2e/**`: ~100 pure-logic assertions; no API integration runner; Playwright specs not executable.

## Problems identified and fixed in the new app

| Legacy problem | New implementation |
|---|---|
| Client sent settlement totals; server trusted them | Server recomputes all totals from the ledger; frontend only sends dates/amounts/notes |
| Partial settlements lost residual balance (carry-over hardcoded to 0) | Settlement payment is a ledger entry; remaining balance carries forward automatically |
| Monthly-only settlement | Custom `[startDate, endDate]` previews and closings; contiguous periods enforced |
| Credentials in plaintext `localStorage`, static shared password | HTTP-only cookie sessions, scrypt hashes, rate-limited login, per-user accounts |
| Idempotency broken by regenerating UUID on retry | `Idempotency-Key` header persisted in `IdempotencyKey` table with per-user/route scope |
| No audit trail | Append-only `AuditLog` for creates, voids, settlements, closes and reopens |
| Historical months changed silently | Closed periods reject writes; snapshots are immutable; reopening requires a reason |
| No DB transactions or constraints | Prisma migrations, `BIGINT`, FKs, unique references, `$transaction` for multi-record writes |
| Two divergent math implementations | One `apps/api/src/ledger.js` used by dashboard, reports, previews and closings |
| No real API integration tests | Vitest + Supertest covering all 14 required financial scenarios |
| Float rounding risk | Bigint arithmetic end to end; JSON money is stringified |

## Reused work

- `src/components/Icons.jsx` → `apps/web/src/components/Icons.jsx` (dependency-free SVG icons).
- Khmer labels from `src/utils.js` (`getSettlementStatus`) and API error map from `src/api.js` → `apps/web/src/i18n/labels.js`, expressed as user-facing business language.
- Khmer digit normalization from `lib/validation.ts` / `src/utils.js` → `apps/web/src/utils/money.js` (display/entry helpers only).
- Cambodia timezone requirement (`Asia/Phnom_Penh`) → `apps/api/src/config.js` + `dates.js`.

## Migration sequence

1. Deploy schema with Prisma migrations; seed only the owner account and product catalog.
2. Enter currently outstanding opening balance via `AccountSettings.openingBalance` (default 0).
3. Re-enter active (unsettled) transactions through the new API using their original dates. Closed legacy months are represented by period-closing snapshots, not by re-entering transactions.
4. Verify the dashboard equals the expected outstanding amount before daily use.
5. Keep the legacy sheets as read-only backups; do not continue writing to them.
