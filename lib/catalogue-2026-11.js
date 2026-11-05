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
  // Castle Milk Stout: the iCamagu list prices were far above the shelf. Pinned
  // to shop price + 25% (founder decision, 4 Nov 2026).
  { name: 'Castle Milk Stout', bottleFormat: 'Can (500ml)', unit: 17.5, source: 'Shoprite 6 x 500ml R104.99 (undated web listing, 4 Nov 2026)', fixed: 130 },
  { name: 'Castle Milk Stout', bottleFormat: 'Quart (750ml)', unit: 22.5, source: 'Shoprite 12 x 750ml R269.99 (undated web listing, 4 Nov 2026)', fixed: 28 },
  { name: 'Castle Milk Stout', bottleFormat: 'Dumpy (330ml)', unit: 15.99, source: 'Shoprite 330ml single R15.99 (undated web listing, 4 Nov 2026)', fixed: 120 },

  // Every product must have a retail price (no "Price coming soon"); newSinglePrice adds the 25%.
  { name: 'Bisquit & Dubouche VS', bottleFormat: '750ml Bottle', unit: 490, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Bisquit & Dubouche VSOP', bottleFormat: '750ml Bottle', unit: 840, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Courvoisier VSOP', bottleFormat: '750ml Bottle', unit: 820, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Gordons Pink Berry', bottleFormat: '750ml Bottle', unit: 217.06, source: 'Ekoyini retail list (Gordons Premium Pink, same product)' },
  { name: 'Hendrick\'s Original', bottleFormat: '750ml Bottle', unit: 450, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Strettons Ruby Orange', bottleFormat: '750ml Bottle', unit: 170, source: 'Ekoyini retail list (Strettons Wild Berry, same range)' },
  { name: 'Strettons Triple Berry', bottleFormat: '750ml Bottle', unit: 170, source: 'Ekoyini retail list (Strettons Wild Berry, same range)' },
  { name: 'Strettons Wild Berry', bottleFormat: '750ml Bottle', unit: 170, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Tanqueray Flor de Sevilla', bottleFormat: '750ml Bottle', unit: 360, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Tanqueray London Dry Export', bottleFormat: '750ml Bottle', unit: 360, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'El Jimador Blanco', bottleFormat: '750ml Bottle', unit: 240, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'El Jimador Reposado', bottleFormat: '750ml Bottle', unit: 240, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Olmeca Plata', bottleFormat: '750ml Bottle', unit: 280, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Olmeca Reposado', bottleFormat: '750ml Bottle', unit: 290, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Blue Curacao (Peddler\'s)', bottleFormat: '750ml Bottle', unit: 240, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Triple Sec (Peddler\'s)', bottleFormat: '750ml Bottle', unit: 240, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Frangelico Hazelnut Liqueur', bottleFormat: '750ml Bottle', unit: 260, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Peach Schnapps (Relic)', bottleFormat: '750ml Bottle', unit: 205, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Sambuca Lupini Blue', bottleFormat: '750ml Bottle', unit: 170, source: 'Ekoyini retail list (Lupini Black/Gold)' },
  { name: 'Angostura Aromatic Bitters', bottleFormat: '200ml Bottle', unit: 90, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Grenadine Syrup Cordial', bottleFormat: '1 Litre Jug', unit: 70, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Kola Tonic Cordial', bottleFormat: '750ml Bottle', unit: 45, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Veuve Clicquot Yellow Label', bottleFormat: '750ml Bottle', unit: 920, source: 'Ekoyini retail list before the iCamagu sync' },
  { name: 'Black Label', bottleFormat: 'Dumpy (330ml)', unit: 15.99, source: 'Shoprite 330ml single R15.99 (web listing, 5 Nov 2026)' },
  { name: 'Sol', bottleFormat: 'Dumpy (330ml)', unit: 17.35, source: 'Checkers 24 x 330ml R319.99 vs Black Label R294.99 (+8.5%), applied to the Black Label single price' },
  { name: 'Guinness Foreign Extra', bottleFormat: '325ml Bottle', unit: 24, source: 'Ekoyini retail list (Guinness Foreign Extra dumpy)' },
  { name: 'Redd\'s MXD Guarana', bottleFormat: 'Quart (660ml)', unit: 30.83, source: 'Shoprite Smirnoff Storm 12 x 660ml R369.99 (comparable vodka premix)' },
  { name: 'Redd\'s MXD Pine', bottleFormat: 'Quart (660ml)', unit: 30.83, source: 'Shoprite Smirnoff Storm 12 x 660ml R369.99 (comparable vodka premix)' },
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
  const list = Number(row.listPriceZAR);
  const sourceRetail = Number.isFinite(list) && list > 0 ? list : 0;
  // Explicit fixed prices (e.g. the agreed Hennessy VS price) remain pinned.
  if (hit && hit.fixed) return Number(hit.fixed);
  const checkedRetail = hit && Number.isFinite(Number(hit.unit)) && Number(hit.unit) > 0 ? Number(hit.unit) : 0;
  // Never let an older checked-shop price undercut the source app's current
  // retail base. Apply the 25% uplift to the higher verified retail figure.
  const baseRetail = Math.max(sourceRetail, checkedRetail);
  if (baseRetail > 0) return tavernPrice(baseRetail, row.packSize);
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
