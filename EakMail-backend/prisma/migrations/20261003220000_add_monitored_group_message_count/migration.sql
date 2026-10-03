-- AlterTable: add messageCount to MonitoredGroup
ALTER TABLE "MonitoredGroup" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0;
