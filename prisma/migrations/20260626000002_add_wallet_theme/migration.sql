-- Personalización visual por wallet (WalletThemeOverrides). Columna NULLABLE y
-- aditiva: las wallets existentes quedan en NULL y se renderizan con los defaults
-- actuales (fondo = primaryColor, texto/label blanco), sin cambio de comportamiento.
ALTER TABLE "Wallet" ADD COLUMN "theme" JSONB;
