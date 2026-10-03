-- Migration: add AutoJoinQueue for persistent, rate-limited join queue
-- Links are enqueued immediately; a ticker processes them respecting hourly limit

DO $$ BEGIN
  CREATE TYPE "AutoJoinQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AutoJoinQueue" (
  "id"          TEXT NOT NULL,
  "accountId"   TEXT NOT NULL,
  "rawLink"     TEXT NOT NULL,
  "sourceGroup" TEXT NOT NULL,
  "status"      "AutoJoinQueueStatus" NOT NULL DEFAULT 'PENDING',
  "enqueuedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "logId"       TEXT,

  CONSTRAINT "AutoJoinQueue_pkey" PRIMARY KEY ("id")
);

-- Rough dedup: same account + link + same enqueue-minute is one row
CREATE UNIQUE INDEX IF NOT EXISTS "AutoJoinQueue_accountId_rawLink_enqueuedAt_key"
  ON "AutoJoinQueue"("accountId", "rawLink", "enqueuedAt");

CREATE INDEX IF NOT EXISTS "AutoJoinQueue_accountId_status_enqueuedAt_idx"
  ON "AutoJoinQueue"("accountId", "status", "enqueuedAt");

CREATE INDEX IF NOT EXISTS "AutoJoinQueue_status_idx"
  ON "AutoJoinQueue"("status");

ALTER TABLE "AutoJoinQueue"
  ADD CONSTRAINT "AutoJoinQueue_accountId_fkey"
  FOREIGN KEY ("accountId")
  REFERENCES "PromotionAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
