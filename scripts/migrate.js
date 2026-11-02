// scripts/migrate.js
//
// Applies database changes on every Render deploy, safely.
//
// Replaces `prisma db push --accept-data-loss`, which could silently drop
// columns or tables (and their data) whenever schema.prisma changed. Now
// every database change is a committed file in prisma/migrations/, and
// `prisma migrate deploy` only ever runs those files, in order, once each.
//
// If anything fails, the script exits with an error so Render stops the
// deploy and keeps the previous version running.
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const { planMigration, BASELINE_MIGRATION } = require('../lib/migration-plan');

function run(cmd) {
  console.log(`[migrate] $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

async function inspectDatabase() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public."_prisma_migrations"')::text AS migrations,
              to_regclass('public."Order"')::text AS orders`
    );
    return { hasMigrationsTable: !!rows[0].migrations, hasAppTables: !!rows[0].orders };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] DATABASE_URL is not set. Set it to the Supabase Session pooler link in Render.');
    process.exit(1);
  }
  const plan = planMigration(await inspectDatabase());
  if (plan.baseline) {
    console.log('[migrate] Existing database without migration history: recording 0_init as already applied (no tables are changed).');
    run(`npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`);
  }
  run('npx prisma migrate deploy');
  // One-off data fixes that are safe to re-run (e.g. the six-pack conversion).
  run('node scripts/ensure-schema.js');
}

main().catch((err) => {
  console.error('[migrate] Failed, stopping the deploy:', err.message);
  process.exit(1);
});
