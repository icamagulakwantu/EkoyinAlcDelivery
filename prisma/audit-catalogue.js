// Read-only catalogue reconciliation. This script never updates, creates,
// renames or deletes database rows. Run with: npm run catalogue:audit
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildPhotoPlan, parseBrandPhotoMap } = require('./catalogue-photo-matching');
const { FORMAT_PHOTO_MAP, UNPRICED_PRODUCTS } = require('./catalogue-photo-config');
const C = require('../lib/catalogue-2026-11');

const prisma = new PrismaClient();
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function photoExists(urlPath) {
  return fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(urlPath)));
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      value += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += ch;
    }
  }
  cells.push(value.trim());
  return cells;
}

function pairKey(name, bottleFormat) {
  return JSON.stringify([name, bottleFormat]);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[catalogue:audit] DATABASE_URL not set; read-only audit skipped.');
    return;
  }
  const rows = await prisma.skuItem.findMany({
    select: { id: true, name: true, category: true, bottleFormat: true, imageUrl: true, listPriceZAR: true, retailSingleZAR: true, retailCaseZAR: true, unitsPerCase: true, retailCaseDiscountPct: true, packSize: true },
    orderBy: [{ name: 'asc' }, { bottleFormat: 'asc' }],
  });
  const seedSource = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf-8');
  const brandPhotoMap = parseBrandPhotoMap(seedSource);
  const photoPlan = buildPhotoPlan(rows, brandPhotoMap, FORMAT_PHOTO_MAP, photoExists);

  const removed375Rows = rows.filter(row => C.isRemovedSize(row.bottleFormat, row.category));
  const [orderCount, orderItemCount, orderItemsReferencing375ml] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    removed375Rows.length
      ? prisma.orderItem.count({ where: { skuId: { in: removed375Rows.map(row => row.id) } } })
      : Promise.resolve(0),
  ]);

  const csv = fs.readFileSync(path.join(__dirname, 'data', 'skus.csv'), 'utf-8').trim().split(/\r?\n/);
  const headers = parseCsvLine(csv[0]);
  const nameIndex = headers.indexOf('name');
  const formatIndex = headers.indexOf('bottleFormat');
  const categoryIndex = headers.indexOf('category');
  if (nameIndex < 0 || formatIndex < 0 || categoryIndex < 0) throw new Error('SKU CSV is missing name, category or bottleFormat columns');
  const csvRows = csv.slice(1).map(line => {
    const cells = parseCsvLine(line);
    return { name: cells[nameIndex], category: cells[categoryIndex], bottleFormat: cells[formatIndex] };
  }).filter(row => row.name && row.bottleFormat);

  // Build the expected post-correction SKU set from the supplier CSV:
  // normalize founder-approved names/formats, retire 375ml, then add the
  // three approved catalogue additions. This is the correct comparison after
  // the structure-only update has been applied.
  const expectedRows = [];
  for (const sourceRow of csvRows) {
    let name = sourceRow.name;
    let bottleFormat = sourceRow.bottleFormat;
    for (const fix of C.NAME_FIXES) if (name === fix.from) name = fix.to;
    for (const fix of C.FORMAT_FIXES) {
      if (bottleFormat === fix.from && (fix.name === null || fix.name === name)) bottleFormat = fix.to;
    }
    if (C.isRemovedSize(bottleFormat, sourceRow.category)) continue;
    expectedRows.push({ name, bottleFormat });
  }
  for (const product of C.NEW_PRODUCTS) expectedRows.push({ name: product.name, bottleFormat: product.bottleFormat });
  for (const product of UNPRICED_PRODUCTS) expectedRows.push({ name: product.name, bottleFormat: product.bottleFormat });

  const liveKeys = new Set(rows.map(row => pairKey(row.name, row.bottleFormat)));
  const csvKeys = new Set(csvRows.map(row => pairKey(row.name, row.bottleFormat)));
  const expectedKeys = new Set(expectedRows.map(row => pairKey(row.name, row.bottleFormat)));
  const csvOnly = csvRows.filter(row => !liveKeys.has(pairKey(row.name, row.bottleFormat)));
  const dbOnly = rows.filter(row => !csvKeys.has(pairKey(row.name, row.bottleFormat)));
  const expectedOnly = expectedRows.filter(row => !liveKeys.has(pairKey(row.name, row.bottleFormat)));
  const unexpectedLive = rows.filter(row => !expectedKeys.has(pairKey(row.name, row.bottleFormat)));

  const priceMismatches = [];
  const unpricedRows = [];
  const unexpectedUnpricedRows = [];
  const intendedUnpricedKeys = new Set(UNPRICED_PRODUCTS.map(product => pairKey(product.name, product.bottleFormat)));
  for (const row of rows.filter(row => row.productType === 'ALCOHOL')) {
    const expectedSingle = C.newSinglePrice(row);
    if (expectedSingle === null) {
      const unpriced = { name: row.name, bottleFormat: row.bottleFormat };
      unpricedRows.push(unpriced);
      if (!intendedUnpricedKeys.has(pairKey(row.name, row.bottleFormat))) unexpectedUnpricedRows.push(unpriced);
      continue;
    }
    const expectedCase = C.casePrice(expectedSingle, row.unitsPerCase, row.retailCaseDiscountPct);
    if (Math.abs(Number(row.retailSingleZAR) - expectedSingle) > 0.005 ||
        Math.abs(Number(row.retailCaseZAR) - expectedCase) > 0.005) {
      priceMismatches.push({
        name: row.name,
        bottleFormat: row.bottleFormat,
        actualSingle: row.retailSingleZAR,
        expectedSingle,
        actualCase: row.retailCaseZAR,
        expectedCase,
      });
    }
  }

  const pairCounts = new Map();
  for (const row of rows) {
    const key = pairKey(row.name, row.bottleFormat);
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const duplicates = [...pairCounts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ sku: JSON.parse(key), count }));

  const imageHosts = {};
  for (const row of rows) {
    if (!row.imageUrl) continue;
    let host = 'local-or-relative';
    try { host = new URL(row.imageUrl).hostname; } catch (_) {}
    imageHosts[host] = (imageHosts[host] || 0) + 1;
  }

  const unmatchedProducts = [...new Map(photoPlan.unmatched.map(row => [
    row.name, { name: row.name, formats: [] },
  ])).values()];
  for (const row of photoPlan.unmatched) {
    const item = unmatchedProducts.find(x => x.name === row.name);
    if (item && !item.formats.includes(row.bottleFormat)) item.formats.push(row.bottleFormat);
  }

  const report = {
    readOnly: true,
    liveSkuRows: rows.length,
    csvSkuRows: csvRows.length,
    distinctLiveProductNames: new Set(rows.map(row => row.name)).size,
    duplicateNameFormatPairs: duplicates,
    reconciliation: {
      rawCsvVsLive: {
        csvOnlyCount: csvOnly.length,
        databaseOnlyCount: dbOnly.length,
      },
      correctedCatalogueVsLive: {
        expectedSkuRows: expectedRows.length,
        missingExpectedCount: expectedOnly.length,
        missingExpected: expectedOnly,
        unexpectedLiveCount: unexpectedLive.length,
        unexpectedLive: unexpectedLive.map(({ name, bottleFormat }) => ({ name, bottleFormat })),
      },
      approvedNewProducts: C.NEW_PRODUCTS.map(({ name, bottleFormat }) => ({ name, bottleFormat })),
    },
    orderHistory: {
      orders: orderCount,
      orderItems: orderItemCount,
      orderItemsReferencing375mlCandidates: orderItemsReferencing375ml,
      note: 'SKU retirement nulls only the optional skuId; OrderItem name, price and quantity snapshots remain.',
    },
    packLabels: {
      removed375mlCandidates: removed375Rows.length,
      dumpy340mlCandidates: rows.filter(row => row.bottleFormat === 'Dumpy (340ml)').length,
    },
    priceIntegrity: {
      mismatchCount: priceMismatches.length,
      mismatches: priceMismatches,
      unpricedCount: unpricedRows.length,
      unpricedRows,
      unexpectedUnpricedCount: unexpectedUnpricedRows.length,
      unexpectedUnpricedRows,
    },
    currentImageSources: imageHosts,
    localPhotoPlan: {
      wouldAssignTotal: photoPlan.assignments.length,
      exactFormatAssignments: photoPlan.assignments.filter(row => row.matchType === 'format').length,
      brandFallbackAssignments: photoPlan.assignments.filter(row => row.matchType === 'brand').length,
      missingLocalAssets: photoPlan.missingAssets,
      unmatchedSkuRows: photoPlan.unmatched.length,
      unmatchedProducts,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(error => {
    console.error('[catalogue:audit] Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
