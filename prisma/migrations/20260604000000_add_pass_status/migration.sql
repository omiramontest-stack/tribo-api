CREATE TYPE "PassStatus" AS ENUM ('active', 'completed', 'archived');

ALTER TABLE "Pass" ADD COLUMN "status" "PassStatus" NOT NULL DEFAULT 'active';

CREATE INDEX "Pass_walletId_status_idx" ON "Pass"("walletId", "status");
