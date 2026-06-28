-- Unicidad de (walletId, level) SOLO entre tiers vivos, para convivir con el
-- soft-delete. No se borra ni elimina ningún registro: una fila con deletedAt
-- queda conservada (recuperable) pero sale del índice, liberando su nivel para
-- que pueda recrearse sin chocar con el unique.
DROP INDEX "WalletTier_walletId_level_key";

CREATE UNIQUE INDEX "WalletTier_walletId_level_key"
  ON "WalletTier" ("walletId", "level")
  WHERE "deletedAt" IS NULL;
