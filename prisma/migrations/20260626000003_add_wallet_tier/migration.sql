-- Niveles configurables de una wallet (Wallet Upgrades). El Nivel 1 sigue siendo
-- la wallet base implícita; esta tabla almacena los niveles 2+. Tabla nueva y
-- aditiva: no afecta a ninguna wallet existente (los upgrades son opt-in).
CREATE TABLE "WalletTier" (
  "id"         TEXT NOT NULL,
  "walletId"   TEXT NOT NULL,
  "level"      INTEGER NOT NULL,
  "name"       TEXT NOT NULL,
  "rules"      JSONB NOT NULL,
  "config"     JSONB,
  "unlockRule" JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  "deletedAt"  TIMESTAMP(3),
  CONSTRAINT "WalletTier_pkey" PRIMARY KEY ("id")
);

-- Un solo registro por (wallet, nivel).
CREATE UNIQUE INDEX "WalletTier_walletId_level_key" ON "WalletTier" ("walletId", "level");
CREATE INDEX "WalletTier_walletId_idx" ON "WalletTier" ("walletId");

ALTER TABLE "WalletTier"
  ADD CONSTRAINT "WalletTier_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
