-- Phase 2 — additive rich-ledger schema (Option A).
-- This migration is forward-only: it adds columns/tables and backfills them.
-- It does not drop or rewrite any existing row.
--
-- Safety: every statement below is additive. The only data written is derived
-- from existing Entry rows (one delivery line per PRODUCT entry and one payment
-- detail per SETTLE_* entry) so historical balances keep the same meaning.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── enums ────────────────────────────────────────────────────────────────
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "PaymentDirection" AS ENUM ('PARTNER_TO_DAD', 'DAD_TO_PARTNER');
CREATE TYPE "SettlementStatus" AS ENUM ('PARTIAL', 'FULL');
CREATE TYPE "ClosingStatus" AS ENUM ('ACTIVE', 'REOPENED');

-- ── existing tables ──────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

ALTER TABLE "Partner" ADD COLUMN "openingBalance" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Entry"
    ADD COLUMN "reference" TEXT,
    ADD COLUMN "voidedById" UUID,
    ADD COLUMN "voidReason" TEXT;

ALTER TABLE "Entry"
    ADD CONSTRAINT "Entry_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Entry_partnerId_type_entryDate_idx" ON "Entry"("partnerId", "type", "entryDate");
CREATE INDEX "Entry_voidedById_idx" ON "Entry"("voidedById");

