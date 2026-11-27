# Business Ledger — បញ្ជីហិរញ្ញវត្ថុ

A mobile-first, Khmer-first ledger for Dad (ប៉ា) and **multiple business partners** (ដៃគូ). The first partner is Oudom (អ៊ូដុំ); more can be added and renamed at any time.

- Dad lends money **to** a partner → that partner owes Dad more.
- A partner delivers **multiple priced product lines** to Dad → Dad owes that partner more.
- Payments move in either direction and may be **partial**; the residual balance carries forward.
- A partner can start with an **opening balance** carried into every statement.
- Any custom date range can be **closed and reopened**; closed periods reject new entries until reopened.
- Every financial change writes an append-only **audit log**.

All money is stored as integer KHR (៛) in PostgreSQL `BIGINT` columns. Balances are **derived** by one backend service from the opening balance plus validated ledger records — never from an editable balance column, and never calculated in the browser.

> The old Google Apps Script / Google Sheets implementation was removed after the migration; its history and the migration mapping are documented in [MIGRATION_PLAN.md](./MIGRATION_PLAN.md). The active application lives in `apps/api` and `apps/web`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 3, React Router 7 |
| Backend | Node.js 20+, Express 4, REST `/api/v1` |
| Database | PostgreSQL 14+, Prisma 6 |
| Auth | HTTP-only cookie sessions, scrypt password hashing |
| Tests | Vitest, Supertest, Testing Library |

## Prerequisites

- Node.js ≥ 20, npm ≥ 10
- PostgreSQL 14+ (local, Docker, or managed)
- A modern browser with Khmer Unicode support (Noto Sans Khmer is bundled)

## 1. Install

```bash
cp .env.example .env
npm install
```

Edit `.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string. **Required.** |
| `TEST_DATABASE_URL` | Separate database for API integration tests. **Required for tests.** |
| `SESSION_SECRET` | ≥32 random characters in production. |
| `CLIENT_URL` | Frontend origin; also the allowed CORS origin. |
| `API_URL` | Backend public origin; used by the Vite dev proxy. |
| `NODE_ENV`, `PORT` | Runtime mode and port. |
| `BUSINESS_TIME_ZONE` | `Asia/Phnom_Penh` by default; used for “today”. |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Cookie policy (see deployment below). |
| `SEED_USERNAME`, `SEED_PASSWORD` | Development login created by `npm run prisma:seed`. |
| `VITE_API_URL` | Only needed when the frontend is hosted separately from the API. |

Create the databases:

```bash
createdb business_ledger
createdb business_ledger_test
```

## 2. Database setup

```bash
npm run prisma:migrate          # development migration (creates apps/api/prisma/migrations)
npm run prisma:generate         # generate Prisma client
npm run prisma:seed             # creates the "dad" OWNER account and the fallback partner អ៊ូដុំ
```

The newest migration, `20261128000000_spec_v4_rich_ledger`, is **forward-only**: it adds columns and tables, backfills one delivery line per existing `PRODUCT` entry and one payment detail per existing `SETTLE_*` entry, and never drops or rewrites a row. See the migration runbook in [MIGRATION_RUNBOOK.md](./MIGRATION_RUNBOOK.md) before applying it to a live database. Always take a `pg_dump` backup first.

Default seeded login: **dad** / **change-me-123** — change this before real use. The seed promotes an existing `dad` account to `OWNER` without changing its password. It refuses to run in production unless `ALLOW_PROD_SEED=1` is set deliberately.
Change it by setting `SEED_USERNAME` / `SEED_PASSWORD` before seeding, or by updating the password hash with a small script. No fake financial transactions are ever seeded.

Prepare the test database (once):

```bash
npm run prisma:migrate:test   # safe: loads .env in Node, refuses non-test names, prints target
```

## 3. Development

```bash
npm run dev           # API on :4000, web on :5173 (Vite proxies /api)
npm run dev:api
npm run dev:web
```

Open <http://localhost:5173>.

## 4. Tests and checks

```bash
npm run test:api      # unit + Supertest integration tests (needs TEST_DATABASE_URL)
npm run test:web      # component/helper tests
npm test              # both
npm run lint          # ESLint
npm run build         # Prisma generate + production web build
```

Unit tests cover the four entry effects, the worked example (5,000,000 lend − 4,504,500 product = 495,500), exact Khmer-digit money/quantity parsing, period totals, opening-balance carry-forward, date-range safety and JSON-safe closing snapshots. API integration tests (run separately against the test database) cover lending, multi-item delivery, partial/full payments, previews, closing/reopening, closed-period isolation, carry-forward, idempotency, concurrency, audit and validation. `npm test` runs both suites and requires a migrated `business_ledger_test` database; use `npm run prisma:migrate:test` to migrate it safely.

Optional browser QA (requires dev servers running and Microsoft Edge at the default Windows path, or edit `executablePath` in the scripts):

```bash
npm run qa:responsive   # 320/375/390/768/1024/1440px; overflow, 4-item nav, partner selector
npm run qa:pages        # every page at 320px + entry modal + partner sheet; checks overflow

