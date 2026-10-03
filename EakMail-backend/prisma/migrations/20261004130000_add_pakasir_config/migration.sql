-- CreateTable: PakasirConfig singleton (id = "default")
CREATE TABLE "PakasirConfig" (
    "id"            TEXT NOT NULL DEFAULT 'default',
    "mode"          TEXT NOT NULL DEFAULT 'production',
    "baseUrl"       TEXT,
    "slug"          TEXT,
    "apiKeyEnc"     TEXT,
    "webhookSecEnc" TEXT,

    CONSTRAINT "PakasirConfig_pkey" PRIMARY KEY ("id")
);
