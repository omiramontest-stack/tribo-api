-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "Admin" ADD COLUMN "pendingEmailToken" TEXT;
ALTER TABLE "Admin" ADD COLUMN "pendingEmailTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_pendingEmailToken_key" ON "Admin"("pendingEmailToken");
