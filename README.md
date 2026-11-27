# Business Ledger — បញ្ជីហិរញ្ញវត្ថុ

A mobile-first, Khmer-first ledger for the financial relationship between **Dad (ប៉ា)** and **Oudom (អ៊ូដុំ)**.

- Dad lends money **to** Oudom → Oudom owes Dad more.
- Oudom delivers products **to** Dad → Dad owes Oudom more.
- Payments can be made in either direction, partially or in full.
- Any custom date range can be closed; unpaid balances carry forward.

All money is stored as integer KHR (៛) in PostgreSQL `BIGINT` columns. Balances are **derived** from validated ledger records, never from an editable balance column.

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
npm run prisma:seed             # creates the "dad" owner account and an empty product catalog
```

Default seeded login: **dad** / **change-me-123** — change this before real use.
Change it by setting `SEED_USERNAME` / `SEED_PASSWORD` before seeding, or by updating the password hash with a small script. No fake financial transactions are ever seeded.

Prepare the test database (once):

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
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

Financial tests cover: all four balance effects, partial payments, opening-balance carry-forward, closing without double counting, immutable historical snapshots, duplicate submission protection, void reversal, catalog price changes vs historical delivery prices, custom periods, closed-period write protection and concurrent payments.

Optional browser QA (requires dev servers running and Microsoft Edge at the default Windows path, or edit `executablePath` in the scripts):

```bash
npm run qa:responsive   # 320/375/390/768/1024/1440px; checks horizontal overflow
npm run qa:pages        # every page at 320px + entry modal; checks overflow
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

Deploy the repo to a Node host (Render, Railway, Fly.io, VPS). Build the web app, run `prisma migrate deploy`, start the API. Set `CLIENT_URL` to your public origin. Health check path: `/health`.

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

Back up before every migration. Keep backups off the application host.

## Architecture

```
apps/api/src/
  config.js, db.js, errors.js        configuration, Prisma, central error handling
  money.js, dates.js                 exact integer money + Cambodia date parsing
  ledger.js                          THE balance calculation service (single source of truth)
  auth.js, idempotency.js, audit.js  sessions, duplicate protection, audit trail
  schemas.js, serialize.js           validation and safe JSON output
  routes/                            /api/v1 endpoint groups
apps/api/prisma/schema.prisma        8 required entities + sessions/idempotency keys
apps/web/src/
  pages/                             Dashboard, Transactions, Products, Settlement, History
  components/                        Layout, EntryModal, Ui, TransactionList (reused Icons)
  i18n/labels.js                     Khmer-first labels and error messages
  utils/money.js                     display formatting only — no financial logic
```

### Financial formula (backend only)

```
Net Balance = Opening Balance
            + Money Lent to Oudom
            − Product Delivery Costs
            − Payments from Oudom to Dad
            + Payments from Dad to Oudom
```

- Positive → `OUDOM_OWES_DAD` (អ៊ូដុំជំពាក់ប្រាក់ប៉ា)
- Negative → `DAD_OWES_OUDOM` (ប៉ាជំពាក់ប្រាក់អ៊ូដុំ)
- Zero → `SETTLED` (បានទូទាត់រួចរាល់)

Line totals = `round(quantity × unit price)` computed from exact integers on the server; delivery items store their own historical unit price and product name. Voiding sets `voidedAt` and excludes the entry from all sums; the original record is preserved and audited.

### Period closing

A closing stores an immutable snapshot (opening balance, all four totals, closing balance, generated-at) plus the exact date range. Closings do **not** modify the ledger or add a synthetic balance entry, so nothing is counted twice and outstanding balances carry forward automatically. Writes into an actively closed date range are rejected; a controlled reopen (`POST /period-closings/:id/reopen` with a reason) unlocks the range and is audited. Earlier statement snapshots remain readable.

## API endpoints

All under `/api/v1`, JSON responses shaped `{ ok, data, meta? }` or `{ ok: false, error: { code, message, details? } }`. Financial POSTs require an `Idempotency-Key` header.

| Group | Endpoints |
|---|---|
| `/auth` | `POST /login`, `POST /logout`, `GET /me` |
| `/dashboard` | `GET /` (`?periodId=`) |
| `/lending` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void` |
| `/products` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `/deliveries` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void` |
| `/payments` | `GET /`, `GET /:id`, `POST /`, `POST /:id/void` |
| `/settlements` | `GET /`, `GET /:id`, `POST /` |
| `/period-closings` | `GET /`, `GET /preview`, `GET /:id`, `GET /:id/statement`, `POST /`, `POST /:id/reopen` |
| `/transactions` | `GET /`, `GET /:id` |
| `/reports` | `GET /summary`, `GET /statements`, `GET /statement/:id`, `GET /transactions.csv` |
| Health | `GET /health` (unauthenticated, checks DB) |

## Known limitations

- One mutual account (`AccountSettings` row `main`) and one shared owner login are seeded; `users` supports additional members but there is no account-management UI yet.
- Reopening a closing is intentionally restricted: later active closings must be reopened first, in reverse order.
- Login throttling is process-local; use a shared rate limiter (e.g. Redis) when running multiple API instances.
- No PDF library is included; printable statements use the browser print dialog and CSV export.
- The legacy Apps Script implementation has been removed; see `MIGRATION_PLAN.md` for its migration mapping and git history for the old files.
