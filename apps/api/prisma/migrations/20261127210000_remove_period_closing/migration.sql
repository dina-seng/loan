-- Period closing is removed: entries may always be recorded, and settlements never lock anything.
DROP INDEX "Settlement_periodClosingId_idx";
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_periodClosingId_fkey";
ALTER TABLE "Settlement" DROP COLUMN "periodClosingId";
DROP TABLE "PeriodClosing";
DROP TYPE "ClosingStatus";
