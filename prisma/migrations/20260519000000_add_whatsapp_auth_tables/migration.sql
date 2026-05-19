-- CreateTable
CREATE TABLE "WhatsAppAuthCreds" (
    "organizationId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAuthCreds_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "WhatsAppAuthKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAuthKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppAuthKey_organizationId_idx" ON "WhatsAppAuthKey"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAuthKey_organizationId_type_keyId_key" ON "WhatsAppAuthKey"("organizationId", "type", "keyId");

-- AddForeignKey
ALTER TABLE "WhatsAppAuthCreds" ADD CONSTRAINT "WhatsAppAuthCreds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppAuthKey" ADD CONSTRAINT "WhatsAppAuthKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
