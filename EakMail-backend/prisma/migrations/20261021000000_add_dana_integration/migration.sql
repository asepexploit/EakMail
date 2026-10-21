-- Migration: add_dana_integration
-- Adds DanaDevice and DanaEvent models for Eak-DANA APK integration.
-- Also adds paidAt column to Payment for DANA settlements.

-- DanaEventStatus enum
CREATE TYPE "DanaEventStatus" AS ENUM ('ACCEPTED', 'DUPLICATE', 'NO_MATCH');

-- DanaDevice: registered Eak-DANA APK instances
CREATE TABLE "DanaDevice" (
    "id"        TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DanaDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DanaDevice_tokenHash_key" ON "DanaDevice"("tokenHash");
CREATE INDEX "DanaDevice_tokenHash_idx" ON "DanaDevice"("tokenHash");

-- DanaEvent: one row per DANA notification received from the APK
CREATE TABLE "DanaEvent" (
    "id"                TEXT NOT NULL,
    "notificationId"    TEXT NOT NULL,
    "deviceId"          TEXT NOT NULL,
    "rawTitle"          TEXT NOT NULL,
    "rawBody"           TEXT NOT NULL,
    "parsedAmount"      INTEGER,
    "parsedDescription" TEXT,
    "eventStatus"       "DanaEventStatus" NOT NULL DEFAULT 'NO_MATCH',
    "orderId"           TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DanaEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DanaEvent_notificationId_key" ON "DanaEvent"("notificationId");
CREATE INDEX "DanaEvent_deviceId_createdAt_idx" ON "DanaEvent"("deviceId", "createdAt");
CREATE INDEX "DanaEvent_orderId_idx" ON "DanaEvent"("orderId");
CREATE INDEX "DanaEvent_eventStatus_createdAt_idx" ON "DanaEvent"("eventStatus", "createdAt");

ALTER TABLE "DanaEvent" ADD CONSTRAINT "DanaEvent_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "DanaDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add paidAt to Payment (nullable, set when DANA confirms payment)
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);
