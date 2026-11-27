-- One Entry table replaces lending records, product deliveries, payments and settlements.
-- The database at this point held test data only (confirmed by the owner), so the
-- old rows are cleared rather than converted; balances start from an empty ledger.

DELETE FROM "Payment";
DELETE FROM "Settlement";
DELETE FROM "LendingTransaction";
DELETE FROM "ProductDelivery";

DROP TABLE "Payment";
DROP TABLE "Settlement";
DROP TABLE "LendingTransaction";
DROP TABLE "ProductDelivery";
DROP TYPE "PaymentDirection";
DROP TYPE "SettlementStatus";

CREATE TYPE "EntryType" AS ENUM ('LEND', 'PRODUCT', 'SETTLE_IN', 'SETTLE_OUT');

CREATE TABLE "Entry" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "type" "EntryType" NOT NULL,
    "entryDate" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Entry_partnerId_entryDate_idx" ON "Entry"("partnerId", "entryDate");
CREATE INDEX "Entry_voidedAt_idx" ON "Entry"("voidedAt");
CREATE INDEX "Entry_type_idx" ON "Entry"("type");

ALTER TABLE "Entry" ADD CONSTRAINT "Entry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
