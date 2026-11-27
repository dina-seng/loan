# Migration & deployment runbook (spec v4)

This runbook covers the forward-only `20261128000000_spec_v4_rich_ledger` migration and deployment to `dinacreator.space`. Read it fully before running any database command.

## 0. Safety contract

- Never work on `main` / `master`. Do all work on a feature branch (current branch: `feature/spec-v4`).
- Never run `git reset --hard`, `git clean`, `git push --force`, `prisma migrate reset`, `DROP TABLE`, `DROP DATABASE`, or `pg_restore --clean` against a database that holds real data.
- **Before every database command**, print only the `DATABASE_URL` **host** and **database name** — never the password — and confirm the target is the intended development or staging database. Production is touched only through an explicitly approved release.
- Take a `pg_dump` backup before every migration and keep it off the application host.

Printing the target safely (PowerShell):

```powershell
$u = [Uri]$env:DATABASE_URL
Write-Output "host=$($u.Host) database=$($u.AbsolutePath.TrimStart('/')) node=$env:NODE_ENV"
```

Expected local values: host `localhost`, database `business_ledger`, `NODE_ENV=development`. The test database is separately named `business_ledger_test`. A Neon pooled host ending in `.neon.tech` with database `neondb` is **not** a local test target — confirm explicitly before connecting.

## 1. Pre-deployment checks

```bash
npm run lint
npm run build          # prisma generate + web production build
npx prisma validate --schema=apps/api/prisma/schema.prisma
npm run test:web
npx vitest run tests/unit --config vitest.config.js   # from apps/api
```

Run API integration tests only against a migrated `business_ledger_test` database after step 0's target check.

## 2. Apply the migration

Use `npm run prisma:migrate:test` for the test database. It loads `.env` inside Node,
refuses anything whose name does not contain `test`, prints host/database before running,
and overrides `DATABASE_URL` for that child process only. Do **not** set the variable in a
shell and rely on Prisma's `.env` fallback — if the shell variable is empty, Prisma re-reads
`DATABASE_URL` from `.env` and will silently target the development database.

```bash
# 1. Confirm target (host + database name, never password) and NODE_ENV.
# 2. Back up.
pg_dump "$DATABASE_URL" -Fc -f "backup-before-spec-v4-$(Get-Date -Format yyyyMMddHHmmss).dump"

# 3. Apply forward-only migrations.
npm run prisma:deploy

# 4. Regenerate the client and verify the applied migration.
npm run prisma:generate
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

What the new migration does:

- Adds `User.role`, `Partner.openingBalance`, and `Entry.reference / voidedById / voidReason`.
- Adds the `Product`, `DeliveryItem`, `Settlement`, `PeriodClosing` and `AuditLog` tables plus enums and indexes.
- Backfills one `DeliveryItem` per existing `PRODUCT` entry and one `Settlement` per existing `SETTLE_IN` / `SETTLE_OUT` entry, replaying the running balance so historical partial payments keep their status.
- Adds `NOT VALID` positivity checks on new writes and an optional non-overlap exclusion for active closings (skipped if `btree_gist` is unavailable).
- Guards `Partner_name_lower_key`: an older migration may already have created it. The index is only created when missing and names are unique; this makes the migration safe to retry.
- Drops nothing. Existing rows and their meaning are preserved.

If a migration fails, verify with a read-only query whether its DDL was rolled back before
using `prisma migrate resolve --rolled-back`. Never mark a failed migration as applied
unless you have confirmed every statement took effect.

Verify after migration (read-only):

```sql
SELECT (SELECT count(*) FROM "Entry" e WHERE e."type" = 'PRODUCT') AS products,
       (SELECT count(*) FROM "DeliveryItem") AS delivery_items,
       (SELECT count(*) FROM "Entry" e WHERE e."type" IN ('SETTLE_IN','SETTLE_OUT')) AS payments,
       (SELECT count(*) FROM "Settlement") AS settlements;
```

The counts on each side must match. If they do not, stop and investigate before enabling writes.

## 3. Seed / promote the owner

After the migration, an existing `dad` account is promoted to `OWNER` without touching its password. Seeding is blocked in production unless explicitly allowed:

```bash
npm run prisma:seed                    # development only
ALLOW_PROD_SEED=1 npm run prisma:seed  # production, only when intentionally creating the fallback owner
```

`OWNER` is required for period closing/reopening and audit access.

## 4. Deployment to dinacreator.space

1. Set environment variables in the host: `DATABASE_URL`, `CLIENT_URL` (the public HTTPS origin), `SESSION_SECRET` (≥32 chars), `NODE_ENV=production`, `PORT`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `BUSINESS_TIME_ZONE=Asia/Phnom_Penh`, `SEED_USERNAME`, `SEED_PASSWORD`.
2. Install with `npm install --omit=dev`, then run `npm run prisma:deploy` as a release step, then `npm run build`.
3. Start with `NODE_ENV=production npm start`. Single-process hosting is simplest: Express serves `apps/web/dist` from the same origin.
4. Health check: `GET /health` returns `200 { ok: true, status: "healthy", database: "connected" }`; a failed DB check returns `503`.
5. Confirm `GET /robots.txt` returns `Disallow: /` and that API responses carry `X-Robots-Tag: noindex, nofollow`.
6. If the frontend is hosted separately, build it with `VITE_API_URL=https://<api-host>` and add that origin to `CLIENT_URL`; configure an SPA rewrite to `index.html`. The built app already includes `noindex,nofollow` and its own `robots.txt`.

## 5. If something goes wrong

- The migration is additive, so application code from before the migration still reads/writes the original columns. Roll back the **application release**, not the schema.
- Restore data only from the pre-migration `pg_dump` into a fresh database, after confirming the target with step 0. Never use destructive restore flags on a live database.
- Reopening a period is the supported way to make a closed date writable again; it is audited and only the latest closing may be reopened.
- CSV export at `GET /api/v1/reports/transactions.csv` is the supported backup/export path for a partner's history. The old Google Apps Script / Sheets code stays in git history and is not deleted.
