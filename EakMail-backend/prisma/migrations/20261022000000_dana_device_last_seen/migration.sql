-- Add lastSeenAt to DanaDevice for APK heartbeat tracking
ALTER TABLE "DanaDevice" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
