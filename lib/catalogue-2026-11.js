// lib/catalogue-2026-11.js
//
// November 2026 catalogue correction, asked for by the owner:
//   - Prices: "slightly higher than retail, the same as tavern prices".
//     Every product is priced at retail + 25%, rounded the way a tavern
//     prices (see roundTavern):
//       * where a checked shop price exists (named shop + date), that price
//         is the retail base;
//       * otherwise the product's own list price (the retail price from
//         prisma/data/skus.csv) is the base.
//     Hennessy VS 750ml is pinned at R620, which the owner confirmed.
//     The base never changes when this runs, so re-running never adds 25%
//     twice.
//   - 375ml is retired only for spirits (brandy, whisky, cognac, gin,
//     vodka, tequila, rum and liqueurs). Beer, cider/RTD, wine and other alcohol
//     categories retain their legitimate 375ml packs.
//   - Wrong pack labels fixed (from the I-Camagu catalogue work,
//     founder-confirmed Oct 2026).
//   - Product photography is handled separately by prisma/sync-images.js
//     using local repo assets and exact pack-format overrides. This pricing
//     module never writes remote CDN photo URLs.
//
// Pure data and functions (no database), so it can be unit-tested.

const MARKUP = 1.25;

// Tavern-style rounding: whole rand under R50, nearest R5 under R200,
// nearest R10 from R200 up.
function roundTavern(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n < 50) return Math.round(n);
  if (n < 200) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

// Price for one "single" purchase. packSize is 6 for dumpies and cans (sold
// as six-packs), 1 for everything else.
function tavernPrice(retailUnitPrice, packSize = 1) {
  const size = Number.isInteger(packSize) && packSize > 0 ? packSize : 1;
  return roundTavern(retailUnitPrice * MARKUP * size);
}

// Case price keeps the row's own carry-pack discount.
function casePrice(single, unitsPerCase, discountPct) {
  return Math.round(single * unitsPerCase * (1 - (Number(discountPct) || 0) / 100) * 100) / 100;
}

