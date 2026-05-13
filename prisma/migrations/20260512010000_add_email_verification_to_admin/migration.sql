-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Admin" ADD COLUMN "emailVerificationToken" TEXT;
ALTER TABLE "Admin" ADD COLUMN "emailVerificationTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_emailVerificationToken_key" ON "Admin"("emailVerificationToken");
