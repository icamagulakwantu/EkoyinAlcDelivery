// scripts/ensure-schema.js
//
// Runs after npm install (package.json postinstall). Every statement is
// idempotent. It adds columns required by schema.prisma and performs the
// one-time six-pack conversion only for rows that have not been converted.
//
// A schema failure exits non-zero so Render cannot silently deploy code
// against a database missing required columns.

require('dotenv').config();

const STATEMENTS = [
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "hiddenByCustomer" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "SkuItem" ADD COLUMN IF NOT EXISTS "packSize" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "SkuItem" ADD COLUMN IF NOT EXISTS "brandTags" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "SkuItem" ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 999`,
  // Dumpies and cans are sold only as six-packs. Convert once: packSize 6
  // marks converted rows, so a later deploy never multiplies prices twice.
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
  `ALTER TABLE "Tavern"
     ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
  `ALTER TABLE "Order"
     ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "surgeFee" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "priorityFee" DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "serviceFee" DOUBLE PRECISION`,
  `CREATE TABLE IF NOT EXISTS "DeliverySettings" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "surgesEnabled" BOOLEAN NOT NULL DEFAULT true,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `INSERT INTO "DeliverySettings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING`,
];

function safeDatabaseTarget(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostRef = url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/i)?.[1];
    let userRef = null;
    try {
      const suffix = decodeURIComponent(url.username).split('.').pop();
      if (/^[a-z0-9]{20}$/i.test(suffix)) userRef = suffix;
    } catch (_) {}
    return {
      host: url.hostname,
      database: url.pathname.replace(/^\//, '') || 'default',
      supabaseProjectRef: hostRef || userRef || 'not-identifiable-from-host',
    };
  } catch (_) {
    return { host: 'unparseable', database: 'unknown', supabaseProjectRef: 'unknown' };
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[ensure-schema] DATABASE_URL not set; schema verification skipped (local install).');
    return;
  }

  console.log('[ensure-schema] Database target (credentials omitted):', JSON.stringify(safeDatabaseTarget(process.env.DATABASE_URL)));

  let PrismaClient;
  try {
    ({ PrismaClient } = require('@prisma/client'));
  } catch (err) {
    throw new Error(`Prisma client is not available: ${err.message}`);
  }

  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);

    const columns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'SkuItem'
        AND column_name IN ('packSize', 'brandTags', 'stock')
      ORDER BY column_name
    `;
    const present = columns.map(row => row.column_name);
    const required = ['brandTags', 'packSize', 'stock'];
    const missing = required.filter(column => !present.includes(column));
    if (missing.length) throw new Error(`SkuItem is missing required columns after schema setup: ${missing.join(', ')}`);
    console.log('[ensure-schema] Verified SkuItem columns:', present.join(', '));
    console.log('[ensure-schema] Database schema is up to date.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('[ensure-schema] Schema setup failed; stopping the deploy:', err);
  process.exitCode = 1;
});
