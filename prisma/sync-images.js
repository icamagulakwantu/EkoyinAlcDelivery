// Local catalogue photo sync, following iCamagu's exact pattern:
//   1. A brand photo is the default for all pack sizes of that product.
//   2. A verified (name, bottleFormat) photo overrides the brand default.
//   3. Every assigned path is checked on disk; if an exact file is missing,
//      the valid brand default is used instead.
//
// Only imageUrl is changed. Prices, stock, SKU IDs and order relationships
// are never touched. Use --dry-run to inspect the plan without writing.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildPhotoPlan } = require('./catalogue-photo-matching');

const prisma = new PrismaClient();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Exact-format overrides are added only when the image is confirmed to show
// the same product and the same pack format as the SKU.
const FORMAT_PHOTO_MAP = {
  '["Budweiser","Can (500ml)"]': '/images/brands/Budweiser-Beer-Can-500ml.webp',
  '["Castle Lite","Dumpy (340ml)"]': '/images/brands/Castlelite340Mldumpies1.png',
  '["Windhoek Draught","Can (440ml)"]': '/images/brands/windhoek-draught-can.png',
  '["Bonaqua Still Water","500ml"]': '/images/brands/bonaqua-still-water.png',
};

const UNPRICED_PRODUCTS = [
  {
    name: 'Budweiser',
    bottleFormat: 'Can (500ml)',
    category: 'BEER',
    productType: 'ALCOHOL',
    supplierPortfolio: 'SAB',
    unitsPerCase: 24,
    retailCaseDiscountPct: 8,
    imageUrl: '/images/brands/Budweiser-Beer-Can-500ml.webp',
  },
];

// Read BRAND_PHOTO_MAP from seed.js so the existing catalogue remains the
// single source of truth for normal brand-level photos.
function loadBrandPhotoMap() {
  const source = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf-8');
  const start = source.indexOf('const BRAND_PHOTO_MAP = {');
  if (start === -1) return {};
  const end = source.indexOf('\n};', start);
  if (end === -1) throw new Error('Could not find the end of BRAND_PHOTO_MAP in prisma/seed.js');
  const block = source.slice(start, end);
  const map = {};
  const entry = /^\s*'((?:[^'\\]|\\.)*)':\s*'([^']*)',?\s*$/gm;
  let match;
  while ((match = entry.exec(block))) map[match[1].replace(/\\'/g, "'")] = match[2];
  return map;
}

function photoExists(urlPath) {
  return fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(urlPath)));
}

async function syncPhotos({ dryRun = false } = {}) {
  const rows = await prisma.skuItem.findMany({ select: { id: true, name: true, bottleFormat: true } });
  const plan = buildPhotoPlan(rows, loadBrandPhotoMap(), FORMAT_PHOTO_MAP, photoExists);
  let linked = 0;
  for (const assignment of plan.assignments) {
    if (!dryRun) {
      await prisma.skuItem.update({
        where: { id: assignment.id },
        data: { imageUrl: assignment.imageUrl },
      });
    }
    linked++;
  }

  for (const missing of plan.missingAssets) {
    console.error(`[sync-images] Missing local asset: ${missing.imageUrl} (${missing.name}, ${missing.bottleFormat})`);
  }
  console.log(`[sync-images] ${dryRun ? 'Would link' : 'Linked'} ${linked} photo(s): ${plan.assignments.filter(x => x.matchType === 'format').length} exact-format, ${plan.assignments.filter(x => x.matchType === 'brand').length} brand fallback.`);
  console.log(`[sync-images] ${plan.unmatched.length} SKU row(s) have no local mapped photo.`);
  return { ...plan, linked, dryRun };
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
  const dryRun = process.argv.includes('--dry-run');
  await syncPhotos({ dryRun });
  await addUnpricedProducts({ dryRun });
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
