-- AlterTable: add supplierType column to Supplier with default 'bot'
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "supplierType" TEXT NOT NULL DEFAULT 'bot';
