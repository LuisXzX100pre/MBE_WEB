/*
  Warnings:

  - A unique constraint covering the columns `[cartId,productId,size]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Size" AS ENUM ('S', 'M', 'L', 'XL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';

-- DropIndex
DROP INDEX "CartItem_cartId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "size" "Size";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inventoryDiscounted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "size" "Size";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "payerEmail" TEXT,
ADD COLUMN     "paymentMethodId" TEXT,
ADD COLUMN     "preferenceId" TEXT,
ALTER COLUMN "provider" SET DEFAULT 'mercadopago';

-- CreateTable
CREATE TABLE "ProductSize" (
    "id" TEXT NOT NULL,
    "size" "Size" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_size_key" ON "ProductSize"("productId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_size_key" ON "CartItem"("cartId", "productId", "size");

-- AddForeignKey
ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
