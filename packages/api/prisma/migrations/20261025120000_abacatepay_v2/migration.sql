-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "chargeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pixCode" TEXT,
ADD COLUMN     "pixQrCode" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "gatewaySubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_gatewaySubscriptionId_idx" ON "Subscription"("gatewaySubscriptionId");

