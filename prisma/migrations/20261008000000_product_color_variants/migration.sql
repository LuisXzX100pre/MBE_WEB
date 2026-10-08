BEGIN;
-- Preserve every existing row. Stop before changes if old nullable uniqueness allowed duplicates.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CartItem" GROUP BY "cartId", "productId", COALESCE("size"::text, 'NONE') HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate legacy CartItem selections: review them before applying this migration. No rows were removed.';
  END IF;
END $$;

-- DropIndex
DROP INDEX "CartItem_cartId_productId_size_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "homeHeroImageUrl" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "productColorId" TEXT,
ADD COLUMN     "variantKey" TEXT;
UPDATE "CartItem" SET "variantKey" = 'legacy:' || COALESCE("size"::text, 'NONE');
ALTER TABLE "CartItem" ALTER COLUMN "variantKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "productColorId" TEXT;

-- CreateTable
CREATE TABLE "ProductColor" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "swatchHex" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductColorImage" (
    "id" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductColorImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductColorSize" (
    "id" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "size" "Size" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductColorSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductColor_productId_order_idx" ON "ProductColor"("productId", "order");

-- CreateIndex
CREATE INDEX "ProductColorImage_colorId_order_idx" ON "ProductColorImage"("colorId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColorSize_colorId_size_key" ON "ProductColorSize"("colorId", "size");

-- CreateIndex
CREATE INDEX "CartItem_productColorId_idx" ON "CartItem"("productColorId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantKey_key" ON "CartItem"("cartId", "productId", "variantKey");

-- CreateIndex
CREATE INDEX "OrderItem_productColorId_idx" ON "OrderItem"("productColorId");

-- AddForeignKey
ALTER TABLE "ProductColor" ADD CONSTRAINT "ProductColor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColorImage" ADD CONSTRAINT "ProductColorImage_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "ProductColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColorSize" ADD CONSTRAINT "ProductColorSize_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "ProductColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productColorId_fkey" FOREIGN KEY ("productColorId") REFERENCES "ProductColor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productColorId_fkey" FOREIGN KEY ("productColorId") REFERENCES "ProductColor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductColorSize" ADD CONSTRAINT "ProductColorSize_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "ProductColor" ADD CONSTRAINT "ProductColor_swatchHex_valid" CHECK ("swatchHex" IS NULL OR "swatchHex" ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantKey_consistent" CHECK (
  ("productColorId" IS NULL AND "variantKey" = 'legacy:' || COALESCE("size"::text, 'NONE')) OR
  ("productColorId" IS NOT NULL AND "size" IS NOT NULL AND "variantKey" = "productColorId" || ':' || "size"::text)
);
COMMIT;
