-- Add geofencesPerWallet to Plan
ALTER TABLE "Plan" ADD COLUMN "geofencesPerWallet" INTEGER NOT NULL DEFAULT 0;

-- Create Geofence table
CREATE TABLE "Geofence" (
    "id"           TEXT         NOT NULL,
    "walletId"     TEXT         NOT NULL,
    "label"        TEXT         NOT NULL,
    "latitude"     DOUBLE PRECISION NOT NULL,
    "longitude"    DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER      NOT NULL DEFAULT 100,
    "message"      TEXT         NOT NULL,
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Geofence_walletId_idx" ON "Geofence"("walletId");
CREATE INDEX "Geofence_walletId_isActive_idx" ON "Geofence"("walletId", "isActive");
