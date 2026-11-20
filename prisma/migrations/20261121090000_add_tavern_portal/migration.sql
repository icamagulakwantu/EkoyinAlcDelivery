-- Tavern portal (founder approved 21 Nov 2026): taverns sign in with phone + PIN,
-- see their orders, mark items sold out, and mark orders ready.
-- New tables plus one nullable column on "Order". Nothing existing is changed or deleted.
CREATE TABLE IF NOT EXISTS "TavernAccess" (
  "id" TEXT NOT NULL,
  "tavernId" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "failedLogins" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "sessionHash" TEXT,
  "sessionExpiresAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TavernAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TavernAccess_tavernId_key" ON "TavernAccess"("tavernId");
CREATE INDEX IF NOT EXISTS "TavernAccess_sessionHash_idx" ON "TavernAccess"("sessionHash");

CREATE TABLE IF NOT EXISTS "TavernSoldOut" (
  "id" TEXT NOT NULL,
  "tavernId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TavernSoldOut_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TavernSoldOut_tavernId_skuId_key" ON "TavernSoldOut"("tavernId", "skuId");
CREATE INDEX IF NOT EXISTS "TavernSoldOut_skuId_idx" ON "TavernSoldOut"("skuId");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);