The QA scripts use `SEED_PASSWORD` from `.env` (or `QA_PASSWORD`) to log in.
```


## 5. Production build and start

```bash
npm install --omit=dev
npm run prisma:deploy
npm run build
NODE_ENV=production npm start
```

`npm start` runs the Express server. If `apps/web/dist/index.html` exists, Express serves the built frontend from the same origin — the simplest production setup. The health check is `GET /health`.

## 6. Deployment

### Option A — single service (recommended for simplicity)

Deploy the repo to a Node host (Render, Railway, Fly.io, VPS, or `dinacreator.space`). Build the web app, run `prisma migrate deploy`, start the API. Set `CLIENT_URL` to your public origin. Health check path: `/health`. See [MIGRATION_RUNBOOK.md](./MIGRATION_RUNBOOK.md) for the exact `dinacreator.space` release order. The API sends `X-Robots-Tag: noindex, nofollow` on every response and serves `/robots.txt`; the built frontend also includes the same meta tag and static `robots.txt`.

### Option B — separate frontend and backend

- Backend: deploy `apps/api`, set `CLIENT_URL=https://your-frontend.example`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` (requires HTTPS). Add the frontend domain to CORS via `CLIENT_URL` (comma-separated for multiple origins).
- Frontend: build with `VITE_API_URL=https://api.your-domain.example` in the build environment, then host `apps/web/dist` on any static host (Vercel, Netlify, Cloudflare Pages). Configure a rewrite so unknown paths serve `index.html` (SPA routing).
- The browser sends cookies with `credentials: 'include'`; the API sets `HttpOnly`, `Secure`, `SameSite=None` cookies.

### Managed PostgreSQL

Use a managed PostgreSQL instance, set `DATABASE_URL` with SSL parameters as provided by the vendor, and run `npm run prisma:deploy` as a release step. Keep `SESSION_SECRET`, database credentials and seed passwords out of frontend variables.

## 7. Backup and restore

```bash
# Backup
pg_dump "$DATABASE_URL" -Fc -f ledger-backup.dump

# Restore into a fresh database
pg_restore --clean --if-exists -d "$DATABASE_URL" ledger-backup.dump
```

Back up before every migration. Keep backups off the application host. The app also exports
the selected partner's full history (voided rows included) from the History screen as CSV.

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `EPERM … query_engine-windows.dll.node` on `prisma generate` | A running API/dev server holds the query engine. Stop it (`npm run dev` process tree), run `npm run prisma:generate`, then restart. |
| `Timed out trying to acquire a postgres advisory lock` | Another `prisma migrate` is still running against the same database. Wait a few seconds and retry. |
| Integration tests refuse to run | `TEST_DATABASE_URL` must point at a separate database and must contain `test` in its name. Create it with `createdb business_ledger_test` and migrate it once (see Database setup). |
| Login returns 401 repeatedly | The seeded account may not exist yet: run `npm run prisma:seed`. Change `SEED_PASSWORD` before first real use. |
| Closing/reopening returns 403 | Those actions are `OWNER`-only. The seed promotes the existing `dad` account to `OWNER`; other users stay `MEMBER`. |
| `PERIOD_CLOSED` / `PERIOD_OVERLAP` on a new entry | The date falls in a closed period. The error names `lastClosedDate` and `earliestAllowedDate`; use the first open date or reopen the latest closing. |
| A date shows one day earlier/later | Dates are plain `yyyy-mm-dd` and must never be converted with `toISOString` or a timestamp. Send the string straight from the date input. |
| `មិនមានសមតុល្យត្រូវទូទាត់ទេ` when settling | The balance is exactly zero, so there is nothing to clear. Add an entry first. |

## Architecture

```
apps/api/src/
  config.js, db.js, errors.js        configuration, Prisma, central error handling
  money.js, dates.js                 exact integer money/quantity + Cambodia date parsing
  ledger.js                          THE balance calculation service (single source of truth)
  audit.js, serialize.js             append-only audit trail + JSON serializers
  auth.js, partner.js                sessions, roles, selected-partner scoping
  schemas.js                         request validation
  routes/                            /api/v1 endpoint groups
apps/api/prisma/schema.prisma        users, partners, Entry + satellite tables
apps/web/src/
  partners.jsx                       selected-partner context (persisted in localStorage)
  pages/                             Dashboard, History, Tools, Products, Deliveries,
                                     Settlements, Closings, Statements, Audit
  components/                        Layout, PartnerSwitcher, EntryModal, DeliveryModal,
                                     SettlementModal, VoidDialog, EntryList, Ui
  strings.km.js                      every user-facing Khmer string (see WORDING.md)
  utils/money.js                     display formatting only — no financial logic
```

The mobile bottom bar keeps three destinations (Dashboard, History, Tools); Tools links to the
product catalog, deliveries, settlements, period closings, statements and the audit trail. All
totals — including per-month subtotals — come from the API in `meta`; the browser only formats
them for display. Entry forms default to the first open date after the latest closing and show a
Khmer warning naming the last closed date and earliest allowed date when a closed date is used.

