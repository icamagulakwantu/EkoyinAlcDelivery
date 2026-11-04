// test/catalogue.test.js — run with `node --test`
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../lib/catalogue-2026-11.js');
const { run } = require('../prisma/catalogue-update.js');

test('tavern rounding: rand under R50, R5 under R200, R10 above', () => {
  assert.equal(C.roundTavern(26.6), 27);
  assert.equal(C.roundTavern(193.7), 195);
  assert.equal(C.roundTavern(299.99), 300);
  assert.equal(C.roundTavern(0), 0);
  assert.equal(C.roundTavern('abc'), 0);
});

test('25% uplift uses the higher of checked shop and iCamagu retail prices', () => {
  assert.equal(C.newSinglePrice({ name: 'Hennessy VS', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 400 }), 620);
  assert.equal(C.newSinglePrice({ name: 'Johnnie Walker Red Label', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 269.73 }), 340);
  assert.equal(C.newSinglePrice({ name: 'Klipdrift Export', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 189.99 }), 240);
});

test('no checked shop price: list (retail) price + 25%', () => {
  // Bombay Sapphire R310 -> R387.50 -> R390
  assert.equal(C.newSinglePrice({ name: 'Bombay Sapphire', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 310 }), 390);
  // Castle Lager R14 each, sold as a six-pack -> R105
  assert.equal(C.newSinglePrice({ name: 'Castle Lager', bottleFormat: 'Dumpy (330ml)', packSize: 6, listPriceZAR: 14 }), 105);
  // No base price at all: stays "Price coming soon"
  assert.equal(C.newSinglePrice({ name: 'Unknown', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 0 }), null);
});

test('six-pack rows are priced for the whole pack', () => {
  // Heineken 24 x 330ml at R339.99 -> R85 per six, +25% -> R105
  assert.equal(C.newSinglePrice({ name: 'Heineken', bottleFormat: 'Dumpy (330ml)', packSize: 6 }), 105);
});

test('every new price is at or above the retail price', () => {
  for (const p of C.SHOP_PRICES) {
    const pack = /^(Dumpy|Can)/.test(p.bottleFormat) ? 6 : 1;
    const ours = C.newSinglePrice({ ...p, packSize: pack });
    assert.ok(ours >= p.unit * pack, `${p.name} ${p.bottleFormat}: R${ours} < shop`);
  }
  for (const list of [9.99, 14, 46.05, 169.99, 5500]) {
    assert.ok(C.tavernPrice(list) >= list * 1.2, `list R${list}`);
  }
});

test('375ml is removed only for spirits, not beer, cider/RTD or wine', () => {
  for (const category of ['BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA', 'VODKA_PREMIUM', 'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'RUM']) {
    assert.equal(C.isRemovedSize('375ml Bottle', category), true, `${category} 375ml`);
  }
  for (const category of ['BEER', 'CIDER_RTD', 'WINE', 'WINE_BOX', 'SPARKLING', 'CHAMPAGNE', 'MIXER', 'WATER']) {
    assert.equal(C.isRemovedSize('375ml Bottle', category), false, `${category} 375ml must remain`);
  }
  assert.equal(C.isRemovedSize('750ml Bottle', 'WHISKY'), false);
  assert.equal(C.isRemovedSize('Can (500ml)', 'VODKA'), false);
});

// Minimal stand-in for the Prisma client: just what the runner uses.
function fakePrisma(rows, orderItems = []) {
  let next = 1;
  const db = rows.map((r) => ({ id: `r${next++}`, imageUrl: null, packSize: 1, listPriceZAR: 0, retailCaseZAR: 0, retailCaseDiscountPct: 5, unitsPerCase: 12, category: 'WHISKY', productType: 'ALCOHOL', supplierPortfolio: 'X', ...r }));
  return {
    db,
    orderItems,
    orderItem: {
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const item of orderItems) if (item.skuId === where.skuId) { Object.assign(item, data); count++; }
        return { count };
      },
    },
    skuItem: {
      findMany: async () => db.map((r) => ({ ...r })),
      update: async ({ where, data }) => Object.assign(db.find((r) => r.id === where.id), data),
      delete: async ({ where }) => db.splice(db.findIndex((r) => r.id === where.id), 1),
      create: async ({ data }) => { const row = { id: `r${next++}`, ...data }; db.push(row); return { ...row }; },
    },
  };
}

