// Read-only catalogue reconciliation. This script never updates, creates,
// renames or deletes database rows. Run with: npm run catalogue:audit
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildPhotoPlan, parseBrandPhotoMap } = require('./catalogue-photo-matching');
const { FORMAT_PHOTO_MAP } = require('./catalogue-photo-config');

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
    select: { id: true, name: true, bottleFormat: true, imageUrl: true, listPriceZAR: true, retailSingleZAR: true },
    orderBy: [{ name: 'asc' }, { bottleFormat: 'asc' }],
  });
  const seedSource = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf-8');
  const brandPhotoMap = parseBrandPhotoMap(seedSource);
  const photoPlan = buildPhotoPlan(rows, brandPhotoMap, FORMAT_PHOTO_MAP, photoExists);

  const removed375Rows = rows.filter(row => row.bottleFormat.includes('375ml'));
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
  if (nameIndex < 0 || formatIndex < 0) throw new Error('SKU CSV is missing name or bottleFormat columns');
  const csvRows = csv.slice(1).map(line => {
    const cells = parseCsvLine(line);
    return { name: cells[nameIndex], bottleFormat: cells[formatIndex] };
  }).filter(row => row.name && row.bottleFormat);

  const liveKeys = new Set(rows.map(row => pairKey(row.name, row.bottleFormat)));
  const csvKeys = new Set(csvRows.map(row => pairKey(row.name, row.bottleFormat)));
  const csvOnly = csvRows.filter(row => !liveKeys.has(pairKey(row.name, row.bottleFormat)));
  const dbOnly = rows.filter(row => !csvKeys.has(pairKey(row.name, row.bottleFormat)));

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
    reconciliation: { csvOnlyCount: csvOnly.length, csvOnly, databaseOnlyCount: dbOnly.length, databaseOnly: dbOnly.map(({ name, bottleFormat }) => ({ name, bottleFormat })) },
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
