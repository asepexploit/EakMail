-- AlterTable: add API supplier fields and product external id
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "apiBaseUrl"     TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "apiKeyEnc"      TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "apiAuthHeader"  TEXT;
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "externalProductId" TEXT;
