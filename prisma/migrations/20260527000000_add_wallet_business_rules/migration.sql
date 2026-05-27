-- AlterTable: Add businessRules column to Wallet
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "businessRules" TEXT;
