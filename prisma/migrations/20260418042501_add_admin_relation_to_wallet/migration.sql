-- Delete wallets with no valid admin (dev data cleanup)
DELETE FROM "Wallet";

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "adminId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
