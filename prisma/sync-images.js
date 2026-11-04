// Local catalogue photo sync, following iCamagu's exact pattern:
//   1. A brand photo is the default for all pack sizes of that product.
//   2. A verified (name, bottleFormat) photo overrides the brand default.
//   3. Every assigned path is checked on disk; if an exact file is missing,
//      the valid brand default is used instead.
//
// Only imageUrl is changed. Prices, stock, SKU IDs and order relationships
// are never touched. Use --dry-run to inspect the plan without writing.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildPhotoPlan, parseBrandPhotoMap } = require('./catalogue-photo-matching');
const { FORMAT_PHOTO_MAP, UNPRICED_PRODUCTS } = require('./catalogue-photo-config');

const prisma = new PrismaClient();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');



// Read BRAND_PHOTO_MAP from seed.js so the existing catalogue remains the
// single source of truth for normal brand-level photos.
function loadBrandPhotoMap() {
  const source = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf-8');
  return parseBrandPhotoMap(source);
}

function photoExists(urlPath) {
  return fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(urlPath)));
}

async function syncPhotos({ dryRun = false } = {}) {
  const rows = await prisma.skuItem.findMany({ select: { id: true, name: true, bottleFormat: true, imageUrl: true } });
  const plan = buildPhotoPlan(rows, loadBrandPhotoMap(), FORMAT_PHOTO_MAP, photoExists);
  let updated = 0;
  let unchanged = 0;
  let clearedUnsafeFallbacks = 0;
  const currentImages = new Map(rows.map(row => [row.id, row.imageUrl]));
  for (const assignment of plan.assignments) {
    if (currentImages.get(assignment.id) === assignment.imageUrl) {
      unchanged++;
      continue;
    }
    if (!dryRun) {
      await prisma.skuItem.update({
        where: { id: assignment.id },
        data: { imageUrl: assignment.imageUrl },
      });
    }
    updated++;
  }

  // If an older sync stored a brand photo on a multi-format SKU, clear only
  // that known unsafe fallback when no exact packshot exists. The storefront
  // then shows its neutral placeholder instead of a misleading pack format.
  for (const missing of plan.missingAssets.filter(item => item.matchType === 'unsafe-brand-fallback')) {
    const row = rows.find(item => item.name === missing.name && item.bottleFormat === missing.bottleFormat);
    if (!row || currentImages.get(row.id) !== missing.imageUrl) continue;
    if (!dryRun) {
      await prisma.skuItem.update({ where: { id: row.id }, data: { imageUrl: null } });
    }
    clearedUnsafeFallbacks++;
  }

  for (const missing of plan.missingAssets) {
    console.error(`[sync-images] Missing/unsafe local asset: ${missing.imageUrl} (${missing.name}, ${missing.bottleFormat})`);
  }
  console.log(`[sync-images] ${dryRun ? 'Would update' : 'Updated'} ${updated} photo(s); ${unchanged} already current; ${dryRun ? 'would clear' : 'cleared'} ${clearedUnsafeFallbacks} unsafe cross-format fallback(s).`);
  console.log(`[sync-images] ${plan.unmatched.length} SKU row(s) have no verified exact-format photo.`);
  return { ...plan, updated, unchanged, clearedUnsafeFallbacks, dryRun };
}

async function addUnpricedProducts({ dryRun = false } = {}) {
  let added = 0;
  let relinked = 0;
  for (const p of UNPRICED_PRODUCTS) {
    if (!photoExists(p.imageUrl)) {
      console.error(`[sync-images] Cannot add ${p.name} ${p.bottleFormat}: local image is missing.`);
      continue;
    }
    const existing = await prisma.skuItem.findUnique({
      where: { name_bottleFormat: { name: p.name, bottleFormat: p.bottleFormat } },
    });
    if (existing) {
      if (existing.imageUrl !== p.imageUrl) {
        if (!dryRun) {
          await prisma.skuItem.update({ where: { id: existing.id }, data: { imageUrl: p.imageUrl } });
        }
        relinked++;
      }
      continue;
    }
    if (!dryRun) {
      await prisma.skuItem.create({
        data: {
          name: p.name, bottleFormat: p.bottleFormat, category: p.category,
          productType: p.productType, supplierPortfolio: p.supplierPortfolio,
          unitsPerCase: p.unitsPerCase, listPriceZAR: 0,
          supplierCaseDiscountPct: 0, supplierCasePriceZAR: 0,
          palletPackQty: 0, supplierPalletDiscountPct: 0, supplierPalletPriceZAR: 0,
          retailSingleZAR: 0, retailCaseDiscountPct: p.retailCaseDiscountPct,
          retailCaseZAR: 0, imageUrl: p.imageUrl,
        },
      });
    }
    added++;
  }
  console.log(`[sync-images] ${dryRun ? 'Would add' : 'Added'} ${added} unpriced product(s); ${dryRun ? 'would relink' : 'relinked'} ${relinked} existing product(s).`);
  return { added, relinked, dryRun };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[sync-images] DATABASE_URL not set; local photo sync skipped.');
    return;
  }
  const dryRun = process.argv.includes('--dry-run');
  const includeUnpriced = process.argv.includes('--include-unpriced') || process.env.APPLY_UNPRICED_SKUS_ON_DEPLOY === 'true';
  await syncPhotos({ dryRun });
  if (includeUnpriced) await addUnpricedProducts({ dryRun });
  console.log(`[sync-images] ${dryRun ? 'Dry run complete; no database rows were changed.' : 'Photo sync complete.'}`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('[sync-images] Catalogue image sync failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = {
  FORMAT_PHOTO_MAP,
  UNPRICED_PRODUCTS,
  loadBrandPhotoMap,
  photoExists,
  syncPhotos,
  addUnpricedProducts,
};
