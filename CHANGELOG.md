# Changelog

## 4.0.0 — spec v4 backend (in progress)

The unified `Entry` ledger is kept. Removed features are restored as additive satellite tables
through the forward-only `20261128000000_spec_v4_rich_ledger` migration; nothing is dropped.

### Added

- `Partner.openingBalance`, carried into every balance, preview and statement.
- `Product` catalog, multi-line `DeliveryItem` with server-computed totals, `Settlement` detail,
  `PeriodClosing` snapshots and an append-only `AuditLog`.
- Partial and full settlements through `/payments` and `/settlements` (one detail table).
- Custom-period `/reports/summary`, `/reports/statement`, `/reports/closing-preview`,
  `/period-closings/preview`; closing/reopening are `OWNER`-only and audited.
- Unified `/transactions`, plus `/lending`, `/deliveries`, `/products` and `/audit` routes.
- Transaction-scoped partner locking so concurrent payments cannot reuse a stale balance.
- `X-Robots-Tag: noindex, nofollow` on every response and `/robots.txt` on API and web.
- `MIGRATION_RUNBOOK.md`, enhanced README, and a production guard on the seed script.

### Frontend

- Dashboard shows the four period totals from `/dashboard`, a date-range selector and a closed-period warning.
- Multi-line delivery, partial/full settlement and product-catalog screens.
- History uses `/transactions` with server-computed monthly subtotals; no money is added in the browser.
- Period closing/reopening (owner only), statements and audit trail screens; three-item mobile nav.
- Authenticated CSV download and a void dialog that records the reason.

### Integration tests

- Added a 13-scenario spec-v4 suite alongside the original 14-test ledger suite.
- Covered multi-item delivery, previews/closing, per-partner isolation, closed-period 409 details,
  carry-forward, partial settlement, idempotency, concurrency, reopening, audit and CSV export.
- Applied the forward migration to the migrated `business_ledger_test` database only.

### Fixed

- `getFirstOpenDate()` had reversed parameters and broke every dashboard request.
- Delivery quantities are serialized with three decimal places instead of losing trailing zeroes.
- `/payments/:id` and `/settlements/:id` accept either the entry id or the returned settlement id.
- Partner switcher “add” used a string sentinel as a partner object, so the add form never opened.
- Modals rendered in the sticky header were covered by the bottom nav on mobile; the header now sits above it.
- Delivery input no longer asks for a free-text product name or reference number; products are selected from the catalog.
- Added a quick-add product panel inside each delivery line so a new catalog item can be created without leaving the form.
- Dashboard now shows only lend/product totals; payment-in/payment-out cards were removed to avoid confusing users.
- The v4 migration tolerates the `Partner_name_lower_key` index left by an older migration.
- Khmer numerals (`០-៩`) are parsed before money/quantity validation.
- `includeVoided=false` query strings no longer become truthy.
- Voiding records `voidedById` and `voidReason`; malformed UUID path ids return 404.
- Closed-period 409 responses name the last closed date and earliest allowed date.

## 3.0.0 — simplified ledger

The app now does one thing: track what a partner owes us or what we owe them. Everything
below was deleted from the code, the API, the database and the UI.

### Added

- One `Entry` table with four types: `LEND`, `PRODUCT`, `SETTLE_IN`, `SETTLE_OUT`.
- One settle action (`POST /partners/:id/settle`) that adds a single entry for the whole balance.
- One balance function (`computeBalance` in `apps/api/src/ledger.js`) used by the dashboard,
  the partner list, the history and settle.
- One history screen: newest first, grouped by month, with a lend/product subtotal and a type filter.
- `apps/web/src/strings.km.js` as the only file containing user-facing Khmer text, plus `WORDING.md`.
- Browser-generated entry ids, so a retried save returns the existing row instead of a duplicate.

### Removed

| Removed | Reason |
|---|---|
| Period closing (`PeriodClosing` table, `/period-closings` routes, closing UI, 409 write block, snapshots) | Entries must always be accepted, including on the same day as a settlement. |
| `AuditLog` table and `audit.js` | Not needed for a two-person ledger. |
| `IdempotencyKey` table, `idempotency.js` and the `Idempotency-Key` header | Replaced by the browser-generated entry id. |
| `AccountSettings` (business name, owner name, opening balance, opening date) | The app has no settings screen; the balance starts from the ledger. |
| `UserRole` enum and `User.role` | One owner login; no role gate is applied. |
| `Partner.phone`, `Partner.note`, `Partner.isActive` and the inactive toggle | A partner is a name. |
| `Partner.openingBalance` and the account opening balance | Balances are computed only from entries. |
| `LendingTransaction`, `ProductDelivery`, `Payment`, `Settlement` tables | Replaced by `Entry`. |
| `DeliveryItem` (quantity, unit price, line total) and `productName` | A delivery is one amount: the value of the goods. |
| `reference` on entries and the generated delivery code | Not user-visible and never used. |
| Payment methods (`method`, cash/bank/other) | Not recorded anymore. |
| Statements and `/reports/summary`, `/reports/statements`, `/report/statement/:id` | No period closing, so no statements. |
| Separate `/lending`, `/deliveries`, `/payments`, `/settlements`, `/transactions` routes | Replaced by `/entries` and `/partners/:id/settle`. |
| Separate Transactions, Settlement and History screens | One history screen. |
| Partial settlements | Settle clears the whole balance with one entry. |
| `PARTNER_OWES_DAD` / `DAD_OWES_PARTNER` direction codes | Renamed to `PARTNER_OWES_US` / `WE_OWE_PARTNER`. |

### Kept

- Cookie sessions and login (`/auth/login`, `/auth/logout`, `/auth/me`).
- `GET /partners` with balances, `POST /partners`, `PATCH /partners/:id`.
- `GET /dashboard`.
- `GET /reports/transactions.csv` as a backup export (includes voided rows).
- Soft delete through `voidedAt`; voided entries are excluded from every balance.

### Fixed

- Date range filters dropped the `from` bound when `to` was also given (`dateWhere` wrote both
  bounds to the same object key).
- Money formatting on the web went through `Number`, which lost precision for very large riel
  amounts; it now groups digits as a string.
