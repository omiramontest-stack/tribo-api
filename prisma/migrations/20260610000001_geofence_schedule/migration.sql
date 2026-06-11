ALTER TABLE "Geofence"
  ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "schedule"        JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN "timezone"        TEXT    NOT NULL DEFAULT 'America/Mexico_City';
