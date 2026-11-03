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

test('price = checked shop price + 25%, Hennessy VS pinned at R620', () => {
  assert.equal(C.newSinglePrice({ name: 'Hennessy VS', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 400 }), 620);
  assert.equal(C.newSinglePrice({ name: 'Johnnie Walker Red Label', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 269.73 }), 300);
});

test('no checked shop price: list (retail) price + 25%', () => {
  // Bombay Sapphire R310 -> R387.50 -> R390
  assert.equal(C.newSinglePrice({ name: 'Bombay Sapphire', bottleFormat: '750ml Bottle', packSize: 1, listPriceZAR: 310 }), 390);
  // Castle Lager dumpy R14 each, sold as a six-pack -> R105
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

test('only 375ml sizes are removed', () => {
  assert.equal(C.isRemovedSize('375ml Bottle'), true);
  assert.equal(C.isRemovedSize('750ml Bottle'), false);
  assert.equal(C.isRemovedSize('Can (500ml)'), false);
});

// Minimal stand-in for the Prisma client: just what the runner uses.
function fakePrisma(rows) {
  let next = 1;
  const db = rows.map((r) => ({ id: `r${next++}`, imageUrl: null, packSize: 1, listPriceZAR: 0, retailCaseZAR: 0, retailCaseDiscountPct: 5, unitsPerCase: 12, category: 'WHISKY', productType: 'ALCOHOL', supplierPortfolio: 'X', ...r }));
  return {
    db,
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
    { name: 'Hennessy VS', bottleFormat: '375ml Bottle', listPriceZAR: 340, retailSingleZAR: 340 },
    { name: 'Heineken', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6, unitsPerCase: 4, retailCaseDiscountPct: 8 },
    { name: 'Windhoek Lager/Light', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 16, retailSingleZAR: 96, packSize: 6 },
    { name: 'Stella Artois', bottleFormat: 'Dumpy (340ml)', listPriceZAR: 18, retailSingleZAR: 108, packSize: 6 },
    { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', listPriceZAR: 170, retailSingleZAR: 170 },
    { name: 'Bombay Sapphire', bottleFormat: '750ml Bottle', listPriceZAR: 310, retailSingleZAR: 310 },
  ]);
  const first = await run(prisma);
  const find = (n, f) => prisma.db.find((r) => r.name === n && r.bottleFormat === f);

  assert.equal(find('Hennessy VS', '375ml Bottle'), undefined);
  assert.equal(find('Hennessy VS', '750ml Bottle').retailSingleZAR, 620);
  // Product photos are assigned separately by prisma/sync-images.js from local assets.
  assert.equal(find('Hennessy VS', '750ml Bottle').imageUrl, null);
  const heineken = find('Heineken', 'Dumpy (330ml)');
  assert.equal(heineken.retailSingleZAR, 105);
  assert.equal(heineken.retailCaseZAR, 386.4); // 105 x 4 six-packs - 8%
  // No checked price: list price + 25%
  assert.equal(find('Windhoek Lager', 'Dumpy (330ml)').retailSingleZAR, 120); // 16 x 6 x 1.25
  assert.equal(find('Stella Artois', 'Dumpy (330ml)').retailSingleZAR, 135); // 18 x 6 x 1.25
  assert.equal(find('Bombay Sapphire', '750ml Bottle').retailSingleZAR, 390);
  assert.equal(find('Strettons London Dry', '750ml Bottle').retailSingleZAR, 180);
  // New products get shop price + 25%
  assert.equal(find('Strettons Triple Berry', '750ml Bottle').retailSingleZAR, 240);
  assert.equal(find('Strettons Ruby Orange', '750ml Bottle').retailSingleZAR, 240);
  assert.equal(find('Stella Artois', 'Quart (620ml)').retailSingleZAR, 35);
  assert.equal(find('Strettons Triple Berry', '750ml Bottle').imageUrl, null); // local photo sync owns images
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
