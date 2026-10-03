-- AlterTable: add optionKey and optionValue columns to Order (nullable for backward compatibility)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "optionKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "optionValue" TEXT;
