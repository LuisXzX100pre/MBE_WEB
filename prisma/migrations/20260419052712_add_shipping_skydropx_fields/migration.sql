/*
  Warnings:

  - A unique constraint covering the columns `[paymentIntentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingBucket" TEXT,
ADD COLUMN     "shippingQuoteJson" JSONB,
ADD COLUMN     "shippingTrackingUrl" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentIntentId" TEXT,
ADD COLUMN     "receiptEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentIntentId_key" ON "Payment"("paymentIntentId");
