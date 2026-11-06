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

// Owner-approved customer markup rules. Final prices in FINAL_CUSTOMER_PRICES
// are already customer-facing and must never be marked up a second time.
const MARKUP_RATE_BY_CATEGORY = Object.freeze({
  BEER: 0.07,
  CIDER_RTD: 0.07,
  WINE: 0.07,
  WINE_BOX: 0.07,
  SPARKLING: 0.07,
  CHAMPAGNE: 0.07,
  BRANDY: 0.05,
  WHISKY: 0.05,
  COGNAC: 0.05,
  GIN: 0.05,
  VODKA: 0.05,
  VODKA_PREMIUM: 0.05,
  TEQUILA: 0.05,
  TEQUILA_PREMIUM: 0.05,
  LIQUEUR: 0.05,
  RUM: 0.05,
  MIXER: 0.05,
  ENERGY_DRINK: 0.05,
  WATER: 0.05,
  ICE: 0.05,
});
const DEFAULT_MARKUP_RATE = 0.05;

function markupRateForCategory(category) {
  return MARKUP_RATE_BY_CATEGORY[String(category || '').toUpperCase()] ?? DEFAULT_MARKUP_RATE;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Price for one customer purchase. Cans and dumpies are sold as six-packs;
// the markup is applied once to the exact unit base, then multiplied by pack size.
function tavernPrice(retailUnitPrice, packSize = 1, category = '') {
  const size = Number.isInteger(packSize) && packSize > 0 ? packSize : 1;
  const base = Number(retailUnitPrice);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return round2(base * (1 + markupRateForCategory(category)) * size);
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
  { name: 'Guinness Draught Stout', bottleFormat: 'Can (440ml)', unit: 28, source: 'Typical SA shelf price for a 440ml Guinness Draught can (estimate)' },
];

// Wrong names and pack labels. A row is renamed/moved, never duplicated,
// so its order history stays attached. Applied before prices and photos.

// Final customer-facing prices (receipt-calibrated, 6 Nov 2026).
// These already include the 5%/7% app markup and Yoco buffer.
// Corona Dumpy 355ml is a fixed exception at R135 (high-velocity product).
// Smirnoff 1818 is 750ml only (no 1L).
const FINAL_CUSTOMER_PRICES = [
  { name: '4th Street Sweet Red', bottleFormat: '5 Litre Box', fixed: 288.9 },
  { name: '4th Street Sweet Red', bottleFormat: '750ml Bottle', fixed: 85.6 },
  { name: '4th Street Sweet Rosé', bottleFormat: '5 Litre Box', fixed: 288.9 },
  { name: '4th Street Sweet White', bottleFormat: '5 Litre Box', fixed: 288.9 },
  { name: '4th Street Sweet White', bottleFormat: '750ml Bottle', fixed: 85.6 },
  { name: 'Absolut Citron', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Absolut Lime', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Absolut Original Blue', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Absolut Watermelon', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Amarula Ethiopian Coffee', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Amarula Original Cream', bottleFormat: '750ml Bottle', fixed: 204.75 },
  { name: 'Amarula Raspberry Chocolate Cream', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Amstel Lager', bottleFormat: 'Can (500ml)', fixed: 171.2 },
  { name: 'Amstel Lager', bottleFormat: 'Dumpy (330ml)', fixed: 187.25 },
  { name: 'Amstel Lager', bottleFormat: 'Quart (750ml)', fixed: 47.08 },
  { name: 'Angostura Aromatic Bitters', bottleFormat: '200ml Bottle', fixed: 115.5 },
  { name: 'Appletiser Sparkling Apple Juice', bottleFormat: '1L', fixed: 50.4 },
  { name: 'Aquelle Sparkling Water', bottleFormat: '500ml', fixed: 19.95 },
  { name: 'Aquelle Still Water', bottleFormat: '1.5L', fixed: 21.0 },
  { name: 'Baileys Original Irish Cream', bottleFormat: '750ml Bottle', fixed: 388.5 },
  { name: "Bain's Cape Mountain", bottleFormat: '750ml Bottle', fixed: 462.0 },
  { name: 'Banana Liqueur (Butlers)', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'Belgravia Gin & Dark Cherry', bottleFormat: 'Can (500ml)', fixed: 160.5 },
  { name: 'Belgravia Gin & Dark Cherry', bottleFormat: 'Dumpy (275ml)', fixed: 197.95 },
  { name: 'Belgravia Gin & Dry Lemon', bottleFormat: 'Can (500ml)', fixed: 160.5 },
  { name: 'Belgravia Gin & Dry Lemon', bottleFormat: 'Dumpy (275ml)', fixed: 197.95 },
  { name: 'Bells Extra Special', bottleFormat: '750ml Bottle', fixed: 388.5 },
  { name: 'Belvedere Pure Vodka', bottleFormat: '750ml Bottle', fixed: 913.5 },
  { name: 'Bernini Blush', bottleFormat: 'Can (500ml)', fixed: 133.75 },
  { name: 'Bernini Blush', bottleFormat: 'Dumpy (275ml)', fixed: 165.85 },
  { name: 'Bernini Classic', bottleFormat: 'Can (500ml)', fixed: 133.75 },
  { name: 'Bernini Classic', bottleFormat: 'Dumpy (275ml)', fixed: 165.85 },
  { name: 'Bernini Ruby Berry', bottleFormat: 'Can (500ml)', fixed: 133.75 },
  { name: 'Bernini Ruby Berry', bottleFormat: 'Dumpy (275ml)', fixed: 165.85 },
  { name: 'Beyerskloof Pinotage', bottleFormat: '750ml Bottle', fixed: 197.95 },
  { name: 'Bisquit & Dubouche VS', bottleFormat: '750ml Bottle', fixed: 640.5 },
  { name: 'Bisquit & Dubouche VSOP', bottleFormat: '750ml Bottle', fixed: 1102.5 },
  { name: 'Bisquit & Dubouche XO', bottleFormat: '750ml Bottle', fixed: 2415.0 },
  { name: 'Black Label', bottleFormat: 'Can (500ml)', fixed: 123.05 },
  { name: 'Black Label', bottleFormat: 'Dumpy (330ml)', fixed: 128.4 },
  { name: 'Black Label', bottleFormat: 'Quart (750ml)', fixed: 28.89 },
  { name: 'Blue Curacao (Butlers)', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: "Blue Curacao (Peddler's)", bottleFormat: '750ml Bottle', fixed: 315.0 },
  { name: 'Bombay Sapphire', bottleFormat: '750ml Bottle', fixed: 682.5 },
  { name: 'Bonaqua Still Water', bottleFormat: '1.5L', fixed: 29.4 },
  { name: 'Bonaqua Still Water', bottleFormat: '500ml', fixed: 15.75 },
  { name: 'Breezer Blackberry', bottleFormat: 'Can (500ml)', fixed: 224.7 },
  { name: 'Breezer Blackberry', bottleFormat: 'Dumpy (275ml)', fixed: 197.95 },
  { name: 'Breezer Blueberry', bottleFormat: 'Can (500ml)', fixed: 224.7 },
  { name: 'Breezer Blueberry', bottleFormat: 'Dumpy (275ml)', fixed: 197.95 },
  { name: 'Breezer Watermelon', bottleFormat: 'Can (500ml)', fixed: 160.5 },
  { name: 'Breezer Watermelon', bottleFormat: 'Dumpy (275ml)', fixed: 197.95 },
  { name: 'Brutal Fruit Ruby Apple', bottleFormat: 'Can (500ml)', fixed: 144.45 },
  { name: 'Brutal Fruit Ruby Apple', bottleFormat: 'Dumpy (330ml)', fixed: 214.0 },
  { name: 'Brutal Fruit Strawberry Rouge', bottleFormat: 'Can (500ml)', fixed: 144.45 },
  { name: 'Brutal Fruit Strawberry Rouge', bottleFormat: 'Dumpy (330ml)', fixed: 214.0 },
  { name: 'Budweiser', bottleFormat: 'Can (500ml)', fixed: 187.25 },
  { name: 'Budweiser', bottleFormat: 'Dumpy (330ml)', fixed: 197.95 },
  { name: 'Cape Velvet Cream', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Captain Morgan Spiced Gold', bottleFormat: '750ml Bottle', fixed: 231.0 },
  { name: 'Carling Black Label', bottleFormat: 'Can (500ml)', fixed: 123.05 },
  { name: 'Carling Black Label', bottleFormat: 'Dumpy (330ml)', fixed: 128.4 },
  { name: 'Carling Black Label', bottleFormat: 'Quart (750ml)', fixed: 28.89 },
  { name: 'Casamigos Blanco', bottleFormat: '750ml Bottle', fixed: 1144.5 },
  { name: 'Casamigos Reposado', bottleFormat: '750ml Bottle', fixed: 1701.0 },
  { name: 'Castillo de Liria Sweet Red', bottleFormat: '750ml Bottle', fixed: 112.35 },
  { name: 'Castle Lager', bottleFormat: 'Can (500ml)', fixed: 171.2 },
  { name: 'Castle Lager', bottleFormat: 'Dumpy (330ml)', fixed: 187.25 },
  { name: 'Castle Lager', bottleFormat: 'Quart (750ml)', fixed: 25.68 },
  { name: 'Castle Lite', bottleFormat: 'Can (500ml)', fixed: 112.35 },
  { name: 'Castle Lite', bottleFormat: 'Dumpy (330ml)', fixed: 197.95 },
  { name: 'Castle Lite', bottleFormat: 'Quart (750ml)', fixed: 49.22 },
  { name: 'Castle Milk Stout', bottleFormat: 'Can (500ml)', fixed: 139.1 },
  { name: 'Castle Milk Stout', bottleFormat: 'Dumpy (330ml)', fixed: 128.4 },
  { name: 'Castle Milk Stout', bottleFormat: 'Quart (750ml)', fixed: 29.96 },
  { name: 'Chambord Black Raspberry', bottleFormat: '500ml Bottle', fixed: 546.0 },
  { name: 'Cherry Kirsch Liqueur (Butlers)', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'Chillers Punch Caribbean Chaos', bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: 'Chillers Punch Milano Spritz', bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: 'Chillers Punch Peach & Mango', bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: 'Chillers Punch Tequila Sunrise (Zero Alcohol)', bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: 'Chivas Regal 12 Year Old', bottleFormat: '750ml Bottle', fixed: 724.5 },
  { name: 'Chivas Regal 15 Year Old', bottleFormat: '750ml Bottle', fixed: 1050.0 },
  { name: 'Ciroc Apple', bottleFormat: '750ml Bottle', fixed: 777.0 },
  { name: 'Ciroc Mango', bottleFormat: '750ml Bottle', fixed: 777.0 },
  { name: 'Ciroc Original Premium', bottleFormat: '750ml Bottle', fixed: 378.0 },
  { name: 'Ciroc Pineapple', bottleFormat: '750ml Bottle', fixed: 777.0 },
  { name: 'Clase Azul Plata', bottleFormat: '750ml Bottle', fixed: 3129.0 },
  { name: 'Clase Azul Reposado', bottleFormat: '750ml Bottle', fixed: 4872.0 },
  { name: 'Coca-Cola Original Taste Less Sugar', bottleFormat: '2L', fixed: 47.25 },
  { name: 'Cointreau Orange Liqueur', bottleFormat: '750ml Bottle', fixed: 693.0 },
  { name: 'Commando Brandy', bottleFormat: '750ml Bottle', fixed: 304.5 },
  { name: 'Corona', bottleFormat: 'Can (410ml)', fixed: 246.1 },
  { name: 'Corona', bottleFormat: 'Dumpy (355ml)', fixed: 135.0 },
  { name: 'Corona', bottleFormat: 'Quart (600ml)', fixed: 40.66 },
  { name: 'Corona Extra', bottleFormat: 'Can (410ml)', fixed: 246.1 },
  { name: 'Corona Extra', bottleFormat: 'Dumpy (355ml)', fixed: 135.0 },
  { name: 'Corona Extra', bottleFormat: 'Quart (600ml)', fixed: 40.66 },
  { name: 'Count Pushkin Vodka', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Courvoisier VS', bottleFormat: '750ml Bottle', fixed: 756.0 },
  { name: 'Courvoisier VSOP', bottleFormat: '750ml Bottle', fixed: 1071.0 },
  { name: 'Cruxland Gin', bottleFormat: '750ml Bottle', fixed: 525.0 },
  { name: 'Cruz Vintage Black Vodka', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: "D'USSE VSOP", bottleFormat: '750ml Bottle', fixed: 1375.5 },
  { name: 'Disaronno Amaretto Liqueur', bottleFormat: '750ml Bottle', fixed: 546.0 },
  { name: 'Don Julio Blanco', bottleFormat: '750ml Bottle', fixed: 1134.0 },
  { name: 'Don Julio Reposado', bottleFormat: '750ml Bottle', fixed: 987.0 },
  { name: 'Drambuie Honey/Scotch', bottleFormat: '750ml Bottle', fixed: 420.0 },
  { name: 'Drostdy-Hof Adelpracht Sweet', bottleFormat: '3 Litre Box', fixed: 176.55 },
  { name: 'Drostdy-Hof Adelpracht Sweet', bottleFormat: '750ml Bottle', fixed: 112.35 },
  { name: 'Drostdy-Hof Claret Select', bottleFormat: '5 Litre Box', fixed: 224.7 },
  { name: 'Ekoyini Crushed Ice', bottleFormat: '1kg', fixed: 30 },
  { name: 'Ekoyini Crushed Ice', bottleFormat: '2kg', fixed: 45 },
  { name: 'Ekoyini Ice Bag', bottleFormat: '1kg', fixed: 20 },
  { name: 'Ekoyini Ice Bag', bottleFormat: '2kg', fixed: 35 },
  { name: 'El Jimador Reposado', bottleFormat: '750ml Bottle', fixed: 315.0 },
  { name: 'Espresso/Coffee Liqueur (Butlers)', bottleFormat: '750ml Bottle', fixed: 231.0 },
  { name: 'Extreme Energy', bottleFormat: 'Can (440ml)', fixed: 171.2 },
  { name: 'Extreme Energy', bottleFormat: 'Dumpy (330ml)', fixed: 133.75 },
  { name: 'Firstwatch Whisky', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Flowstone African Bush Botanical', bottleFormat: '750ml Bottle', fixed: 619.5 },
  { name: 'Flying Fish Chill', bottleFormat: 'Can (500ml)', fixed: 171.2 },
  { name: 'Flying Fish Chill', bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: 'Flying Fish Dry Apple', bottleFormat: 'Can (500ml)', fixed: 278.2 },
  { name: 'Flying Fish Dry Apple', bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: 'Flying Fish Dry Apple', bottleFormat: 'Quart (660ml)', fixed: 64.2 },
  { name: 'Flying Fish Lemon', bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: 'Flying Fish Lemon', bottleFormat: 'Quart (660ml)', fixed: 64.2 },
  { name: 'Frangelico Hazelnut Liqueur', bottleFormat: '750ml Bottle', fixed: 336.0 },
  { name: 'Ginger Liqueur (Butlers)', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'Glenfiddich 12 Year', bottleFormat: '750ml Bottle', fixed: 1081.5 },
  { name: 'Gordons London Dry', bottleFormat: '750ml Bottle', fixed: 220.5 },
  { name: 'Gordons Pink Berry', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Grand Marnier Cordon Rouge', bottleFormat: '750ml Bottle', fixed: 913.5 },
  { name: 'Grey Goose Luxury', bottleFormat: '750ml Bottle', fixed: 1060.5 },
  { name: 'Guinness Draught Stout', bottleFormat: 'Can (440ml)', fixed: 224.7 },
  { name: 'Guinness Foreign Extra', bottleFormat: '325ml Bottle', fixed: 32.1 },
  { name: 'Guinness Foreign Extra', bottleFormat: 'Can (440ml)', fixed: 208.65 },
  { name: 'Hansa Pilsener', bottleFormat: 'Can (500ml)', fixed: 165.85 },
  { name: 'Hansa Pilsener', bottleFormat: 'Dumpy (330ml)', fixed: 176.55 },
  { name: 'Hansa Pilsener', bottleFormat: 'Quart (750ml)', fixed: 47.08 },
  { name: 'Heineken', bottleFormat: 'Can (500ml)', fixed: 133.75 },
  { name: 'Heineken', bottleFormat: 'Dumpy (330ml)', fixed: 112.35 },
  { name: 'Heineken', bottleFormat: 'Quart (650ml)', fixed: 47.08 },
  { name: "Hendrick's Original", bottleFormat: '750ml Bottle', fixed: 588.0 },
  { name: 'Hennessy VS', bottleFormat: '750ml Bottle', fixed: 682.5 },
  { name: 'Hennessy VSOP', bottleFormat: '750ml Bottle', fixed: 1302.0 },
  { name: 'Hennessy XO', bottleFormat: '750ml Bottle', fixed: 4347.0 },
  { name: 'Honor VS', bottleFormat: '750ml Bottle', fixed: 640.5 },
  { name: "Hunter's Dry", bottleFormat: 'Can (440ml)', fixed: 176.55 },
  { name: "Hunter's Dry", bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: "Hunter's Dry", bottleFormat: 'Quart (750ml)', fixed: 47.08 },
  { name: "Hunter's Gold", bottleFormat: 'Can (440ml)', fixed: 176.55 },
  { name: "Hunter's Gold", bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: "Hunter's Gold", bottleFormat: 'Quart (750ml)', fixed: 47.08 },
  { name: "Hunter's Iced Apple", bottleFormat: 'Can (440ml)', fixed: 176.55 },
  { name: "Hunter's Iced Apple", bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: "Hunter's Iced Watermelon", bottleFormat: 'Can (440ml)', fixed: 176.55 },
  { name: "Hunter's Iced Watermelon", bottleFormat: 'Dumpy (330ml)', fixed: 192.6 },
  { name: 'Inverroche Amber', bottleFormat: '750ml Bottle', fixed: 724.5 },
  { name: 'Inverroche Classic', bottleFormat: '750ml Bottle', fixed: 724.5 },
  { name: 'Inverroche Verdant', bottleFormat: '750ml Bottle', fixed: 724.5 },
  { name: 'J&B Rare', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'JC Le Roux La Fleurette', bottleFormat: '750ml Bottle', fixed: 144.45 },
  { name: 'JC Le Roux Le Domaine', bottleFormat: '750ml Bottle', fixed: 144.45 },
  { name: "Jack Daniel's Old No.7", bottleFormat: '750ml Bottle', fixed: 556.5 },
  { name: "Jack Daniel's Tennessee Honey", bottleFormat: '750ml Bottle', fixed: 556.5 },
  { name: 'Jagermeister Herbal Liqueur', bottleFormat: '750ml Bottle', fixed: 388.5 },
  { name: 'Jameson Caskmates', bottleFormat: '750ml Bottle', fixed: 682.5 },
  { name: 'Jameson Original Irish', bottleFormat: '750ml Bottle', fixed: 462.0 },
  { name: 'Jameson Select Reserve', bottleFormat: '750ml Bottle', fixed: 630.0 },
  { name: 'Johnnie Walker Black Label', bottleFormat: '750ml Bottle', fixed: 483.0 },
  { name: 'Johnnie Walker Double Black', bottleFormat: '750ml Bottle', fixed: 787.5 },
  { name: 'Johnnie Walker Gold Label Reserve', bottleFormat: '750ml Bottle', fixed: 787.5 },
  { name: 'Johnnie Walker Red Label', bottleFormat: '750ml Bottle', fixed: 315.0 },
  { name: 'Jose Cuervo Especial Reposado', bottleFormat: '750ml Bottle', fixed: 682.5 },
  { name: 'Jose Cuervo Especial Silver', bottleFormat: '750ml Bottle', fixed: 682.5 },
  { name: 'KEM Gin', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'KWV 12 Year', bottleFormat: '750ml Bottle', fixed: 504.0 },
  { name: 'Kahlua Coffee Liqueur', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Kanonkop Kadette Cabernet', bottleFormat: '750ml Bottle', fixed: 256.8 },
  { name: 'Klipdrift Export', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'Klipdrift Premium', bottleFormat: '750ml Bottle', fixed: 336.0 },
  { name: 'Kopparberg Mixed Fruit', bottleFormat: 'Can (440ml)', fixed: 299.6 },
  { name: 'Kopparberg Mixed Fruit', bottleFormat: 'Dumpy (330ml)', fixed: 299.6 },
  { name: 'Kopparberg Pear', bottleFormat: 'Can (440ml)', fixed: 299.6 },
  { name: 'Kopparberg Pear', bottleFormat: 'Dumpy (330ml)', fixed: 299.6 },
  { name: 'Kopparberg Raspberry', bottleFormat: 'Can (440ml)', fixed: 299.6 },
  { name: 'Kopparberg Raspberry', bottleFormat: 'Dumpy (330ml)', fixed: 299.6 },
  { name: 'Kopparberg Strawberry & Lime', bottleFormat: 'Can (440ml)', fixed: 299.6 },
  { name: 'Kopparberg Strawberry & Lime', bottleFormat: 'Dumpy (330ml)', fixed: 299.6 },
  { name: 'Kopparberg Sweet Vintage Pear', bottleFormat: 'Can (440ml)', fixed: 299.6 },
  { name: 'Krone Borealis Brut (MCC)', bottleFormat: '750ml Bottle', fixed: 235.4 },
  { name: 'Kwande Gin Rooibos', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Kwande Gin Witty', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Lime Cordial', bottleFormat: '750ml Bottle', fixed: 73.5 },
  { name: 'Lion Lager', bottleFormat: 'Can (500ml)', fixed: 165.85 },
  { name: 'Lion Lager', bottleFormat: 'Quart (750ml)', fixed: 47.08 },
  { name: 'Liqui Fruit Cranberry Cooler', bottleFormat: '1L', fixed: 57.75 },
  { name: "M'hudi Chenin Blanc", bottleFormat: '750ml Bottle', fixed: 288.9 },
  { name: "M'hudi Pinotage", bottleFormat: '750ml Bottle', fixed: 278.2 },
  { name: 'Malibu Coconut Rum Liqueur', bottleFormat: '750ml Bottle', fixed: 388.5 },
  { name: 'Maraschino Cherries (Syrup)', bottleFormat: '350ml Jar', fixed: 99.75 },
  { name: 'Martell Blue Swift VSOP', bottleFormat: '750ml Bottle', fixed: 1081.5 },
  { name: 'Martell VS', bottleFormat: '750ml Bottle', fixed: 724.5 },
  { name: 'Moet & Chandon Imperial Brut', bottleFormat: '750ml Bottle', fixed: 791.8 },
  { name: 'Monin Agave', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Almond Orgeat', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Blue Curaçao Syrup', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Cherry', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Crème Brûlée', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Falernum', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Grenadine', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Kiwi Syrup', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Lemon Pie / Tarte Citron', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Lemon Tea / Citron', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Melon', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin Spicy Mango', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Monin White Chocolate', bottleFormat: '700ml Bottle', fixed: 367.5 },
  { name: 'Musgrave Pink', bottleFormat: '750ml Bottle', fixed: 525.0 },
  { name: 'Nachtmusik Chocolate Liqueur', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Nederburg Baronne', bottleFormat: '750ml Bottle', fixed: 144.45 },
  { name: 'Nederburg Sauvignon Blanc', bottleFormat: '750ml Bottle', fixed: 133.75 },
  { name: 'Old Buck Gin', bottleFormat: '750ml Bottle', fixed: 194.25 },
  { name: 'Olmeca Plata', bottleFormat: '750ml Bottle', fixed: 367.5 },
  { name: 'Olmeca Reposado', bottleFormat: '750ml Bottle', fixed: 378.0 },
  { name: 'Paarl Perle White', bottleFormat: '2 Litre Co-Pack', fixed: 144.45 },
  { name: 'Passion Fruit Cordial', bottleFormat: '750ml Bottle', fixed: 73.5 },
  { name: 'Patron Reposado', bottleFormat: '750ml Bottle', fixed: 1375.5 },
  { name: 'Patron Silver Luxury', bottleFormat: '750ml Bottle', fixed: 1375.5 },
  { name: 'Peach Schnapps (Relic)', bottleFormat: '750ml Bottle', fixed: 273.0 },
  { name: 'Peppermint Liqueur (Butlers)', bottleFormat: '750ml Bottle', fixed: 231.0 },
  { name: 'Ponchos Blanco Tequila', bottleFormat: '750ml Bottle', fixed: 525.0 },
  { name: 'Ponchos Caramel Tequila', bottleFormat: '750ml Bottle', fixed: 525.0 },
  { name: 'Ponchos Tequila Coffee', bottleFormat: '750ml Bottle', fixed: 336.0 },
  { name: 'Pongracz Brut', bottleFormat: '750ml Bottle', fixed: 288.9 },
  { name: 'Red Bull Energy Drink', bottleFormat: 'Can (355ml)', fixed: 273.0 },
  { name: "Redd's Berry", bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: "Redd's Berry", bottleFormat: 'Dumpy (330ml)', fixed: 208.65 },
  { name: "Redd's Dry", bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: "Redd's Dry", bottleFormat: 'Dumpy (330ml)', fixed: 208.65 },
  { name: "Redd's MXD Guarana", bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: "Redd's MXD Guarana", bottleFormat: 'Quart (660ml)', fixed: 42.8 },
  { name: "Redd's MXD Pine", bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: "Redd's MXD Pine", bottleFormat: 'Quart (660ml)', fixed: 42.8 },
  { name: "Redd's Original", bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: "Redd's Original", bottleFormat: 'Dumpy (330ml)', fixed: 208.65 },
  { name: 'Remy Martin 1738 Accord Royal', bottleFormat: '750ml Bottle', fixed: 1438.5 },
  { name: 'Remy Martin VSOP', bottleFormat: '750ml Bottle', fixed: 1207.5 },
  { name: 'Robertson Winery Smooth Red', bottleFormat: '3 Litre Box', fixed: 214.0 },
  { name: 'Robertson Winery Sweet Merlot', bottleFormat: '750ml Bottle', fixed: 112.35 },
  { name: 'Royal Flush Premium', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Russian Bear Flavours', bottleFormat: '750ml Bottle', fixed: 241.5 },
  { name: 'Russian Bear Standard', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Saint Raphael Smooth Red', bottleFormat: '750ml Bottle', fixed: 112.35 },
  { name: 'Sambuca Lupini Black', bottleFormat: '750ml Bottle', fixed: 357.0 },
  { name: 'Sambuca Lupini Gold', bottleFormat: '750ml Bottle', fixed: 357.0 },
  { name: 'Savanna Angry Lemon', bottleFormat: 'Dumpy (330ml)', fixed: 224.7 },
  { name: 'Savanna Dry', bottleFormat: 'Can (500ml)', fixed: 208.65 },
  { name: 'Savanna Dry', bottleFormat: 'Dumpy (330ml)', fixed: 513.6 },
  { name: 'Savanna Dry', bottleFormat: 'Quart (500ml)', fixed: 53.5 },
  { name: 'Savanna Dry/Light', bottleFormat: 'Dumpy (330ml)', fixed: 513.6 },
  { name: 'Scottish Leader Original', bottleFormat: '750ml Bottle', fixed: 357.0 },
  { name: "Sedgwick's Old Brown", bottleFormat: '2 Litre Box', fixed: 160.5 },
  { name: "Sedgwick's Old Brown", bottleFormat: '750ml Bottle', fixed: 85.6 },
  { name: 'Seven Sisters Pinotage/Cabernet', bottleFormat: '750ml Bottle', fixed: 117.7 },
  { name: 'Skyy Vodka Original', bottleFormat: '750ml Bottle', fixed: 315.0 },
  { name: 'Smirnoff 1818', bottleFormat: '750ml Bottle', fixed: 215.0 },
  { name: 'Smirnoff 1818 Vodka', bottleFormat: '750ml Bottle', fixed: 215.0 },
  { name: 'Smirnoff Infusions', bottleFormat: '750ml Bottle', fixed: 367.5 },
  { name: 'Smirnoff Red No. 21', bottleFormat: '750ml Bottle', fixed: 367.5 },
  { name: 'Smirnoff Storm Citrus', bottleFormat: 'Can (500ml)', fixed: 144.45 },
  { name: 'Smirnoff Storm Citrus', bottleFormat: 'Dumpy (250ml)', fixed: 192.6 },
  { name: 'Smirnoff Storm Pine Twist', bottleFormat: 'Can (500ml)', fixed: 144.45 },
  { name: 'Smirnoff Storm Pine Twist', bottleFormat: 'Dumpy (250ml)', fixed: 192.6 },
  { name: 'Sol', bottleFormat: 'Can (500ml)', fixed: 208.65 },
  { name: 'Sol', bottleFormat: 'Dumpy (330ml)', fixed: 107.0 },
  { name: 'Sol', bottleFormat: 'Quart (640ml)', fixed: 36.38 },
  { name: 'Sol NRB', bottleFormat: 'Dumpy (330ml)', fixed: 107.0 },
  { name: 'Southern Comfort', bottleFormat: '750ml Bottle', fixed: 204.75 },
  { name: 'Stella Artois', bottleFormat: 'Can (500ml)', fixed: 208.65 },
  { name: 'Stella Artois', bottleFormat: 'Dumpy (330ml)', fixed: 107.0 },
  { name: 'Stella Artois', bottleFormat: 'Quart (620ml)', fixed: 37.45 },
  { name: 'Strawberry Lips', bottleFormat: '750ml Bottle', fixed: 262.5 },
  { name: 'Strawberry Liqueur (Butlers)', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'Strettons London Dry', bottleFormat: '750ml Bottle', fixed: 189.0 },
  { name: 'Strettons Wild Berry', bottleFormat: '750ml Bottle', fixed: 220.5 },
  { name: 'Strongbow Gold Apple', bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: 'Strongbow Gold Apple', bottleFormat: 'Dumpy (330ml)', fixed: 208.65 },
  { name: 'Strongbow Gold Apple', bottleFormat: 'Quart (750ml)', fixed: 49.22 },
  { name: 'Strongbow Red Berries', bottleFormat: 'Can (500ml)', fixed: 192.6 },
  { name: 'Strongbow Red Berries', bottleFormat: 'Dumpy (330ml)', fixed: 208.65 },
  { name: 'Strongbow Red Berries', bottleFormat: 'Quart (750ml)', fixed: 49.22 },
  { name: 'Tanqueray Flor de Sevilla', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Tanqueray London Dry Export', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Tanqueray No. TEN', bottleFormat: '750ml Bottle', fixed: 871.5 },
  { name: 'Tequila Rose Cream Liqueur', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'The Glenlivet 12 Year', bottleFormat: '750ml Bottle', fixed: 913.5 },
  { name: 'Thirsti Still Water', bottleFormat: '1.5L', fixed: 23.1 },
  { name: 'Three Ships 5 Year Old', bottleFormat: '750ml Bottle', fixed: 231.0 },
  { name: 'Tia Maria Coffee Liqueur', bottleFormat: '750ml Bottle', fixed: 472.5 },
  { name: 'Triple Sec (Butlers)', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: "Triple Sec (Peddler's)", bottleFormat: '750ml Bottle', fixed: 315.0 },
  { name: 'Triple Sec Premium (San Basile)', bottleFormat: '750ml Bottle', fixed: 336.0 },
  { name: 'Tsitsikamma Sparkling Water', bottleFormat: '1L', fixed: 27.3 },
  { name: 'Tsitsikamma Sparkling Water', bottleFormat: '500ml', fixed: 16.8 },
  { name: 'Tsitsikamma Still Water', bottleFormat: '1.5L', fixed: 27.3 },
  { name: 'Tsitsikamma Still Water', bottleFormat: '500ml', fixed: 14.7 },
  { name: 'Valpre Natural Spring Water', bottleFormat: '1.5L', fixed: 31.5 },
  { name: 'Valpre Natural Spring Water', bottleFormat: '500ml', fixed: 16.8 },
  { name: 'Valpre Sparkling Water', bottleFormat: '1L', fixed: 30.45 },
  { name: 'Van Der Hum Tangerine (Butlers)', bottleFormat: '750ml Bottle', fixed: 283.5 },
  { name: 'Veuve Clicquot Yellow Label', bottleFormat: '750ml Bottle', fixed: 1230.5 },
  { name: 'Viceroy 5 Year Old', bottleFormat: '750ml Bottle', fixed: 252.0 },
  { name: 'Wellington VO', bottleFormat: '750ml Bottle', fixed: 273.0 },
  { name: 'Wild Africa Cream Liqueur', bottleFormat: '750ml Bottle', fixed: 162.75 },
  { name: 'Windhoek Draught', bottleFormat: 'Can (440ml)', fixed: 117.7 },
  { name: 'Windhoek Draught', bottleFormat: 'Quart (750ml)', fixed: 41.73 },
  { name: 'Windhoek Lager', bottleFormat: 'Can (500ml)', fixed: 197.95 },
  { name: 'Windhoek Lager', bottleFormat: 'Dumpy (330ml)', fixed: 208.65 },
  { name: 'Windhoek Lager', bottleFormat: 'Quart (750ml)', fixed: 47.08 },
  { name: 'Wixworth Gin', bottleFormat: '750ml Bottle', fixed: 430.5 },
  { name: 'Wyborowa Vodka', bottleFormat: '750ml Bottle', fixed: 388.5 },
];

function finalPriceFor(name, bottleFormat) {
  // Keep the already-calibrated final prices attached while source-export
  // aliases are normalized to the founder's master-catalogue labels.
  const names = new Set([name]);
  for (const fix of NAME_FIXES) if (fix.to === name) names.add(fix.from);
  const formats = new Set([bottleFormat]);
  for (const fix of FORMAT_FIXES) {
    if (fix.to === bottleFormat && (fix.name === null || fix.name === name || names.has(fix.name))) {
      formats.add(fix.from);
    }
  }
  const hit = FINAL_CUSTOMER_PRICES.find((p) => names.has(p.name) && formats.has(p.bottleFormat));
  return hit ? Number(hit.fixed) : null;
}

const NAME_FIXES = [
  // Align source-export aliases to the founder's 327-SKU master workbook.
  { from: 'Windhoek Lager/Light', to: 'Windhoek Lager' },
  { from: 'Black Label', to: 'Carling Black Label' },
  { from: 'Corona', to: 'Corona Extra' },
  { from: 'Breezer Blackberry', to: 'Bacardi Breezer Blackberry' },
  { from: 'Breezer Blueberry', to: 'Bacardi Breezer Blueberry' },
  { from: 'Breezer Watermelon', to: 'Bacardi Breezer Watermelon' },
  { from: 'Savanna Dry/Light', to: 'Savanna Dry' },
  { from: 'Chillers Punch Tequila Sunrise (Zero Alcohol)', to: 'Chillers Punch Tequila Sunrise (Zero Alc)' },
];
const FORMAT_FIXES = [
  // Exact South African pack sizes from the founder's master catalogue.
  { name: null, from: 'Dumpy (340ml)', to: 'Dumpy (330ml)' },
  { name: 'Heineken', from: 'Quart (500ml)', to: 'Quart (650ml)' },
  { name: 'Heineken', from: 'Quart (750ml)', to: 'Quart (650ml)' },
  { name: 'Amstel Lager', from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: 'Castle Lite', from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: 'Windhoek Draught', from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: 'Windhoek Lager', from: 'Quart (500ml)', to: 'Quart (660ml)' },
  { name: 'Windhoek Lager', from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: "Hunter's Dry", from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: "Hunter's Gold", from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: 'Strongbow Gold Apple', from: 'Quart (750ml)', to: 'Quart (660ml)' },
  { name: 'Strongbow Red Berries', from: 'Quart (750ml)', to: 'Quart (660ml)' },
  // Only where the master catalogue confirms a 500ml can.
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

// New single price for a row. FINAL_CUSTOMER_PRICES and explicit fixed
// overrides are final customer prices. Only a verified source base that has
// no fixed final is marked up: 7% for beer/cider/wine/RTD and 5% for spirits,
// mixers, soft drinks, water and ice. Never stack a markup onto a final price.
function newSinglePrice(row) {
  // 1. Prefer the receipt-calibrated final customer price (6 Nov 2026).
  const final = finalPriceFor(row.name, row.bottleFormat);
  if (final != null && final > 0) return final;

  // 2. Explicit fixed override is also already a final customer price.
  const hit = shopPriceFor(row.name, row.bottleFormat);
  if (hit && Number(hit.fixed) > 0) return round2(Number(hit.fixed));

  // 3. Otherwise compare the canonical source base with the checked regular
  // retail base, choose the higher comparable unit price, and apply the
  // category's owner-approved markup exactly once.
  const list = Number(row.listPriceZAR);
  const sourceRetail = Number.isFinite(list) && list > 0 ? list : 0;
  const checkedRetail = hit && Number.isFinite(Number(hit.unit)) && Number(hit.unit) > 0 ? Number(hit.unit) : 0;
  const baseRetail = Math.max(sourceRetail, checkedRetail);
  if (baseRetail > 0) return tavernPrice(baseRetail, row.packSize, row.category);
  return null;
}

function isRemovedSize(bottleFormat, category) {
  return SPIRIT_CATEGORIES.has(String(category || '').toUpperCase()) &&
    String(bottleFormat).includes(REMOVED_SIZE);
}

module.exports = {
  MARKUP_RATE_BY_CATEGORY, DEFAULT_MARKUP_RATE, markupRateForCategory, SHOP_PRICES, FINAL_CUSTOMER_PRICES, NAME_FIXES, FORMAT_FIXES, NEW_PRODUCTS, SPIRIT_CATEGORIES,
  roundTavern, tavernPrice, casePrice, shopPriceFor, finalPriceFor, newSinglePrice, isRemovedSize,
};
