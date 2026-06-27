-- Estampa el nivel (tier) en cada evento de pase. Columna NULLABLE y aditiva:
-- los eventos históricos quedan en NULL y se interpretan como Nivel 1 en lectura
-- (COALESCE("tierLevel", 1)), evitando un backfill de millones de filas.
ALTER TABLE "PassEvent" ADD COLUMN "tierLevel" INTEGER;

-- Índice para las agregaciones por tier (distribución, funnel, engagement por nivel),
-- alineado con el patrón GROUP BY existente sobre columnas reales.
CREATE INDEX "PassEvent_walletId_tierLevel_type_createdAt_idx"
  ON "PassEvent" ("walletId", "tierLevel", "type", "createdAt");
