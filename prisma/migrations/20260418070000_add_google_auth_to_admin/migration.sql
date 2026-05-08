-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "Admin" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_googleId_key" ON "Admin"("googleId");
