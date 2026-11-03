// prisma/catalogue-update.js
//
// Applies the November 2026 SKU and pricing corrections in
// lib/catalogue-2026-11.js. Product photography is owned exclusively by
// prisma/sync-images.js, which uses local public/ assets and exact-format
// overrides. This updater must never replace those local paths with CDN URLs.
// Also runs at the end of `npm run seed`.
//   1. fixes wrong names and pack labels (rows are moved, never duplicated;
//      an old-label copy of a row that already exists is removed);
//   2. removes every 375ml product (past orders keep their item names and
//      prices: OrderItem.skuId is set to null, nothing else changes);
//   3. adds the few products the owner sent photos of;
//   4. prices every product at retail + 25% (checked shop price when we have
//      one, otherwise the product's list price);
//   5. puts founder photos on the exact pack they show.
// Every step writes fixed values worked out from a base that never changes,
// so re-running changes nothing and never adds 25% twice.
// Never fails the deploy: errors are logged and the script exits normally.

const C = require('../lib/catalogue-2026-11.js');

const SELECT = {
  id: true, name: true, bottleFormat: true, category: true, productType: true,
  supplierPortfolio: true, unitsPerCase: true, packSize: true, listPriceZAR: true,
  retailSingleZAR: true, retailCaseZAR: true, retailCaseDiscountPct: true, imageUrl: true,
};

function key(name, bottleFormat) {
  return `${name}\u0000${bottleFormat}`;
}

async function moveRow(prisma, rows, row, data, log) {
  const name = data.name ?? row.name;
  const bottleFormat = data.bottleFormat ?? row.bottleFormat;
  if (rows.has(key(name, bottleFormat))) {
    // The corrected row already exists (e.g. `npm run seed` re-created the
    // old label from skus.csv). Drop the old-label duplicate; past orders
    // keep their item names and prices (OrderItem.skuId becomes null).
    await prisma.skuItem.delete({ where: { id: row.id } });
    rows.delete(key(row.name, row.bottleFormat));
    log.push(`removed duplicate: ${row.name} ${row.bottleFormat} (kept ${name} ${bottleFormat})`);
    return;
  }
  await prisma.skuItem.update({ where: { id: row.id }, data });
  rows.delete(key(row.name, row.bottleFormat));
  Object.assign(row, { name, bottleFormat });
  rows.set(key(name, bottleFormat), row);
  log.push(`renamed: ${name} ${bottleFormat}`);
}

async function fixLabels(prisma, rows, log) {
  for (const fix of C.NAME_FIXES) {
    for (const row of [...rows.values()].filter((r) => r.name === fix.from)) {
      await moveRow(prisma, rows, row, { name: fix.to }, log);
    }
  }
  for (const fix of C.FORMAT_FIXES) {
    const matches = [...rows.values()].filter(
      (r) => r.bottleFormat === fix.from && (fix.name === null || r.name === fix.name),
    );
    for (const row of matches) await moveRow(prisma, rows, row, { bottleFormat: fix.to }, log);
  }
}

async function removeSmallBottles(prisma, rows, log) {
  for (const row of [...rows.values()].filter((r) => C.isRemovedSize(r.bottleFormat))) {
    await prisma.skuItem.delete({ where: { id: row.id } });
    rows.delete(key(row.name, row.bottleFormat));
    log.push(`removed: ${row.name} ${row.bottleFormat}`);
  }
}

async function addNewProducts(prisma, rows, log) {
  for (const p of C.NEW_PRODUCTS) {
    if (rows.has(key(p.name, p.bottleFormat))) continue;
    const like = [...rows.values()].find((r) => r.name === p.like);
    if (!like) {
      log.push(`skip: no "${p.like}" row to copy for ${p.name}`);
      continue;
    }
    const shop = C.shopPriceFor(p.name, p.bottleFormat);
    const created = await prisma.skuItem.create({
      data: {
        name: p.name,
        bottleFormat: p.bottleFormat,
        category: like.category,
        productType: like.productType,
        supplierPortfolio: like.supplierPortfolio,
        unitsPerCase: p.unitsPerCase,
        packSize: 1,
        // The retail shop price is the base; step 4 sets the selling price.
        listPriceZAR: shop ? Math.round(shop.unit * 100) / 100 : 0,
        supplierCaseDiscountPct: 0, supplierCasePriceZAR: 0,
        palletPackQty: 0, supplierPalletDiscountPct: 0, supplierPalletPriceZAR: 0,
        retailSingleZAR: 0,
        retailCaseDiscountPct: like.retailCaseDiscountPct,
        retailCaseZAR: 0,
        // Photos are filled later by the local /images/ synchroniser.
        imageUrl: null,
      },
      select: SELECT,
    });
    rows.set(key(created.name, created.bottleFormat), created);
    log.push(`added: ${p.name} ${p.bottleFormat}`);
  }
}

async function applyPrices(prisma, rows, log) {
  const unpriced = [];
  for (const row of rows.values()) {
    const data = {};
    const single = C.newSinglePrice(row);
    if (single !== null) {
      const caseZAR = C.casePrice(single, row.unitsPerCase, row.retailCaseDiscountPct);
      if (row.retailSingleZAR !== single || row.retailCaseZAR !== caseZAR) {
        data.retailSingleZAR = single;
        data.retailCaseZAR = caseZAR;
      }
    } else {
      unpriced.push(`${row.name} ${row.bottleFormat}`);
    }
    // Do not set imageUrl here. prisma/sync-images.js owns all photo
    // assignments and only writes verified local /images/ paths.
    if (Object.keys(data).length === 0) continue;
    await prisma.skuItem.update({ where: { id: row.id }, data });
    Object.assign(row, data);
    log.push(`updated: ${row.name} ${row.bottleFormat} ${JSON.stringify(data)}`);
  }
  return unpriced;
}

async function run(prisma) {
  const all = await prisma.skuItem.findMany({ select: SELECT });
  const rows = new Map(all.map((r) => [key(r.name, r.bottleFormat), r]));
  const log = [];
  await fixLabels(prisma, rows, log);
  await removeSmallBottles(prisma, rows, log);
  await addNewProducts(prisma, rows, log);
  const unpriced = await applyPrices(prisma, rows, log);
  return { log, unpriced };
}

module.exports = { run };

if (require.main === module) {
  require('dotenv').config();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  run(prisma)
    .then(({ log, unpriced }) => {
      for (const line of log) console.log(`[catalogue] ${line}`);
      console.log(`[catalogue] ${log.length} change(s). ${unpriced.length} product(s) with no price at all: ${unpriced.join('; ') || 'none'}.`);
    })
    .catch((err) => console.warn('[catalogue] Failed (deploy continues):', err.message))
    .finally(() => prisma.$disconnect());
}
