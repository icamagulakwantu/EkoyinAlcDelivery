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
