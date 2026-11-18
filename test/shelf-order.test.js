// Shelf order shared by the shop, admin and /api/products (public/shelf-order.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { compareShelf, compareCatalogue, shelfOf, brandOf, SHELF_ORDER } = require('../public/shelf-order.js');

const rows = fs.readFileSync(path.join(__dirname, '../prisma/data/skus.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => { const c = l.split(','); return { name: c[0], category: c[1], bottleFormat: c[2], stock: 5 }; });

test('every catalogue category has a place on the shelf', () => {
  for (const r of rows) assert.ok(SHELF_ORDER.includes(shelfOf(r.category)), r.category);
});

test('sections run beer → RTDs → spirits → wine → mixers → energy → water & ice', () => {
  const order = [...new Set([...rows].sort(compareShelf).map((r) => shelfOf(r.category)))];
  assert.deepEqual(order.slice(0, 2), ['BEER', 'CIDER_RTD']);
  assert.deepEqual(order.slice(-3), ['MIXER', 'ENERGY_DRINK', 'WATER_ICE']);
  assert.ok(order.indexOf('RUM') < order.indexOf('WINE'), 'rum sits with the spirits');
});

test('brands stay together, packs go can → dumpy → quart, water before ice', () => {
  const sorted = [...rows].sort(compareShelf).map((r) => `${r.name}|${r.bottleFormat}`);
  const amstel = sorted.filter((k) => k.startsWith('Amstel Lager|'));
  assert.deepEqual(amstel, ['Amstel Lager|Can (500ml)', 'Amstel Lager|Dumpy (330ml)', 'Amstel Lager|Quart (660ml)']);
  const ponchos = sorted.map((k, i) => [k, i]).filter(([k]) => k.startsWith('Ponchos'));
  assert.equal(ponchos.length, 3);
  assert.equal(ponchos[2][1] - ponchos[0][1], 2, 'all Ponchos side by side');
  assert.ok(sorted.indexOf('Valpre Sparkling Water|1L') < sorted.indexOf('Ekoyini Ice Bag|1kg'));
});

test('sold-out items go last within their brand in the shop, not in the admin list', () => {
  const a = { name: 'Amstel Lager', category: 'BEER', bottleFormat: 'Can (500ml)', stock: 0 };
  const b = { name: 'Amstel Lager', category: 'BEER', bottleFormat: 'Quart (660ml)', stock: 4 };
  assert.ok(compareShelf(a, b) > 0);
  assert.ok(compareCatalogue(a, b) < 0);
});

test('every brand sits together in its section, with sizes in order (founder, 18 Nov 2026)', () => {
  const sorted = [...rows].sort(compareShelf);
  const firstSeen = new Map();
  let prev = null;
  sorted.forEach((r, i) => {
    const key = `${shelfOf(r.category)}|${brandOf(r.name)}`;
    if (key !== prev) {
      assert.ok(!firstSeen.has(key), `${r.name} ${r.bottleFormat} is split away from the rest of its brand`);
      firstSeen.set(key, i);
    }
    prev = key;
  });
  const names = sorted.map((r) => `${r.name}|${r.bottleFormat}`);
  const tsitsikamma = names.filter((k) => k.startsWith('Tsitsikamma'));
  assert.equal(names.indexOf(tsitsikamma[tsitsikamma.length - 1]) - names.indexOf(tsitsikamma[0]), tsitsikamma.length - 1, 'still and sparkling Tsitsikamma side by side');
  const kwv = names.filter((k) => /^KWV \d+ /.test(k)).map((k) => Number(k.match(/^KWV (\d+)/)[1]));
  assert.deepEqual(kwv, [...kwv].sort((x, y) => x - y), 'KWV 3, 5, 10, 12, 15');
  assert.ok(names.indexOf('Bonaqua Still Water|500ml') < names.indexOf('Bonaqua Still Water|1.5L'), 'small before big');
});
