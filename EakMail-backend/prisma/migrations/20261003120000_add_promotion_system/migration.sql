-- Promotion System: PromotionAccount, PromotionCampaign, CampaignAccount, PromotionLog

CREATE TYPE "PromotionAccountStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'FLOOD_WAIT', 'BANNED');
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "CampaignSendMode" AS ENUM ('ROUND_ROBIN', 'ALL_ACCOUNTS', 'RANDOM');
CREATE TYPE "PromotionLogStatus" AS ENUM ('SENT', 'FAILED', 'FLOOD_WAIT', 'SKIPPED');

CREATE TABLE "PromotionAccount" (
    "id"         TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "phone"      TEXT NOT NULL,
    "sessionEnc" TEXT,
    "status"     "PromotionAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "floodUntil" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionAccount_status_idx" ON "PromotionAccount"("status");

CREATE TABLE "PromotionCampaign" (
    "id"                          TEXT NOT NULL,
    "name"                        TEXT NOT NULL,
    "message"                     TEXT NOT NULL,
    "imageUrl"                    TEXT,
    "targetGroups"                JSONB NOT NULL DEFAULT '[]',
    "intervalMinutes"             INTEGER NOT NULL DEFAULT 60,
    "activeHoursStart"            INTEGER NOT NULL DEFAULT 0,
    "activeHoursEnd"              INTEGER NOT NULL DEFAULT 23,
    "activeDays"                  JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    "delayBetweenGroupsSeconds"   INTEGER NOT NULL DEFAULT 10,
    "sendMode"                    "CampaignSendMode" NOT NULL DEFAULT 'ROUND_ROBIN',
    "roundRobinIndex"             INTEGER NOT NULL DEFAULT 0,
    "status"                      "CampaignStatus" NOT NULL DEFAULT 'PAUSED',
    "nextRunAt"                   TIMESTAMP(3),
    "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionCampaign_status_idx" ON "PromotionCampaign"("status");

CREATE TABLE "CampaignAccount" (
    "campaignId" TEXT NOT NULL,
    "accountId"  TEXT NOT NULL,
    CONSTRAINT "CampaignAccount_pkey" PRIMARY KEY ("campaignId", "accountId"),
    CONSTRAINT "CampaignAccount_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE CASCADE,
    CONSTRAINT "CampaignAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PromotionAccount"("id") ON DELETE CASCADE
);

CREATE TABLE "PromotionLog" (
    "id"           TEXT NOT NULL,
    "campaignId"   TEXT NOT NULL,
    "accountId"    TEXT,
    "targetGroup"  TEXT NOT NULL,
    "status"       "PromotionLogStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PromotionLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE CASCADE,
    CONSTRAINT "PromotionLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PromotionAccount"("id") ON DELETE SET NULL
);

CREATE INDEX "PromotionLog_campaignId_sentAt_idx" ON "PromotionLog"("campaignId", "sentAt");
CREATE INDEX "PromotionLog_accountId_idx" ON "PromotionLog"("accountId");
