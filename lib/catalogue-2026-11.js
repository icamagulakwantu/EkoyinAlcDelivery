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
//   - Every 375ml product is removed: taverns don't stock them.
//   - Wrong pack labels fixed (from the I-Camagu catalogue work,
//     founder-confirmed Oct 2026).
//   - Founder-checked product photos (Hercules CDN) go on the exact pack
//     they show, so a quart photo never lands on a dumpy.
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
  { name: 'Strettons Triple Berry', bottleFormat: '750ml Bottle', unit: 189.99, source: 'Woolworths / Liquor City regular price, 28 Oct 2026' },
  { name: 'Strettons Ruby Orange', bottleFormat: '750ml Bottle', unit: 189.99, source: 'Checkers via PriceCheck, Nov 2026' },
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

const CDN = (id) => `https://hercules-cdn.com/file_${id}`;

// Founder photos, each checked by eye for brand, flavour and pack shape.
// format: text the row's pack label must contain.
const PHOTOS = [
  { name: 'Castle Lager', format: 'Dumpy', id: 'wiZ71gKYDbzmonFNkE1Ac9Yz' },
  { name: 'Castle Lite', format: 'Dumpy', id: 'gsdsx0aArNYDrLemANz6KzXz' },
  { name: 'Castle Milk Stout', format: 'Quart', id: 'Wqi6eumd7RW8btGlRvopq41C' },
  { name: 'Hansa Pilsener', format: 'Quart', id: 'UUpEiGHNQR7onNStYLyVEvaH' },
  { name: 'Amstel Lager', format: 'Quart', id: 'UjoK1Cl0aJOnBnFE2XnoaDEq' },
  { name: 'Flying Fish Chill', format: 'Dumpy', id: 'vZ72Fnoxw52cGP85Ac2ZZqhh' },
  { name: 'Black Label', format: 'Dumpy', id: 'wzaa11jrab5bJHhiQKewsJQm' },
  { name: 'Sol', format: 'Dumpy', id: 'wMEeCaFMeegfa9heO8TPxoXv' },
  { name: 'Windhoek Lager', format: 'Dumpy', id: 'vi0015h9ifrtEuisi5lNHyuI' },
  { name: 'Stella Artois', format: 'Quart', id: 'IwQLtyHRzFBVachGc6TkWUe6' },
  { name: "Hunter's Dry/Gold", format: 'Dumpy', id: 'EFvLNOtDVy2wJqwHKufoRuGR' },
  { name: 'Brutal Fruit Ruby/Litchi', format: 'Dumpy', id: 'PuYfgbiyqUrZlN3uRnViyPqs' },
  { name: 'The Glenlivet 12 Year', format: '750ml', id: 'agIeFrCsKMIaa8A4FeebARby' },
  { name: 'Johnnie Walker Red Label', format: '750ml', id: 'bVmhHUOcUq4e7GLi1grRfzoH' },
  { name: 'Jameson Select Reserve', format: '750ml', id: 'fPaOxnmbuVcjlteRn8m78svO' },
  { name: 'J&B Rare', format: '750ml', id: 'sxGjN3HEmYc6K9idysvRY2W9' },
  { name: 'Glenfiddich 12 Year', format: '750ml', id: '4bPJ1WoaXaUfqmTwJi2j9oUY' },
  { name: 'Russian Bear Flavours', format: '750ml', id: '133DIRrJjCDa8FWGHEJ9KSlm' },
  { name: 'Russian Bear Standard', format: '750ml', id: 'PEoHeC1agaiYtwgLVkS14HXO' },
  { name: 'Jose Cuervo Especial Reposado', format: '750ml', id: 'IqqxCHTuP47kEPks7ZeBkAjO' },
  { name: 'Jose Cuervo Especial Silver', format: '750ml', id: 'nRpXk0LfpbHK44Kl7Od3CMNT' },
  { name: 'Triple Sec (Butlers)', format: '750ml', id: '8j9e3XJKbKyuzhaeZ04hcF8w' },
  { name: 'Strawberry Liqueur (Butlers)', format: '750ml', id: 'EuLJrq3pRWGKkpoKH1EG2MZ8' },
  { name: 'Blue Curacao (Butlers)', format: '750ml', id: 'lD23QaXoByhsigci93tQ8Iuk' },
  { name: 'Ginger Liqueur (Butlers)', format: '750ml', id: 'TqaWP06xQLkA4XE7V3aw1nl9' },
  { name: 'Banana Liqueur (Butlers)', format: '750ml', id: 'TGltBPheotRowOijWjPxPLrp' },
  { name: 'Baileys Original Irish Cream', format: '750ml', id: 'bpqmS7XBsQvI4rh6xyJ56Onl' },
  { name: 'Hennessy VS', format: '750ml', id: 'NttJtoAaQpwucdn7XYbKizlM' },
  { name: 'Strettons London Dry', format: '750ml', id: 'Ch2aeNo10pNVKmoyRvFPl2Vm' },
  { name: 'Strettons Wild Berry', format: '750ml', id: 'UN8S1Fz6M8apcaELYO6mwXDw' },
  { name: 'Strettons Triple Berry', format: '750ml', id: 's2kFHkADPnB1td9r6cf18nFl' },
  { name: 'Strettons Ruby Orange', format: '750ml', id: '1RiVHLFL4ctD73StunX3tjww' },
];

// Products the owner sent photos of that the shop didn't list. Priced from
// SHOP_PRICES above. `like` is an existing row to copy category from.
const NEW_PRODUCTS = [
  { name: 'Stella Artois', bottleFormat: 'Quart (620ml)', unitsPerCase: 12, like: 'Stella Artois' },
  { name: 'Strettons Triple Berry', bottleFormat: '750ml Bottle', unitsPerCase: 12, like: 'Strettons London Dry' },
  { name: 'Strettons Ruby Orange', bottleFormat: '750ml Bottle', unitsPerCase: 12, like: 'Strettons London Dry' },
];

function photoUrlFor(name, bottleFormat) {
  const hit = PHOTOS.find((p) => p.name === name && String(bottleFormat).includes(p.format));
  return hit ? CDN(hit.id) : null;
}

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

function isRemovedSize(bottleFormat) {
  return String(bottleFormat).includes(REMOVED_SIZE);
}

module.exports = {
  MARKUP, SHOP_PRICES, NAME_FIXES, FORMAT_FIXES, PHOTOS, NEW_PRODUCTS,
  roundTavern, tavernPrice, casePrice, photoUrlFor, shopPriceFor, newSinglePrice, isRemovedSize,
};
