-- White-label: flag por plan que oculta el sello "Hecho con TriboWallet" en los
-- pases. Aditivo y con default false → los planes existentes muestran el sello
-- hasta que el seed/operación lo active (ej. plan pro).
ALTER TABLE "Plan" ADD COLUMN "removeBranding" BOOLEAN NOT NULL DEFAULT false;
