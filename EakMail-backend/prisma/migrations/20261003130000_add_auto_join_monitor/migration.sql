-- Add auto-join monitor fields to PromotionAccount
ALTER TABLE "PromotionAccount"
  ADD COLUMN IF NOT EXISTS "autoJoinEnabled"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoJoinMaxPerHour" INTEGER NOT NULL DEFAULT 5;

-- AutoJoinLog: records every link detected and join attempt
CREATE TABLE IF NOT EXISTS "AutoJoinLog" (
  "id"            TEXT         NOT NULL,
  "accountId"     TEXT         NOT NULL,
  "sourceGroup"   TEXT         NOT NULL,
  "targetGroup"   TEXT         NOT NULL,
  "rawLink"       TEXT         NOT NULL,
  "ok"            BOOLEAN      NOT NULL,
  "alreadyMember" BOOLEAN      NOT NULL DEFAULT false,
  "error"         TEXT,
  "joinedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutoJoinLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AutoJoinLog_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "PromotionAccount"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AutoJoinLog_accountId_joinedAt_idx" ON "AutoJoinLog"("accountId", "joinedAt");
CREATE INDEX IF NOT EXISTS "AutoJoinLog_targetGroup_idx"         ON "AutoJoinLog"("targetGroup");
CREATE INDEX IF NOT EXISTS "PromotionAccount_autoJoinEnabled_idx" ON "PromotionAccount"("autoJoinEnabled");
