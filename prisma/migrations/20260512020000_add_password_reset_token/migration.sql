-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "Admin" ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_passwordResetToken_key" ON "Admin"("passwordResetToken");
