-- Migration: add_pass_event_composite_indexes
--
-- Las queries de analytics filtran SIEMPRE por (organizationId + type + createdAt)
-- y (walletId + type + createdAt). Los índices anteriores tenían type y organizationId
-- separados, obligando a PostgreSQL a hacer un Index Scan + filter en memoria.
-- Con índices compuestos el planner puede hacer Index Only Scan en las queries críticas.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "PassEvent_organizationId_type_createdAt_idx"
  ON "PassEvent" ("organizationId", "type", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "PassEvent_walletId_type_createdAt_idx"
  ON "PassEvent" ("walletId", "type", "createdAt");
