-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'COMING_SOON';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "dropName" TEXT,
ADD COLUMN     "releaseAt" TIMESTAMP(3);
