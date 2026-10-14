// prisma/sync-images.js
//
// Runs on every Render deploy (see render.yaml's buildCommand), right after
// the database tables are in place. It does two small, safe things:
//
//  1. Points each product at its photo in public/images/brands, using the
//     same name -> photo list that prisma/seed.js already holds. Only photos
//     that really exist on disk are used, and ONLY imageUrl is touched —
//     prices, stock and everything else stay exactly as they are.
//  2. Adds products that have a photo but no price yet (see UNPRICED_PRODUCTS).
//     They are created once with a price of 0, shown in the shop as
//     "Price coming soon", and cannot be ordered until a real price is set.
//     Re-running never overwrites a price that was filled in later.
//
// Never fails the deploy: any error is logged and the script exits normally.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Products that have a photo but no price yet. Add a line here (and drop the
// photo into public/images/brands) to list another "price coming soon" item.
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

// Reads the BRAND_PHOTO_MAP block out of seed.js as plain text, so the photo
// list lives in exactly one place.
function loadBrandPhotoMap() {
  const source = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf-8');
  const start = source.indexOf('const BRAND_PHOTO_MAP = {');
  if (start === -1) return {};
  const end = source.indexOf('\n};', start);
  const block = source.slice(start, end);

  const map = {};
  const entry = /^\s*'((?:[^'\\]|\\.)*)':\s*'([^']*)',?\s*$/gm;
  let match;
  while ((match = entry.exec(block))) {
    map[match[1].replace(/\\'/g, "'")] = match[2];
  }
  return map;
}

function photoExists(urlPath) {
  return fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(urlPath)));
}

async function syncPhotos() {
  const map = loadBrandPhotoMap();
  let linked = 0;
  for (const [name, urlPath] of Object.entries(map)) {
    if (!photoExists(urlPath)) continue;
    const { count } = await prisma.skuItem.updateMany({ where: { name }, data: { imageUrl: urlPath } });
    linked += count;
  }
  console.log(`[sync-images] Linked photos on ${linked} product rows.`);
}

async function addUnpricedProducts() {
  let added = 0;
  for (const p of UNPRICED_PRODUCTS) {
    if (!photoExists(p.imageUrl)) continue;
    const existing = await prisma.skuItem.findUnique({
      where: { name_bottleFormat: { name: p.name, bottleFormat: p.bottleFormat } },
    });
    if (existing) {
      await prisma.skuItem.update({ where: { id: existing.id }, data: { imageUrl: p.imageUrl } });
      continue;
    }
    await prisma.skuItem.create({
      data: {
        name: p.name,
        bottleFormat: p.bottleFormat,
        category: p.category,
        productType: p.productType,
        supplierPortfolio: p.supplierPortfolio,
        unitsPerCase: p.unitsPerCase,
        // No price yet — everything money-related starts at 0.
        listPriceZAR: 0,
        supplierCaseDiscountPct: 0,
        supplierCasePriceZAR: 0,
        palletPackQty: 0,
        supplierPalletDiscountPct: 0,
        supplierPalletPriceZAR: 0,
        retailSingleZAR: 0,
        retailCaseDiscountPct: p.retailCaseDiscountPct,
        retailCaseZAR: 0,
        imageUrl: p.imageUrl,
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

main()
  .catch((err) => {
    console.warn('[sync-images] Failed (deploy continues):', err.message);
  })
  .finally(() => prisma.$disconnect());
