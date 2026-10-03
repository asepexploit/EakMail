-- CreateTable
CREATE TABLE "TopupRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pakasirTxnId" TEXT,
    "qrString" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "TopupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopupRequest_customerId_createdAt_idx" ON "TopupRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "TopupRequest_pakasirTxnId_idx" ON "TopupRequest"("pakasirTxnId");

-- AddForeignKey
ALTER TABLE "TopupRequest" ADD CONSTRAINT "TopupRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
