-- Simplify the ledger before real use.
-- This release removes unneeded features. Every row in the database at this point
-- was test data (confirmed by the owner), so the ledger is cleared first.
DELETE FROM "DeliveryItem";
DELETE FROM "ProductDelivery";
DELETE FROM "LendingTransaction";
DELETE FROM "Payment";
DELETE FROM "Settlement";
DELETE FROM "AuditLog";
DELETE FROM "IdempotencyKey";

-- Audit trail, duplicate-submission keys and account settings are removed.
DROP TABLE "AuditLog";
DROP TABLE "IdempotencyKey";
DROP TABLE "AccountSettings";

-- A delivery is now a single amount: item rows with quantity and unit price are gone.
DROP TABLE "DeliveryItem";

-- A partner is only a name.
DROP INDEX "Partner_isActive_idx";
ALTER TABLE "Partner" DROP COLUMN "phone", DROP COLUMN "note", DROP COLUMN "isActive", DROP COLUMN "openingBalance";
CREATE UNIQUE INDEX "Partner_name_lower_key" ON "Partner" (LOWER("name"));

-- User roles are gone; login stays.
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "UserRole";

-- Entry references and payment methods are gone.
ALTER TABLE "LendingTransaction" DROP COLUMN "reference";
ALTER TABLE "ProductDelivery" DROP COLUMN "reference";
ALTER TABLE "Payment" DROP COLUMN "reference", DROP COLUMN "method";
ALTER TABLE "Settlement" DROP COLUMN "reference", DROP COLUMN "method";
