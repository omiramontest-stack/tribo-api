-- Migration: add_pass_auth_token_and_sms_credit_constraint
--
-- 1. Añade el campo authToken al Pass para el protocolo Apple PassKit Web Service.
--    DEFAULT gen_random_uuid() asegura que todos los registros existentes
--    reciban un token único sin necesidad de backfill manual.
--
-- 2. Añade un constraint CHECK a SmsCredit.balance para prevenir que
--    race conditions o bugs dejen el saldo en negativo a nivel de DB.

-- Añadir authToken a Pass (todos los existentes reciben UUID único)
ALTER TABLE "Pass"
  ADD COLUMN IF NOT EXISTS "authToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Constraint de saldo no negativo en SmsCredit
ALTER TABLE "SmsCredit"
  ADD CONSTRAINT "sms_credit_balance_non_negative"
  CHECK (balance >= 0);
