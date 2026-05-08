-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'staff');

-- CreateTable Organization (with temp column to link admins)
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "industry" TEXT,
  "country" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "_tempAdminId" TEXT,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable OrganizationMember
CREATE TABLE "OrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "role" "MemberRole" NOT NULL DEFAULT 'staff',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationMember_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationMember_organizationId_adminId_key" ON "OrganizationMember"("organizationId", "adminId");
CREATE INDEX "OrganizationMember_adminId_idx" ON "OrganizationMember"("adminId");

-- Migrate: one Organization per Admin using businessName
INSERT INTO "Organization" ("id", "name", "_tempAdminId", "createdAt")
SELECT gen_random_uuid(), "businessName", "id", "createdAt" FROM "Admin";

-- Create owner membership for each Admin
INSERT INTO "OrganizationMember" ("id", "organizationId", "adminId", "role", "createdAt")
SELECT gen_random_uuid(), o."id", o."_tempAdminId", 'owner', NOW()
FROM "Organization" o
WHERE o."_tempAdminId" IS NOT NULL;

-- Add organizationId to Wallet
ALTER TABLE "Wallet" ADD COLUMN "organizationId" TEXT;

UPDATE "Wallet" w
SET "organizationId" = o."id"
FROM "Organization" o
WHERE o."_tempAdminId" = w."adminId";

ALTER TABLE "Wallet" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old adminId from Wallet
ALTER TABLE "Wallet" DROP COLUMN "adminId";

-- Drop temp and businessName columns
ALTER TABLE "Organization" DROP COLUMN "_tempAdminId";
ALTER TABLE "Admin" DROP COLUMN "businessName";