### One Entry ledger plus satellite tables

Every money movement is one row in `Entry` (`id`, `partnerId`, `type`, `entryDate`, `amount`, `note`, `voidedAt`, `voidReason`). The type decides the sign; the amount is always a positive whole riel. Detailed information lives in satellite tables that point back to the entry:

| Table | Purpose |
|---|---|
| `Product` | Reusable catalog with an optional default unit price; historical lines keep their own name/price snapshot. |
| `DeliveryItem` | One priced line of a `PRODUCT` entry (`quantity`, `unitPrice`, `lineTotal`). Server computes the total; the client never does. |
| `Settlement` | One payment detail for a `SETTLE_IN` / `SETTLE_OUT` entry (`direction`, `method`, `status`, `balanceAfter`). Shared by `/payments` and `/settlements`. |
| `PeriodClosing` | Immutable snapshot of a closed range, with totals and the balance carried forward. |
| `AuditLog` | Append-only record of who changed what, before and after. |

| Type | Meaning | Effect on the balance |
|---|---|---|
| `LEND` | cash we gave the partner | `+` |
| `PRODUCT` | value of goods we received | `−` |
| `SETTLE_IN` | the partner paid us | `−` |
| `SETTLE_OUT` | we paid the partner | `+` |

```
Partner Balance = openingBalance + LEND − PRODUCT − SETTLE_IN + SETTLE_OUT
```

`computeBalance()` in `apps/api/src/ledger.js` is the only balance calculation; the dashboard, partner list, transactions, statements, previews and settlement all use it.

- Positive → `PARTNER_OWES_US` (គេជំពាក់យើង, amber)
- Negative → `WE_OWE_PARTNER` (យើងជំពាក់គេ, blue)
- Zero → `SETTLED` (ស្មើរួចរាល់, green)

A full settlement clears the exact balance with one entry (`SETTLE_IN` when they owe us, `SETTLE_OUT` when we owe them); a partial settlement records only the amount paid and the residual balance, so the balance carries forward. Writes for one partner are serialized with a transaction-scoped advisory lock, so two simultaneous payments cannot both use the same starting balance. Deleting sets `voidedAt` and `voidReason` (soft delete) and excludes the row from every balance. The browser generates each id, so retrying a save with the same id returns the existing row instead of writing a second one.

Closing a custom period stores the computed totals, the closing balance and a JSON snapshot. While a period is closed, entries dated inside it are rejected with `PERIOD_CLOSED`, which names the last closed date and the earliest allowed date; the default new-entry date becomes the first open day. Only the latest closing can be reopened, and that action is `OWNER`-only and audited.

## API endpoints

All under `/api/v1`, JSON responses shaped `{ ok, data, meta? }` or `{ ok: false, error: { code, message, details? } }`. Every partner-scoped endpoint requires an `X-Partner-Id` header (the CSV export also accepts `?partnerId=`). Financial POSTs include a browser-generated `id`; repeating that id returns the existing row.

| Group | Endpoints |
|---|---|
| `/auth` | `POST /login`, `POST /logout`, `GET /me` |
| `/partners` | `GET /` (balances + totals), `GET /:id`, `POST /`, `PATCH /:id`, `GET /:id/opening-balance`, `POST /:id/settle` (full balance) |
| `/products` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/deactivate` (shared catalog; login required) |
| `/dashboard` | `GET /?from=&to=` (balance + four totals + recent entries) |
| `/entries` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void`, `GET /list/all` |
| `/lending` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void` |
| `/deliveries` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void` (multi-item, server-computed totals) |
| `/payments` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void` (payment view of settlements) |
| `/settlements` | `GET /`, `GET /current`, `GET /:id`, `POST /` (partial or `fullBalance`) |
| `/period-closings` | `GET /`, `GET /preview?startDate=&endDate=`, `GET /:id`, `POST /`, `POST /:id/reopen` (owner-only writes) |
| `/transactions` | `GET /`, `GET /:id` (unified, filter by `kind`, `type`, date, search) |
| `/reports` | `GET /summary`, `GET /statement`, `GET /closing-preview`, `GET /transactions.csv` |
| `/audit` | `GET /` (append-only trail for the selected partner) |
| Health | `GET /health` (unauthenticated, checks DB), `GET /robots.txt` |

## Known limitations

- There is no account-management UI yet. The seeded owner is `OWNER`; additional users created directly in the database default to `MEMBER` and cannot close/reopen periods or read the audit trail.
- `SESSION_SECRET` is required in production but currently reserved: sessions are random DB-backed tokens, not signed cookies.
- Login throttling is process-local; use a shared rate limiter (e.g. Redis) when running multiple API instances.
- The legacy Apps Script / Sheets implementation is retained in git history; its migration mapping is in `MIGRATION_PLAN.md`. CSV export remains the supported backup/export path.
