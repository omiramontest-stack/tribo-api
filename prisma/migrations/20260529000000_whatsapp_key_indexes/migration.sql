-- Add createdAt to WhatsAppAuthKey; existing rows get the current timestamp.
ALTER TABLE "WhatsAppAuthKey" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Composite index for cleanup queries that filter by org + type.
CREATE INDEX "WhatsAppAuthKey_organizationId_type_idx" ON "WhatsAppAuthKey"("organizationId", "type");

-- Index for age-based pruning across all orgs (WHERE type = ? AND updatedAt < cutoff).
CREATE INDEX "WhatsAppAuthKey_type_updatedAt_idx" ON "WhatsAppAuthKey"("type", "updatedAt");

-- Purge the accumulated lid-mapping and excess pre-keys immediately on deploy.
-- lid-mapping entries are not needed for a send-only use case and were causing
-- unbounded growth (828+ pages). Pre-keys older than 7 days are stale.
DELETE FROM "WhatsAppAuthKey" WHERE "type" = 'lid-mapping';
DELETE FROM "WhatsAppAuthKey"
WHERE "type" = 'pre-key'
  AND "id" NOT IN (
    SELECT "id" FROM "WhatsAppAuthKey"
    WHERE "type" = 'pre-key'
    ORDER BY "updatedAt" DESC
    LIMIT 200
  );
