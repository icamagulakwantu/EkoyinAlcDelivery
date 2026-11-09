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
  assert.equal(C.finalPriceFor('Amstel Lager', 'Quart (660ml)'), 25.67); // single-bottle R23.99 + 7%
  assert.equal(C.finalPriceFor('Hansa Pilsener', 'Quart (750ml)'), 21.39);
  for (const p of PRICE_CORRECTIONS.filter((x) => /^Quart/.test(x.bottleFormat))) {
    assert.ok(p.fixed < 35, `${p.name} quart R${p.fixed}`);
  }
});

test('founder-fixed prices are not overridden', () => {
  assert.equal(C.finalPriceFor('Johnnie Walker Red Label', '750ml Bottle'), 315);
  assert.equal(C.finalPriceFor('Klipdrift Export', '750ml Bottle'), 252);
  assert.equal(C.finalPriceFor('Castle Milk Stout', 'Quart (750ml)'), 29.96);
  assert.equal(C.finalPriceFor('Heineken', 'Dumpy (330ml)'), 145); // founder price 9 Nov 2026
  assert.equal(C.finalPriceFor('Hennessy VS', '750ml Bottle'), 682.5);
  assert.equal(C.finalPriceFor('Corona Extra', 'Dumpy (355ml)'), 135);
  assert.equal(C.finalPriceFor('Sambuca Lupini Blue', '750ml Bottle'), 357);
});

// Founder rule (9 Nov 2026): always base the price on the HIGHEST regular
// retail price. A correction may never sit below a verified retail price
// already on file for the same pack (e.g. Hennessy VSOP R1,090, not a
// bulk-case R989).
test('corrections never undercut a verified higher retail price on file', () => {
  for (const c of PRICE_CORRECTIONS) {
    const formats = new Set([c.bottleFormat]);
    for (const f of C.FORMAT_FIXES) {
      if (f.to === c.bottleFormat && (f.name === null || f.name === c.name)) formats.add(f.from);
    }
    for (const p of C.FINAL_CUSTOMER_PRICES) {
      if (p.name !== c.name || !formats.has(p.bottleFormat) || !p.selectedBase) continue;
      if (!/verified/i.test(p.status) || /not independently/i.test(p.status)) continue;
      assert.ok(c.shelf >= p.selectedBase, `${c.name} ${c.bottleFormat}: base R${c.shelf} is below verified retail R${p.selectedBase}`);
    }
  }
});

test('premium brands are never cheaper than the value brands they sit above', () => {
  const price = (n) => C.finalPriceFor(n, '750ml Bottle');
  const above = [
    ['Courvoisier VS', 'Honor VS'],
    ['Hennessy VS', 'Honor VS'],
    ['Martell VS', 'Honor VS'],
    ['Courvoisier VSOP', 'Courvoisier VS'],
    ['Hennessy VSOP', 'Hennessy VS'],
    ['Hennessy XO', 'Hennessy VSOP'],
    ['Remy Martin VSOP', 'Martell VS'],
    ['Jameson Select Reserve', 'Jameson Original Irish'],
    ['Johnnie Walker Black Label', 'Johnnie Walker Red Label'],
    ['Chivas Regal 15 Year Old', 'Chivas Regal 12 Year Old'],
  ];
  for (const [hi, lo] of above) {
    assert.ok(price(hi) > 0 && price(lo) > 0, `${hi} / ${lo} priced`);
    assert.ok(price(hi) >= price(lo), `${hi} R${price(hi)} is cheaper than ${lo} R${price(lo)}`);
  }
});

// Founder's stock receipts from Siba (27 Sep and 9 Nov 2026). Siba is where
// stock is bought, so the app must never sell below these prices.
test('the app never sells below what the stock costs at Siba', () => {
  const siba = [
    ['Bernini Blush', 'Can (500ml)', 125], ['Bernini Classic', 'Can (500ml)', 125],
    ['Jagermeister Herbal Liqueur', '750ml Bottle', 360],
    ['Bacardi Breezer Blackberry', 'Can (500ml)', 150], ['Bacardi Breezer Watermelon', 'Can (500ml)', 150],
    ['Castle Lite', 'Can (500ml)', 115], ['Carling Black Label', 'Can (500ml)', 115],
    ['Savanna Dry', 'NRB (500ml)', 165 / 6], ['Savanna Dry', 'Dumpy (330ml)', 120],
    ['Brutal Fruit Ruby Apple', 'Can (500ml)', 135], ['Brutal Fruit Strawberry Rouge', 'Can (500ml)', 135],
    ['Sol NRB', 'Dumpy (330ml)', 100], ['Stella Artois', 'Dumpy (330ml)', 100],
    ['Jameson Original Irish', '750ml Bottle', 420], ['Jameson Select Reserve', '750ml Bottle', 600],
    ['Hennessy VS', '750ml Bottle', 650], ['Olmeca Reposado', '750ml Bottle', 350],
    ['Ponchos Tequila Coffee', '750ml Bottle', 320], ['Tanqueray London Dry Export', '750ml Bottle', 360],
    ['Aquelle Still Water', '1.5L', 20],
  ];
  for (const [name, format, cost] of siba) {
    const price = C.finalPriceFor(name, format);
    assert.ok(price != null, `${name} ${format} has a price`);
    assert.ok(price >= cost, `${name} ${format}: app R${price} is below the Siba cost R${cost}`);
  }
});
