-- Baseline: the database as it already exists in production (built earlier
-- with `prisma db push` + scripts/ensure-schema.js). On the live database
-- this file is marked as applied without running (see scripts/migrate.js).
-- It only runs on a brand-new empty database.

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('BEER', 'CIDER_RTD', 'BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA', 'VODKA_PREMIUM', 'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'MIXER', 'WINE', 'WINE_BOX', 'SPARKLING', 'CHAMPAGNE', 'WATER', 'ICE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PAYMENT_PENDING', 'PENDING', 'DISPATCHED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'DISPATCHER');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'DISPATCHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "productType" TEXT NOT NULL,
    "bottleFormat" TEXT NOT NULL,
    "supplierPortfolio" TEXT NOT NULL,
    "listPriceZAR" DOUBLE PRECISION NOT NULL,
    "unitsPerCase" INTEGER NOT NULL,
    "supplierCaseDiscountPct" DOUBLE PRECISION NOT NULL,
    "supplierCasePriceZAR" DOUBLE PRECISION NOT NULL,
    "palletPackQty" INTEGER NOT NULL,
    "supplierPalletDiscountPct" DOUBLE PRECISION NOT NULL,
    "supplierPalletPriceZAR" DOUBLE PRECISION NOT NULL,
    "retailSingleZAR" DOUBLE PRECISION NOT NULL,
    "retailCaseDiscountPct" DOUBLE PRECISION NOT NULL,
    "retailCaseZAR" DOUBLE PRECISION NOT NULL,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "brandTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stock" INTEGER NOT NULL DEFAULT 999,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tavern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Tavern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverySettings" (
    "id" TEXT NOT NULL,
    "surgesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingCheckout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yocoCheckoutId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PendingCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL,
    "minSubtotal" DOUBLE PRECISION,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "deliveryLat" DOUBLE PRECISION,
    "deliveryLng" DOUBLE PRECISION,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cod',
    "status" "OrderStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "promoCode" TEXT,
    "promoDiscount" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "deliveryFee" DOUBLE PRECISION,
    "surgeFee" DOUBLE PRECISION,
    "priorityFee" DOUBLE PRECISION,
    "serviceFee" DOUBLE PRECISION,
    "total" DOUBLE PRECISION NOT NULL,
    "tavernId" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "driverVehicle" TEXT,
    "driverShareToken" TEXT,
    "driverLat" DOUBLE PRECISION,
    "driverLng" DOUBLE PRECISION,
    "driverLocationAt" TIMESTAMP(3),
    "rating" INTEGER,
    "ratingComment" TEXT,
    "codFlagged" BOOLEAN NOT NULL DEFAULT false,
    "codFlagReason" TEXT,
    "cancelReason" TEXT,
    "hiddenByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "skuId" TEXT,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverReport" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SkuItem_name_bottleFormat_key" ON "SkuItem"("name", "bottleFormat");

-- CreateIndex
CREATE UNIQUE INDEX "PendingCheckout_yocoCheckoutId_key" ON "PendingCheckout"("yocoCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "DriverReport_orderCode_idx" ON "DriverReport"("orderCode");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tavernId_fkey" FOREIGN KEY ("tavernId") REFERENCES "Tavern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SkuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
