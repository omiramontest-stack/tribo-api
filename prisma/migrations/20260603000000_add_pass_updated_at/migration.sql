-- AlterTable
ALTER TABLE "Pass" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: use createdAt as initial value for existing rows
UPDATE "Pass" SET "updatedAt" = "createdAt";

-- CreateIndex (optional: helps filter queries in the Apple registrations endpoint)
CREATE INDEX "Pass_updatedAt_idx" ON "Pass"("updatedAt");
