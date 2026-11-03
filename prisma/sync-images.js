// Local catalogue photo sync. Pack-specific mappings always win. A general
// brand photo is only assigned when that brand has one SKU format; multi-format
// brands need an exact (name, bottleFormat) photo. This follows iCamagu's
// format-specific matching and prevents bottle photos being reused on cans,
// quarts and dumpies.
//
// Only imageUrl is changed. Prices, stock, IDs and order relationships remain
// untouched. Errors fail visibly so a broken catalogue sync cannot silently pass.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { resolvePhotoAssignments } = require('./catalogue-photo-matching');

const prisma = new PrismaClient();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Add only after confirming the local asset depicts this exact pack format.
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

// Read BRAND_PHOTO_MAP from seed.js; it is a fallback for single-format SKUs.
function loadBrandPhotoMap() {
  const source = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf-8');
  const start = source.indexOf('const BRAND_PHOTO_MAP = {');
  if (start === -1) return {};
  const end = source.indexOf('\n};', start);
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

async function syncPhotos() {
  const rows = await prisma.skuItem.findMany({ select: { id: true, name: true, bottleFormat: true } });
  const assignments = resolvePhotoAssignments(rows, loadBrandPhotoMap(), FORMAT_PHOTO_MAP);
  const counts = new Map();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) || 0) + 1);
  const multiFormatCount = [...counts.values()].filter((count) => count > 1).length;
  let linked = 0;
  let missing = 0;
  for (const assignment of assignments) {
    if (!photoExists(assignment.imageUrl)) {
      missing++;
      console.error(`[sync-images] Missing local asset: ${assignment.imageUrl} (${assignment.name}, ${assignment.bottleFormat})`);
      continue;
    }
    await prisma.skuItem.update({ where: { id: assignment.id }, data: { imageUrl: assignment.imageUrl } });
    linked++;
  }
  console.log(`[sync-images] Linked ${linked} local photo(s); ${missing} missing asset(s); ${multiFormatCount} multi-format brand(s) need exact pack photos.`);
}

async function addUnpricedProducts() {
  let added = 0;
  for (const p of UNPRICED_PRODUCTS) {
    if (!photoExists(p.imageUrl)) continue;
    const existing = await prisma.skuItem.findUnique({
      where: { name_bottleFormat: { name: p.name, bottleFormat: p.bottleFormat } },
    });
    if (existing) {
      if (existing.imageUrl !== p.imageUrl) {
        await prisma.skuItem.update({ where: { id: existing.id }, data: { imageUrl: p.imageUrl } });
      }
      continue;
    }
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
    added++;
  }
  console.log(`[sync-images] Added ${added} "price coming soon" products.`);
}

async function main() {
  await syncPhotos();
  await addUnpricedProducts();
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('[sync-images] Catalogue image sync failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { loadBrandPhotoMap, photoExists, syncPhotos, addUnpricedProducts };