// Checked shop prices, per single bottle/can. Short promotions are left out
// on purpose: they expire and would under-price us.
const SHOP_PRICES = [
  // October 2026
  { name: 'Hennessy VS', bottleFormat: '750ml Bottle', unit: 499.99, source: 'Ultra Liquors 1-15 Oct 2026', fixed: 620 },
  { name: 'Johnnie Walker Gold Label Reserve', bottleFormat: '750ml Bottle', unit: 599.99, source: 'Ultra Liquors 16-31 Oct 2026' },
  { name: 'Johnnie Walker Red Label', bottleFormat: '750ml Bottle', unit: 239.99, source: 'Ultra Liquors Oct 2026' },
  { name: 'Johnnie Walker Black Label', bottleFormat: '750ml Bottle', unit: 369.99, source: 'Ultra Liquors 1-15 Oct 2026' },
  { name: 'Amarula Original Cream', bottleFormat: '750ml Bottle', unit: 154.99, source: 'Prestons 1-21 Oct 2026' },
  { name: 'Jameson Original Irish', bottleFormat: '750ml Bottle', unit: 349.99, source: 'Prestons 1-21 Oct 2026' },
  { name: 'Castle Lite', bottleFormat: 'Can (500ml)', unit: 339.99 / 24, source: 'Ultra Liquors 16-31 Oct 2026, 24 x 500ml' },
  { name: 'Heineken', bottleFormat: 'Dumpy (330ml)', unit: 339.99 / 24, source: 'Ultra Liquors 16-31 Oct 2026, 24 x 330ml' },
  { name: 'Heineken', bottleFormat: 'Can (500ml)', unit: 399 / 24, source: 'Makro online 22 Oct 2026, 24 x 500ml' },
  { name: 'Savanna Dry/Light', bottleFormat: 'Dumpy (330ml)', unit: 379.99 / 24, source: 'Ultra Liquors 16-31 Oct 2026, 24 x 330ml' },
  // September 2026, regular (non-promotion) prices
  { name: 'Jameson Select Reserve', bottleFormat: '750ml Bottle', unit: 5748 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Hennessy VSOP', bottleFormat: '750ml Bottle', unit: 11868 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Honor VS', bottleFormat: '750ml Bottle', unit: 490, source: 'Ultra Liquors Sep 2026' },
  { name: 'Don Julio Reposado', bottleFormat: '750ml Bottle', unit: 749.83, source: 'Ultra Liquors Sep 2026' },
  { name: 'Ciroc Original Premium', bottleFormat: '750ml Bottle', unit: 3499 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Moet & Chandon Imperial Brut', bottleFormat: '750ml Bottle', unit: 3570 / 6, source: 'Ultra Liquors Sep 2026' },
  { name: 'Krone Borealis Brut (MCC)', bottleFormat: '750ml Bottle', unit: 1050 / 6, source: 'Ultra Liquors Sep 2026' },
  { name: 'J&B Rare', bottleFormat: '750ml Bottle', unit: 2299 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Skyy Vodka Original', bottleFormat: '750ml Bottle', unit: 2799 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Jagermeister Herbal Liqueur', bottleFormat: '750ml Bottle', unit: 295, source: 'Ultra Liquors Sep 2026' },
  { name: 'Klipdrift Export', bottleFormat: '750ml Bottle', unit: 2099 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Three Ships 5 Year Old', bottleFormat: '750ml Bottle', unit: 175, source: 'Ultra Liquors Sep 2026' },
  { name: 'Gordons London Dry', bottleFormat: '750ml Bottle', unit: 169.99, source: 'Ultra Liquors Sep 2026' },
  { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', unit: 1749 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Old Buck Gin', bottleFormat: '750ml Bottle', unit: 1799 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Triple Sec (Butlers)', bottleFormat: '750ml Bottle', unit: 2340 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Wild Africa Cream Liqueur', bottleFormat: '750ml Bottle', unit: 124, source: 'Ultra Liquors Sep 2026' },
  { name: 'Drostdy-Hof Claret Select', bottleFormat: '5 Litre Box', unit: 670 / 4, source: 'Ultra Liquors Sep 2026' },
  { name: 'Black Label', bottleFormat: 'Quart (750ml)', unit: 259.99 / 12, source: 'Ultra Liquors Sep 2026' },
  { name: 'Belgravia G&T (Asstd)', bottleFormat: 'Can (440ml)', unit: 479.99 / 24, source: 'Ultra Liquors Sep 2026' },
  { name: 'Smirnoff Spin/Storm', bottleFormat: 'Can (440ml)', unit: 439.99 / 24, source: 'Ultra Liquors Sep 2026' },
  { name: 'Corona', bottleFormat: 'Dumpy (355ml)', unit: 429.99 / 24, source: 'Prestons Sep 2026, 24 x 355ml' },
  // November 2026, regular shelf prices for the three products added below
  { name: 'Stella Artois', bottleFormat: 'Quart (620ml)', unit: 28, source: 'Pick n Pay via PriceCheck, Nov 2026' },
];

// Wrong names and pack labels. A row is renamed/moved, never duplicated,
// so its order history stays attached. Applied before prices and photos.
const NAME_FIXES = [
  // Windhoek doesn't sell a "Light"; the product is Windhoek Lager.
  { from: 'Windhoek Lager/Light', to: 'Windhoek Lager' },
];
const FORMAT_FIXES = [
  // SA dumpies are sold as 24 x 330ml, not 340ml. name null = every product.
  { name: null, from: 'Dumpy (340ml)', to: 'Dumpy (330ml)' },
  { name: 'Heineken', from: 'Quart (500ml)', to: 'Quart (650ml)' },
  { name: 'Windhoek Lager', from: 'Quart (500ml)', to: 'Quart (750ml)' },
  // Only where a checked 500ml price exists; other cans keep their label.
  { name: 'Castle Lite', from: 'Can (330ml)', to: 'Can (500ml)' },
  { name: 'Heineken', from: 'Can (330ml)', to: 'Can (500ml)' },
];

const REMOVED_SIZE = '375ml';
const SPIRIT_CATEGORIES = new Set([
  'BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA', 'VODKA_PREMIUM',
  'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'RUM',
]);

// Products the owner sent photos of that the shop didn't list. Priced from
// SHOP_PRICES above. `like` is an existing row to copy category from.
const NEW_PRODUCTS = [];


function shopPriceFor(name, bottleFormat) {
  return SHOP_PRICES.find((p) => p.name === name && p.bottleFormat === bottleFormat) || null;
}

// New single price for a row: checked shop price + 25% when we have one,
// otherwise the row's own retail list price + 25%. null when neither exists
// (the item stays "Price coming soon").
function newSinglePrice(row) {
  const hit = shopPriceFor(row.name, row.bottleFormat);
  if (hit) return hit.fixed || tavernPrice(hit.unit, row.packSize);
  const list = Number(row.listPriceZAR);
  if (Number.isFinite(list) && list > 0) return tavernPrice(list, row.packSize);
  return null;
}

function isRemovedSize(bottleFormat, category) {
  return SPIRIT_CATEGORIES.has(String(category || '').toUpperCase()) &&
    String(bottleFormat).includes(REMOVED_SIZE);
}

module.exports = {
  MARKUP, SHOP_PRICES, NAME_FIXES, FORMAT_FIXES, NEW_PRODUCTS, SPIRIT_CATEGORIES,
  roundTavern, tavernPrice, casePrice, shopPriceFor, newSinglePrice, isRemovedSize,
};
