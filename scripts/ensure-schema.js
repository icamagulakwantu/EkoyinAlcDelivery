// scripts/ensure-schema.js
//
// Runs after `npm install` (package.json postinstall) and before the server
// starts (package.json start), so it runs on every Render deploy no matter
// what build command is set in the Render dashboard.
//
// Why: when a column is added to prisma/schema.prisma but `prisma db push`
// never runs against the live database, every order insert fails. Each
// statement below is idempotent (IF NOT EXISTS), so it's safe to re-run.
//
// Never fails the deploy: errors are logged and the script exits 0.

require('dotenv').config();

const STATEMENTS = [
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "hiddenByCustomer" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "SkuItem" ADD COLUMN IF NOT EXISTS "packSize" INTEGER NOT NULL DEFAULT 1`,
  // Dumpies and cans are sold only as six-packs. One-time conversion of
  // already-priced items: price x6, cases counted in six-packs. Rows already
  // converted have packSize 6, so re-running never multiplies twice.
  `UPDATE "SkuItem"
     SET "retailSingleZAR" = ROUND(("retailSingleZAR" * 6)::numeric, 2)::double precision,
         "unitsPerCase" = GREATEST(1, "unitsPerCase" / 6),
         "packSize" = 6
   WHERE "packSize" = 1
     AND "retailSingleZAR" > 0
     AND ("bottleFormat" ILIKE 'Dumpy%' OR "bottleFormat" ILIKE 'Can%')`,
  `CREATE TABLE IF NOT EXISTS "DriverReport" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "orderCode" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "driverName" TEXT,
     "driverPhone" TEXT,
     "category" TEXT NOT NULL,
     "message" TEXT NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'OPEN',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "DriverReport_orderCode_idx" ON "DriverReport"("orderCode")`,

  // ── Distance-based delivery fees ──
  // Tavern coordinates (set in the admin dashboard, Delivery tab).
  `ALTER TABLE "Tavern"
     ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
  // Fee breakdown saved on every new order (older orders keep nulls).
  `ALTER TABLE "Order"
     ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "surgeFee" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "priorityFee" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "serviceFee" DOUBLE PRECISION`,
  // One settings row (the surge on/off switch).
  `CREATE TABLE IF NOT EXISTS "DeliverySettings" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "surgesEnabled" BOOLEAN NOT NULL DEFAULT true,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `INSERT INTO "DeliverySettings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING`,
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[ensure-schema] DATABASE_URL not set, skipping.');
    return;
  }
  let PrismaClient;
  try {
    ({ PrismaClient } = require('@prisma/client'));
  } catch (err) {
    console.warn('[ensure-schema] Prisma client not available, skipping:', err.message);
    return;
  }
  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('[ensure-schema] Database columns are up to date.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.warn('[ensure-schema] Failed (deploy continues):', err.message);
});
