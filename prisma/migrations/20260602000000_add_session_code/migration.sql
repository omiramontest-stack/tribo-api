CREATE TABLE "SessionCode" (
  "id"        TEXT NOT NULL,
  "adminId"   TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionCode_adminId_idx"   ON "SessionCode"("adminId");
CREATE INDEX "SessionCode_expiresAt_idx" ON "SessionCode"("expiresAt");

ALTER TABLE "SessionCode"
  ADD CONSTRAINT "SessionCode_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
