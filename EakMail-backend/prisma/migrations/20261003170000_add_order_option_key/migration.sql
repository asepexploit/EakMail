-- AlterTable: add optionKey column to Order (nullable for backward compatibility)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "optionKey" TEXT;
