# Changelog

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
