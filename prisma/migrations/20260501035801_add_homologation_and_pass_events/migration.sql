-- CreateEnum
CREATE TYPE "PassEventType" AS ENUM ('pass_created', 'pass_deleted', 'link_sent', 'stamp_added', 'stamp_redeemed', 'points_added', 'points_redeemed', 'cashback_added', 'cashback_redeemed', 'membership_renewed', 'daypass_scanned');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CashbackTransaction" ADD COLUMN     "createdBy" TEXT;

-- AlterTable
ALTER TABLE "DeviceRegistration" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationMember" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pass" ADD COLUMN     "createdBy" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "createdBy" TEXT;

-- CreateTable
CREATE TABLE "PassEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "type" "PassEventType" NOT NULL,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PassEvent_organizationId_createdAt_idx" ON "PassEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PassEvent_walletId_createdAt_idx" ON "PassEvent"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "PassEvent_passId_createdAt_idx" ON "PassEvent"("passId", "createdAt");

-- CreateIndex
CREATE INDEX "PassEvent_type_createdAt_idx" ON "PassEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "PassEvent" ADD CONSTRAINT "PassEvent_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
