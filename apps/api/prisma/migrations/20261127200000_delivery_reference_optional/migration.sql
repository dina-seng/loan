-- Delivery reference codes are no longer required from the client.
-- Existing references are preserved for historical statements.
ALTER TABLE "ProductDelivery" ALTER COLUMN "reference" DROP NOT NULL;
