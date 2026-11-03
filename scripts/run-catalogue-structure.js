// Run the SKU structure update in dry-run mode by default.
// Production changes require APPLY_CATALOGUE_STRUCTURE_ON_DEPLOY=true.
// Retail repricing is never run by this script.
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { run } = require('../prisma/catalogue-update');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[catalogue-structure] DATABASE_URL not set; preview skipped.');
    return;
  }

  const apply = process.env.APPLY_CATALOGUE_STRUCTURE_ON_DEPLOY === 'true';
  const dryRun = !apply;
  const prisma = new PrismaClient();
  try {
    const { log, unpriced } = await run(prisma, { dryRun, structureOnly: true });
    for (const line of log) console.log(`[catalogue-structure] ${line}`);
    console.log(
      `[catalogue-structure] ${dryRun ? 'Preview only; no SKU rows changed.' : 'SKU structure update applied.'} ${log.length} ${dryRun ? 'planned change(s)' : 'change(s)'}. Retail prices were not changed.`
    );
    if (unpriced.length) console.log(`[catalogue-structure] Unpriced rows: ${unpriced.join('; ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('[catalogue-structure] Failed:', error);
  process.exitCode = 1;
});
