-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "chargeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "pixCode" TEXT,
ADD COLUMN     "pixQrCode" TEXT;

