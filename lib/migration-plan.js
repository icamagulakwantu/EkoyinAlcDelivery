// lib/migration-plan.js
//
// Decides what scripts/migrate.js should do on a deploy. Pure function, no
// database access, so it can be unit-tested.
//
// The live database was built with `prisma db push` before this project used
// migrations, so it has every table but no "_prisma_migrations" history.
// `prisma migrate deploy` refuses to run on a non-empty database without a
// history (error P3005). The fix is a one-time "baseline": record the first
// migration (0_init, which describes the database as it already is) as
// applied, without running it. After that, only new migrations run.
const BASELINE_MIGRATION = '0_init';

function planMigration({ hasMigrationsTable, hasAppTables }) {
  if (hasMigrationsTable) return { baseline: false, deploy: true };
  if (hasAppTables) return { baseline: true, deploy: true };
  // Brand-new empty database: 0_init creates everything.
  return { baseline: false, deploy: true };
}

module.exports = { planMigration, BASELINE_MIGRATION };
