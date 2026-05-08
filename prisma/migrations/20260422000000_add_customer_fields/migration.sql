-- Drop old column and add new ones with defaults for existing rows
ALTER TABLE "Pass" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Pass" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Pass" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- Migrate existing customerName -> firstName
UPDATE "Pass" SET "firstName" = "customerName" WHERE "customerName" IS NOT NULL;

ALTER TABLE "Pass" DROP COLUMN "customerName";

-- Remove the defaults (future inserts must supply values)
ALTER TABLE "Pass" ALTER COLUMN "firstName" DROP DEFAULT;
ALTER TABLE "Pass" ALTER COLUMN "lastName" DROP DEFAULT;
ALTER TABLE "Pass" ALTER COLUMN "phone" DROP DEFAULT;
