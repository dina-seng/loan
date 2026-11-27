-- Multi-partner support and catalog-free deliveries.
-- Existing financial records are assigned to a fallback partner named អ៊ូដុំ.

BEGIN;
CREATE TYPE "PaymentDirection_new" AS ENUM ('PARTNER_TO_DAD', 'DAD_TO_PARTNER');
ALTER TABLE "Payment" ALTER COLUMN "direction" TYPE "PaymentDirection_new"
  USING (CASE "direction"::text
    WHEN 'OUDOM_TO_DAD' THEN 'PARTNER_TO_DAD'
    WHEN 'DAD_TO_OUDOM' THEN 'DAD_TO_PARTNER'
    ELSE 'PARTNER_TO_DAD' END)::"PaymentDirection_new";
ALTER TABLE "Settlement" ALTER COLUMN "direction" TYPE "PaymentDirection_new"
  USING (CASE "direction"::text
    WHEN 'OUDOM_TO_DAD' THEN 'PARTNER_TO_DAD'
    WHEN 'DAD_TO_OUDOM' THEN 'DAD_TO_PARTNER'
    ELSE 'PARTNER_TO_DAD' END)::"PaymentDirection_new";
ALTER TYPE "PaymentDirection" RENAME TO "PaymentDirection_old";
ALTER TYPE "PaymentDirection_new" RENAME TO "PaymentDirection";
DROP TYPE "public"."PaymentDirection_old";
COMMIT;

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openingBalance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- Fallback partner for all pre-existing records.
INSERT INTO "Partner" ("id", "name", "phone", "note", "isActive", "openingBalance", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'អ៊ូដុំ',
  NULL,
  'ដៃគូដើមដែលបានប្តូរពីប្រព័ន្ធចាស់',
  true,
  COALESCE((SELECT "openingBalance" FROM "AccountSettings" WHERE id = 'main'), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- Add partner columns as nullable first so existing rows can be backfilled.
ALTER TABLE "LendingTransaction" ADD COLUMN "partnerId" UUID;
ALTER TABLE "ProductDelivery" ADD COLUMN "partnerId" UUID;
ALTER TABLE "Payment" ADD COLUMN "partnerId" UUID;
ALTER TABLE "Settlement" ADD COLUMN "partnerId" UUID;
ALTER TABLE "PeriodClosing" ADD COLUMN "partnerId" UUID;

UPDATE "LendingTransaction" SET "partnerId" = '00000000-0000-4000-8000-000000000001' WHERE "partnerId" IS NULL;
UPDATE "ProductDelivery" SET "partnerId" = '00000000-0000-4000-8000-000000000001' WHERE "partnerId" IS NULL;
UPDATE "Payment" SET "partnerId" = '00000000-0000-4000-8000-000000000001' WHERE "partnerId" IS NULL;
UPDATE "Settlement" SET "partnerId" = '00000000-0000-4000-8000-000000000001' WHERE "partnerId" IS NULL;
UPDATE "PeriodClosing" SET "partnerId" = '00000000-0000-4000-8000-000000000001' WHERE "partnerId" IS NULL;

ALTER TABLE "LendingTransaction" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "ProductDelivery" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "Settlement" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "PeriodClosing" ALTER COLUMN "partnerId" SET NOT NULL;

-- Delivery items no longer reference a product catalog.
ALTER TABLE "DeliveryItem" DROP CONSTRAINT "DeliveryItem_productId_fkey";
ALTER TABLE "DeliveryItem" DROP COLUMN "productId",
DROP COLUMN "productNameSnapshot",
DROP COLUMN "sortOrder",
DROP COLUMN "unit",
ADD COLUMN "note" TEXT;

DROP TABLE "Product";

-- Drop old indexes that are replaced by partner-scoped ones.
-- (DeliveryItem_productId_idx is removed automatically with its column.)
DROP INDEX "LendingTransaction_transactionDate_idx";
DROP INDEX "Payment_paymentDate_idx";
DROP INDEX "PeriodClosing_closingKey_key";
DROP INDEX "PeriodClosing_periodStart_periodEnd_idx";
DROP INDEX "ProductDelivery_deliveryDate_idx";

-- CreateIndex
CREATE INDEX "Partner_name_idx" ON "Partner"("name");
CREATE INDEX "Partner_isActive_idx" ON "Partner"("isActive");
CREATE INDEX "LendingTransaction_partnerId_transactionDate_idx" ON "LendingTransaction"("partnerId", "transactionDate");
CREATE INDEX "Payment_partnerId_paymentDate_idx" ON "Payment"("partnerId", "paymentDate");
CREATE INDEX "PeriodClosing_partnerId_periodStart_periodEnd_idx" ON "PeriodClosing"("partnerId", "periodStart", "periodEnd");
CREATE UNIQUE INDEX "PeriodClosing_partnerId_closingKey_key" ON "PeriodClosing"("partnerId", "closingKey");
CREATE INDEX "ProductDelivery_partnerId_deliveryDate_idx" ON "ProductDelivery"("partnerId", "deliveryDate");
CREATE INDEX "Settlement_partnerId_idx" ON "Settlement"("partnerId");

-- AddForeignKey
ALTER TABLE "LendingTransaction" ADD CONSTRAINT "LendingTransaction_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductDelivery" ADD CONSTRAINT "ProductDelivery_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodClosing" ADD CONSTRAINT "PeriodClosing_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
