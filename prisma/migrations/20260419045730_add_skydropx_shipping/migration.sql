-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MXN',
ADD COLUMN     "shippingCarrier" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shippingCountry" TEXT NOT NULL DEFAULT 'MX',
ADD COLUMN     "shippingEmail" TEXT,
ADD COLUMN     "shippingEstimatedDays" INTEGER,
ADD COLUMN     "shippingExtNumber" TEXT,
ADD COLUMN     "shippingFullName" TEXT,
ADD COLUMN     "shippingIntNumber" TEXT,
ADD COLUMN     "shippingLabelUrl" TEXT,
ADD COLUMN     "shippingNeighborhood" TEXT,
ADD COLUMN     "shippingPhone" TEXT,
ADD COLUMN     "shippingPostalCode" TEXT,
ADD COLUMN     "shippingQuotationId" TEXT,
ADD COLUMN     "shippingRateId" TEXT,
ADD COLUMN     "shippingReference" TEXT,
ADD COLUMN     "shippingService" TEXT,
ADD COLUMN     "shippingState" TEXT,
ADD COLUMN     "shippingStreet" TEXT,
ADD COLUMN     "shippingTrackingNumber" TEXT,
ADD COLUMN     "skydropxShipmentId" TEXT,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'stripe';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "heightCm" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "lengthCm" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "shipsSeparately" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
ADD COLUMN     "widthCm" INTEGER NOT NULL DEFAULT 24;
