DO $$ BEGIN
  CREATE TYPE "MonitoredGroupStatus" AS ENUM ('ACTIVE', 'READ_ONLY', 'LEFT', 'BANNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MonitoredGroup" (
  "id"              TEXT                    NOT NULL,
  "accountId"       TEXT                    NOT NULL,
  "chatId"          TEXT                    NOT NULL,
  "username"        TEXT,
  "title"           TEXT                    NOT NULL,
  "type"            TEXT                    NOT NULL,
  "memberCount"     INTEGER,
  "canSendMessages" BOOLEAN                 NOT NULL DEFAULT true,
  "status"          "MonitoredGroupStatus"  NOT NULL DEFAULT 'ACTIVE',
  "joinedAt"        TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt"          TIMESTAMP(3),
  "sourceLink"      TEXT,

  CONSTRAINT "MonitoredGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MonitoredGroup_accountId_chatId_key" UNIQUE ("accountId", "chatId"),
  CONSTRAINT "MonitoredGroup_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "PromotionAccount"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MonitoredGroup_accountId_status_idx" ON "MonitoredGroup"("accountId", "status");
CREATE INDEX IF NOT EXISTS "MonitoredGroup_status_idx"            ON "MonitoredGroup"("status");
