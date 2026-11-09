// Founder decisions of 9 Nov 2026 (lib/founder-prices-2026-11-09.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../lib/catalogue-2026-11');
const F = require('../lib/founder-prices-2026-11-09');

const csvRows = fs.readFileSync(path.join(__dirname, '../prisma/data/skus.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map((line) => {
    const c = line.split(',');
    return { name: c[0], category: c[1], bottleFormat: c[2] };
  });

test('founder prices are final and win over every other list', () => {
  assert.equal(C.finalPriceFor('Heineken', 'Dumpy (330ml)'), 145);
  assert.equal(C.finalPriceFor('Castle Lite', 'Can (500ml)'), 130);
  assert.equal(C.finalPriceFor('Carling Black Label', 'Can (500ml)'), 130);
  assert.equal(C.finalPriceFor('Savanna Dry', 'NRB (500ml)'), 210);
  assert.equal(C.finalPriceFor('Appletiser Sparkling Apple Juice', '1L'), 45);
  assert.equal(C.finalPriceFor('Red Bull Energy Drink', 'Can (250ml)'), 30);
  assert.equal(C.finalPriceFor('Coca-Cola Original', 'Can (500ml)'), 20);
});

test('every founder price names a real catalogue row', () => {
  for (const p of F.FOUNDER_PRICES) {
    assert.ok(csvRows.some((r) => r.name === p.name && r.bottleFormat === p.bottleFormat), `${p.name} ${p.bottleFormat}`);
  }
});

test('strategic spirits are Siba cost + 14%', () => {
  assert.equal(C.finalPriceFor('Jagermeister Herbal Liqueur', '750ml Bottle'), 410.4);
  assert.equal(C.finalPriceFor('Ponchos Tequila Coffee', '750ml Bottle'), 364.8);
  assert.equal(C.finalPriceFor('Jameson Original Irish', '750ml Bottle'), 478.8);
  assert.equal(C.finalPriceFor('Jameson Select Reserve', '750ml Bottle'), 684);
  assert.equal(C.finalPriceFor('Olmeca Reposado', '750ml Bottle'), 399);
});

test('no alcoholic six-pack of cans is under R130, except Corona and Savanna', () => {
  for (const r of csvRows) {
    if (!/^Can/.test(r.bottleFormat) || C.packSizeFor(r.name, r.bottleFormat, r.category) !== 6) continue;
    if (F.NOT_ALCOHOL_CANS.test(r.name) || /^(Corona|Savanna)/.test(r.name)) continue;
    assert.ok(C.finalPriceFor(r.name, r.bottleFormat) >= 130, `${r.name} ${r.bottleFormat} R${C.finalPriceFor(r.name, r.bottleFormat)}`);
  }
  assert.equal(C.finalPriceFor('Lion Lager', 'Can (500ml)'), 130);
  assert.ok(C.finalPriceFor('Corona Extra', 'Can (410ml)') < 130, 'Corona keeps its own price');
  assert.ok(C.finalPriceFor('Mofaya Original', 'Can (500ml)') < 130, 'mixers are not covered');
});

test('six-packs for beer, cider and RTD cans, dumpies and 500ml NRBs; cold drinks loose', () => {
  assert.equal(C.packSizeFor('Savanna Dry', 'NRB (500ml)', 'CIDER_RTD'), 6);
  assert.equal(C.packSizeFor('Castle Lite', 'Can (500ml)', 'BEER'), 6);
  assert.equal(C.packSizeFor('Heineken', 'Dumpy (330ml)', 'BEER'), 6);
  assert.equal(C.packSizeFor('Castle Lite', 'Quart (660ml)', 'BEER'), 1);
  assert.equal(C.packSizeFor('Red Bull Energy Drink', 'Can (250ml)', 'ENERGY_DRINK'), 1);
  assert.equal(C.packSizeFor('Coca-Cola Original', 'Can (500ml)', 'MIXER'), 1);
  assert.equal(C.packSizeFor('Mofaya Original', 'Can (500ml)', 'MIXER'), 6);
  assert.equal(C.packSizeFor('Schweppes Tonic Water', 'Can (200ml)', 'MIXER'), 6);
});