test('runner: fixes labels, removes 375ml, prices everything, and is repeatable', async () => {
  const prisma = fakePrisma([
    { name: 'Hennessy VS', bottleFormat: '750ml Bottle', listPriceZAR: 528, retailSingleZAR: 528 },
    { name: 'Hennessy VS', bottleFormat: '375ml Bottle', category: 'COGNAC', listPriceZAR: 340, retailSingleZAR: 340 },
    { name: 'Cider 375ml', bottleFormat: 'Dumpy (375ml)', category: 'CIDER_RTD', listPriceZAR: 12, retailSingleZAR: 12 },
    { name: 'Heineken', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6, unitsPerCase: 4, retailCaseDiscountPct: 8 },
    { name: 'Windhoek Lager/Light', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6 },
    { name: 'Stella Artois', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 18, retailSingleZAR: 108, packSize: 6 },
    { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', listPriceZAR: 170, retailSingleZAR: 170 },
    { name: 'Bombay Sapphire', bottleFormat: '750ml Bottle', listPriceZAR: 310, retailSingleZAR: 310 },
  ], [{ id: 'oi1', skuId: 'r2', name: 'Hennessy VS 375ml', price: 340, quantity: 1 }]);
  const first = await run(prisma);
  const find = (n, f) => prisma.db.find((r) => r.name === n && r.bottleFormat === f);

  assert.equal(find('Hennessy VS', '375ml Bottle'), undefined);
  assert.equal(prisma.orderItems[0].skuId, null, 'retired SKU must detach from order item');
  assert.deepEqual({ name: prisma.orderItems[0].name, price: prisma.orderItems[0].price, quantity: prisma.orderItems[0].quantity }, { name: 'Hennessy VS 375ml', price: 340, quantity: 1 }, 'order snapshot must remain unchanged');
  assert.ok(find('Cider 375ml', 'Dumpy (375ml)'), '375ml cider must remain in the catalogue');
  assert.equal(find('Hennessy VS', '750ml Bottle').retailSingleZAR, 620);
  // Product photos are assigned separately by prisma/sync-images.js from local assets.
  assert.equal(find('Hennessy VS', '750ml Bottle').imageUrl, null);
  const heineken = find('Heineken', 'Dumpy (330ml)');
  assert.equal(heineken.retailSingleZAR, 120);
  assert.equal(heineken.retailCaseZAR, 441.6); // 120 x 4 six-packs - 8%
  // No checked price: list price + 25%
  assert.equal(find('Windhoek Lager', 'Dumpy (330ml)').retailSingleZAR, 120); // 16 x 6 x 1.25
  assert.equal(find('Stella Artois', 'Dumpy (330ml)').retailSingleZAR, 135); // 18 x 6 x 1.25
  assert.equal(find('Bombay Sapphire', '750ml Bottle').retailSingleZAR, 390);
  assert.equal(find('Strettons London Dry', '750ml Bottle').retailSingleZAR, 210);
  assert.deepEqual(first.unpriced, []);

  const second = await run(prisma);
  assert.deepEqual(second.log, [], 'second run changes nothing (no double markup)');
});

test('runner: an old-label duplicate is removed, not kept twice', async () => {
  const prisma = fakePrisma([
    { name: 'Castle Lager', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 14, retailSingleZAR: 84, packSize: 6 },
    { name: 'Castle Lager', bottleFormat: 'Dumpy (330ml)', listPriceZAR: 14, retailSingleZAR: 90, packSize: 6 },
  ]);
  const { log } = await run(prisma);
  assert.equal(prisma.db.length, 1);
  assert.equal(prisma.db[0].bottleFormat, 'Dumpy (330ml)');
  assert.equal(prisma.db[0].retailSingleZAR, 105);
  assert.ok(log.some((l) => l.startsWith('removed duplicate:')));
});


test('dry-run previews catalogue changes without calling database write methods', async () => {
  const prisma = fakePrisma([
    { name: 'Hennessy VS', bottleFormat: '375ml Bottle', listPriceZAR: 340, retailSingleZAR: 340 },
    { name: 'Heineken', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6 },
    { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', listPriceZAR: 170, retailSingleZAR: 170 },
  ]);
  const before = JSON.stringify(prisma.db);
  prisma.skuItem.update = async () => { throw new Error('dry-run called update'); };
  prisma.skuItem.delete = async () => { throw new Error('dry-run called delete'); };
  prisma.skuItem.create = async () => { throw new Error('dry-run called create'); };

  const result = await run(prisma, { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.ok(result.log.some(line => line.startsWith('would remove: Hennessy VS 375ml Bottle')));
  assert.ok(result.log.some(line => line.startsWith('would rename: Heineken Dumpy (330ml)')));
  assert.equal(JSON.stringify(prisma.db), before, 'the original fake database remains unchanged');
});


test('SKU structure-only dry-run does not preview or apply retail repricing', async () => {
  const prisma = fakePrisma([
    { name: 'Heineken', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6 },
    { name: 'Hennessy VS', bottleFormat: '375ml Bottle', listPriceZAR: 340, retailSingleZAR: 340 },
    { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', listPriceZAR: 170, retailSingleZAR: 170 },
  ]);
  const before = JSON.stringify(prisma.db);
  prisma.skuItem.update = async () => { throw new Error('structure dry-run called update'); };
  prisma.skuItem.delete = async () => { throw new Error('structure dry-run called delete'); };
  prisma.skuItem.create = async () => { throw new Error('structure dry-run called create'); };

  const result = await run(prisma, { dryRun: true, structureOnly: true });
  assert.equal(result.structureOnly, true);
  assert.ok(result.log.some(line => line.startsWith('would rename: Heineken Dumpy (330ml)')));
  assert.ok(result.log.some(line => line.startsWith('would remove: Hennessy VS 375ml Bottle')));
  assert.equal(result.log.some(line => line.startsWith('would add:')), false);
  assert.equal(result.log.some(line => line.startsWith('would update:')), false);
  assert.equal(JSON.stringify(prisma.db), before);
});


test('structure-only execution applies SKU corrections but never reprices existing products', async () => {
  const prisma = fakePrisma([
    { name: 'Hennessy VS', bottleFormat: '375ml Bottle', listPriceZAR: 340, retailSingleZAR: 340 },
    { name: 'Heineken', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6 },
    { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', listPriceZAR: 170, retailSingleZAR: 170 },
  ]);

  const result = await run(prisma, { structureOnly: true });
  const heineken = prisma.db.find(row => row.name === 'Heineken');
  assert.equal(result.structureOnly, true);
  assert.equal(prisma.db.some(row => row.name === 'Hennessy VS' && row.bottleFormat === '375ml Bottle'), false);
  assert.equal(heineken.bottleFormat, 'Dumpy (330ml)');
  assert.equal(heineken.retailSingleZAR, 96, 'existing retail price is not changed by SKU structure work');
});


test('prices-only dry-run previews retail changes without changing SKU structure or data', async () => {
  const prisma = fakePrisma([
    { name: 'Heineken', bottleFormat: 'Dumpy (330ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6 },
    { name: 'Hennessy VS', bottleFormat: '750ml Bottle', listPriceZAR: 528, retailSingleZAR: 528 },
  ]);
  const before = JSON.stringify(prisma.db);
  prisma.skuItem.update = async () => { throw new Error('price dry-run called update'); };
  prisma.skuItem.delete = async () => { throw new Error('price dry-run called delete'); };
  prisma.skuItem.create = async () => { throw new Error('price dry-run called create'); };

  const result = await run(prisma, { dryRun: true, pricesOnly: true });
  assert.equal(result.pricesOnly, true);
  assert.ok(result.log.some(line => line.startsWith('would update:')));
  assert.equal(result.log.some(line => line.startsWith('would remove:')), false);
  assert.equal(result.log.some(line => line.startsWith('would rename:')), false);
  assert.equal(result.log.some(line => line.startsWith('would add:')), false);
  assert.equal(JSON.stringify(prisma.db), before);
});
