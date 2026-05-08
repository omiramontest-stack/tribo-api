-- CreateTable
CREATE TABLE "DeviceRegistration" (
    "id" TEXT NOT NULL,
    "deviceLibraryIdentifier" TEXT NOT NULL,
    "passToken" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceRegistration_passToken_idx" ON "DeviceRegistration"("passToken");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRegistration_deviceLibraryIdentifier_passToken_key" ON "DeviceRegistration"("deviceLibraryIdentifier", "passToken");
