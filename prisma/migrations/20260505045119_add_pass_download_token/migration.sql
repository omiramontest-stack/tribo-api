-- CreateTable
CREATE TABLE "PassDownloadToken" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "passToken" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassDownloadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PassDownloadToken_token_key" ON "PassDownloadToken"("token");

-- CreateIndex
CREATE INDEX "PassDownloadToken_passId_idx" ON "PassDownloadToken"("passId");

-- AddForeignKey
ALTER TABLE "PassDownloadToken" ADD CONSTRAINT "PassDownloadToken_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