-- Case-insensitive partner uniqueness (the API already normalizes names).
DO $$
BEGIN
    -- Older migrations may already have created this index; do not fail or
    -- recreate it. The duplicate-name check runs only when we create it.
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Partner_name_lower_key')
    AND NOT EXISTS (
        SELECT 1 FROM "Partner" GROUP BY lower("name") HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX "Partner_name_lower_key" ON "Partner" (lower("name"));
    END IF;
END $$;

-- ── product catalog ──────────────────────────────────────────────────────
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "defaultUnitPrice" BIGINT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
CREATE UNIQUE INDEX "Product_name_lower_key" ON "Product" (lower("name"));
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- ── delivery lines ───────────────────────────────────────────────────────
CREATE TABLE "DeliveryItem" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "productId" UUID,
    "productName" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "lineTotal" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryItem_entryId_idx" ON "DeliveryItem"("entryId");
CREATE INDEX "DeliveryItem_productId_idx" ON "DeliveryItem"("productId");

ALTER TABLE "DeliveryItem"
    ADD CONSTRAINT "DeliveryItem_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem"
    ADD CONSTRAINT "DeliveryItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── payment detail for SETTLE_IN / SETTLE_OUT ────────────────────────────
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "periodClosingId" UUID,
    "direction" "PaymentDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "status" "SettlementStatus" NOT NULL DEFAULT 'PARTIAL',
    "balanceAfter" BIGINT NOT NULL,
    "note" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Settlement_entryId_key" ON "Settlement"("entryId");
CREATE INDEX "Settlement_partnerId_createdAt_idx" ON "Settlement"("partnerId", "createdAt");
CREATE INDEX "Settlement_periodClosingId_idx" ON "Settlement"("periodClosingId");
CREATE INDEX "Settlement_direction_idx" ON "Settlement"("direction");

ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── period closings ──────────────────────────────────────────────────────
CREATE TABLE "PeriodClosing" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "closingKey" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" UUID NOT NULL,
    "status" "ClosingStatus" NOT NULL DEFAULT 'ACTIVE',
    "openingBalance" BIGINT NOT NULL,
    "totalLent" BIGINT NOT NULL,
    "totalDelivered" BIGINT NOT NULL,
    "totalReceived" BIGINT NOT NULL,
    "totalPaidOut" BIGINT NOT NULL,
    "settlementAmount" BIGINT NOT NULL DEFAULT 0,
    "closingBalance" BIGINT NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PeriodClosing_partnerId_closingKey_key" ON "PeriodClosing"("partnerId", "closingKey");
CREATE INDEX "PeriodClosing_partnerId_periodStart_periodEnd_idx" ON "PeriodClosing"("partnerId", "periodStart", "periodEnd");
CREATE INDEX "PeriodClosing_status_idx" ON "PeriodClosing"("status");

ALTER TABLE "PeriodClosing"
    ADD CONSTRAINT "PeriodClosing_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodClosing"
    ADD CONSTRAINT "PeriodClosing_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_periodClosingId_fkey"
    FOREIGN KEY ("periodClosingId") REFERENCES "PeriodClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── audit log ────────────────────────────────────────────────────────────
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "partnerId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_partnerId_createdAt_idx" ON "AuditLog"("partnerId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── backfill: one delivery line per historical PRODUCT entry ─────────────
INSERT INTO "DeliveryItem" (
    "id", "entryId", "productName", "quantity", "unitPrice", "lineTotal", "sortOrder", "note"
)
SELECT
    gen_random_uuid(),
    e."id",
    'ទំនិញ',
    1.000,
    e."amount",
    e."amount",
    0,
    e."note"
FROM "Entry" e
WHERE e."type" = 'PRODUCT';

-- ── backfill: payment detail for every historical SETTLE_* entry ─────────
-- balanceAfter is replayed per partner so historical partial payments keep
-- their real status instead of being guessed as FULL.
INSERT INTO "Settlement" (
    "id", "entryId", "partnerId", "direction", "amount", "method",
    "status", "balanceAfter", "note", "reference", "createdAt"
)
SELECT
    gen_random_uuid(),
    e."id",
    e."partnerId",
    CASE
        WHEN e."type" = 'SETTLE_IN' THEN 'PARTNER_TO_DAD'::"PaymentDirection"
        ELSE 'DAD_TO_PARTNER'::"PaymentDirection"
    END,
    e."amount",
    'cash',
    CASE
        WHEN e."runningBalance" = 0 THEN 'FULL'::"SettlementStatus"
        ELSE 'PARTIAL'::"SettlementStatus"
    END,
    e."runningBalance",
    e."note",
    e."reference",
    e."createdAt"
FROM (
    SELECT
        e.*,
        SUM(
            CASE e."type"
                WHEN 'LEND' THEN e."amount"
                WHEN 'PRODUCT' THEN -e."amount"
                WHEN 'SETTLE_IN' THEN -e."amount"
                WHEN 'SETTLE_OUT' THEN e."amount"
            END
        ) OVER (
            PARTITION BY e."partnerId"
            ORDER BY e."entryDate", e."createdAt", e."id"
        ) AS "runningBalance"
    FROM "Entry" e
) e
WHERE e."type" IN ('SETTLE_IN', 'SETTLE_OUT');

-- ── database-level financial guards ──────────────────────────────────────
-- NOT VALID keeps legacy rows intact while enforcing the rule for every new
-- write. Run VALIDATE later only after a read-only data audit.
ALTER TABLE "Entry"
    ADD CONSTRAINT "Entry_amount_positive" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_amount_positive" CHECK ("amount" > 0) NOT VALID;

ALTER TABLE "DeliveryItem"
    ADD CONSTRAINT "DeliveryItem_quantity_positive" CHECK ("quantity" > 0),
    ADD CONSTRAINT "DeliveryItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0),
    ADD CONSTRAINT "DeliveryItem_lineTotal_nonnegative" CHECK ("lineTotal" >= 0);

ALTER TABLE "PeriodClosing"
    ADD CONSTRAINT "PeriodClosing_range_valid" CHECK ("periodStart" <= "periodEnd");

-- One ACTIVE closing may not overlap another for the same partner. Guarded so
-- the migration still works on a PostgreSQL server without btree_gist.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist') THEN
        CREATE EXTENSION IF NOT EXISTS btree_gist;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PeriodClosing_no_overlap') THEN
            ALTER TABLE "PeriodClosing"
                ADD CONSTRAINT "PeriodClosing_no_overlap"
                EXCLUDE USING gist (
                    "partnerId" WITH =,
                    daterange("periodStart", "periodEnd", '[]') WITH &&
                )
                WHERE ("status" = 'ACTIVE');
        END IF;
    END IF;
END $$;
