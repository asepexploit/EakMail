-- Migration: MonitorMessage (live message log) + messageLogEnabled flag

ALTER TABLE "PromotionAccount"
  ADD COLUMN IF NOT EXISTS "messageLogEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "MonitorMessage" (
  "id"          TEXT NOT NULL,
  "accountId"   TEXT NOT NULL,
  "chatId"      TEXT NOT NULL,
  "chatTitle"   TEXT NOT NULL,
  "senderId"    TEXT,
  "senderName"  TEXT,
  "text"        TEXT NOT NULL,
  "hasLink"     BOOLEAN NOT NULL DEFAULT false,
  "ts"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonitorMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MonitorMessage_accountId_ts_idx"
  ON "MonitorMessage"("accountId", "ts");

CREATE INDEX IF NOT EXISTS "MonitorMessage_chatId_idx"
  ON "MonitorMessage"("chatId");

DO $$ BEGIN
  ALTER TABLE "MonitorMessage"
    ADD CONSTRAINT "MonitorMessage_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "PromotionAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
