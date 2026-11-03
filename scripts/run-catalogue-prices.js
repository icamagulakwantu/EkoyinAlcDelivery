// Preview retail repricing by default. Production repricing requires
// APPLY_CATALOGUE_PRICES_ON_DEPLOY=true and is never coupled to SKU edits.
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { run } = require('../prisma/catalogue-update');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[catalogue-prices] DATABASE_URL not set; price preview skipped.');
    return;
  }

  const apply = process.env.APPLY_CATALOGUE_PRICES_ON_DEPLOY === 'true';
  const dryRun = !apply;
  const prisma = new PrismaClient();
  try {
    const { log, unpriced } = await run(prisma, { dryRun, pricesOnly: true });
    const previewLines = log.slice(0, 8);
    for (const line of previewLines) console.log(`[catalogue-prices] ${line}`);
    if (log.length > previewLines.length) {
      console.log(`[catalogue-prices] ... ${log.length - previewLines.length} more price update(s) omitted from build log.`);
    }
    console.log(
      `[catalogue-prices] ${dryRun ? 'Preview only; no prices changed.' : 'Retail repricing applied.'} ${log.length} ${dryRun ? 'planned price update(s)' : 'price update(s)'}. Unpriced products: ${unpriced.join('; ') || 'none'}.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('[catalogue-prices] Failed:', error);
  process.exitCode = 1;
});
