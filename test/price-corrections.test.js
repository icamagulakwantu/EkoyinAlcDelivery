// The 8 Nov 2026 price correction: every row is shelf price + the founder's
// markup, matches a real catalogue row, and founder-fixed prices are untouched.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { PRICE_CORRECTIONS } = require('../lib/price-corrections-2026-11-08');
const C = require('../lib/catalogue-2026-11');

const csvRows = fs.readFileSync(path.join(__dirname, '../prisma/data/skus.csv'), 'utf8')
  .trim().split('\n').slice(1).map((line) => {
    const cols = line.match(/("[^"]*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
    return { name: cols[0], category: cols[1], bottleFormat: cols[2] };
  });

test('every correction names a real catalogue row, once', () => {
  const seen = new Set();
  for (const p of PRICE_CORRECTIONS) {
    const key = `${p.name}|${p.bottleFormat}`;
    assert.ok(!seen.has(key), `duplicate correction ${key}`);
    seen.add(key);
    assert.ok(csvRows.some((r) => r.name === p.name && r.bottleFormat === p.bottleFormat), `no catalogue row for ${key}`);
  }
});

test('every correction is shelf price + the category markup, applied once', () => {
  for (const p of PRICE_CORRECTIONS) {
    const row = csvRows.find((r) => r.name === p.name && r.bottleFormat === p.bottleFormat);
    assert.equal(p.markup, C.markupRateForCategory(row.category), `${p.name} ${p.bottleFormat} markup`);
    assert.equal(p.fixed, Math.round(p.shelf * (1 + p.markup) * 100) / 100, `${p.name} ${p.bottleFormat}`);
    assert.ok(p.fixed > 0 && p.source, `${p.name} ${p.bottleFormat} has a source`);
  }
});

test('the reported problem is fixed: quarts are quart-priced', () => {
  assert.equal(C.finalPriceFor('Amstel Lager', 'Quart (660ml)'), 23.19);
  assert.equal(C.finalPriceFor('Hansa Pilsener', 'Quart (750ml)'), 21.39);
  for (const p of PRICE_CORRECTIONS.filter((x) => /^Quart/.test(x.bottleFormat))) {
    assert.ok(p.fixed < 35, `${p.name} quart R${p.fixed}`);
  }
});

test('founder-fixed prices are not overridden', () => {
  assert.equal(C.finalPriceFor('Johnnie Walker Red Label', '750ml Bottle'), 315);
  assert.equal(C.finalPriceFor('Klipdrift Export', '750ml Bottle'), 252);
  assert.equal(C.finalPriceFor('Castle Milk Stout', 'Quart (750ml)'), 29.96);
  assert.equal(C.finalPriceFor('Heineken', 'Dumpy (330ml)'), 117.7);
  assert.equal(C.finalPriceFor('Hennessy VS', '750ml Bottle'), 682.5);
  assert.equal(C.finalPriceFor('Corona Extra', 'Dumpy (355ml)'), 135);
  assert.equal(C.finalPriceFor('Sambuca Lupini Blue', '750ml Bottle'), 357);
});
