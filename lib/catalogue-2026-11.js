// lib/catalogue-2026-11.js
//
// November 2026 catalogue correction, asked for by the owner:
//   - Customer prices use the creator's exact rules: 7% for beer, cider,
//     wine and RTDs; 5% for spirits, mixers, soft drinks, energy drinks,
//     water and ice. Prices are rounded to two decimal places.
//   - The workbook's final customer prices are already marked up and are
//     never marked up again. Unfixed rows use the higher comparable base
//     (canonical source price or verified regular retail) plus the category
//     markup, once only. No promotion price is used as a regular comparator.
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
  // Castle Milk Stout: legacy shop-price observations; fixed customer prices
  // below take precedence. Re-verify the source before using these fallbacks.
  { name: 'Castle Milk Stout', bottleFormat: 'Can (500ml)', unit: 17.5, source: 'Shoprite 6 x 500ml R104.99 (undated web listing, 4 Nov 2026)', fixed: 130 },
  { name: 'Castle Milk Stout', bottleFormat: 'Quart (750ml)', unit: 22.5, source: 'Shoprite 12 x 750ml R269.99 (undated web listing, 4 Nov 2026)', fixed: 28 },
  { name: 'Castle Milk Stout', bottleFormat: 'Dumpy (330ml)', unit: 15.99, source: 'Shoprite 330ml single R15.99 (undated web listing, 4 Nov 2026)', fixed: 120 },

  // Legacy source-price observations. Only verified final-price entries should
  // be treated as production prices; unsupported rows remain unverified.
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
// These already include only the founder-approved 5%/7% app markup. Yoco fees
// are not included or silently added to catalogue prices.
// Corona Dumpy 355ml is a fixed exception at R135 (high-velocity product).
// Smirnoff 1818 is 750ml only (no 1L).
const FINAL_CUSTOMER_PRICES = [
  { name: "Amstel Lager", bottleFormat: "Can (500ml)", fixed: 171.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Amstel Lager", bottleFormat: "Dumpy (330ml)", fixed: 187.25, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Amstel Lager", bottleFormat: "Quart (750ml)", fixed: 47.08, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Carling Black Label", bottleFormat: "Can (500ml)", fixed: 123.05, status: "Receipt-backed", selectedBase: 115, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Carling Black Label 500ml can 6-pack: tavern unit base R115; 7% markup. Receipt mapping should be confirmed against exact SKU." },
  { name: "Carling Black Label", bottleFormat: "Dumpy (330ml)", fixed: 128.4, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Carling Black Label 330ml dumpy 6-pack: receipt batch lists R115 base; confirm receipt variant mapping before publication. | RECONCILIATION MAPPING CORRECTION: Carling Black Label dumpy was not the receipt-matched Carling 500ml can; original price restored." },
  { name: "Carling Black Label", bottleFormat: "Quart (750ml)", fixed: 28.89, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Budweiser", bottleFormat: "Can (500ml)", fixed: 187.25, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Budweiser", bottleFormat: "Dumpy (330ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Lager", bottleFormat: "Can (500ml)", fixed: 171.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Lager", bottleFormat: "Dumpy (330ml)", fixed: 187.25, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Lager", bottleFormat: "Quart (750ml)", fixed: 24.6, status: "Market verified — exact bottle format + 7%", selectedBase: 22.99, markup: 0.07, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/beer/castle-lager-beer-750ml-4457", notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | LiquorIQ, 31 Oct 2026; exact Castle Lager 750ml, highest of 2 shops R22.99 | Exact 750ml bottle; 7% beer markup." },
  { name: "Castle Lite", bottleFormat: "Can (500ml)", fixed: 112.35, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Lite", bottleFormat: "Dumpy (330ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Lite", bottleFormat: "Quart (750ml)", fixed: 49.22, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Milk Stout", bottleFormat: "Can (500ml)", fixed: 139.1, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Milk Stout", bottleFormat: "Dumpy (330ml)", fixed: 128.4, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Castle Milk Stout", bottleFormat: "Quart (750ml)", fixed: 28.88, status: "Market verified — exact bottle format + 7%", selectedBase: 26.99, markup: 0.07, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/beer/castle-milk-stout-beer-750ml-3693", notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | LiquorIQ, 29 Oct 2026; exact Castle Milk Stout 750ml, highest R26.99 | Exact 750ml bottle; 7% beer markup." },
  { name: "Corona Extra", bottleFormat: "Can (410ml)", fixed: 246.1, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Corona Extra", bottleFormat: "Dumpy (355ml)", fixed: 135, status: "User-approved exception", markup: 0.07, notes: "Receipt base R120; ordinary 7% calculation R128.40. Final R135 retained per explicit user instruction. | RECONCILED: Corona Extra 355ml dumpy 6-pack: retain explicit user-approved R135 price." },
  { name: "Corona Extra", bottleFormat: "Quart (600ml)", fixed: 32.1, status: "Market verified — exact bottle format + 7%", selectedBase: 30, markup: 0.07, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/beer/corona-extra-beer-600ml-4024", notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | LiquorIQ, 29 Oct 2026; exact Corona Extra 600ml, highest R30.00 | Exact 600ml bottle, not 355ml dumpy; 7% beer markup." },
  { name: "Guinness Draught Stout", bottleFormat: "Can (440ml)", fixed: 224.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Guinness Foreign Extra", bottleFormat: "325ml Bottle", fixed: 32.1, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Guinness Foreign Extra", bottleFormat: "Can (440ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hansa Pilsener", bottleFormat: "Can (500ml)", fixed: 165.85, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hansa Pilsener", bottleFormat: "Dumpy (330ml)", fixed: 176.55, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hansa Pilsener", bottleFormat: "Quart (750ml)", fixed: 47.08, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Heineken", bottleFormat: "Can (500ml)", fixed: 133.75, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Heineken NRB 330ml 6-pack: tavern base R110; 7% markup. | RECONCILIATION MAPPING CORRECTION: Heineken receipt line is 330ml NRB/dumpy, not 500ml can; original price restored." },
  { name: "Heineken", bottleFormat: "Dumpy (330ml)", fixed: 117.7, status: "Receipt-backed", selectedBase: 110, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED MAPPING: Heineken NRB 330ml 6-pack: tavern base R110; 7% markup." },
  { name: "Heineken", bottleFormat: "Quart (650ml)", fixed: 32.09, status: "Market verified — exact bottle format + 7%", selectedBase: 29.99, markup: 0.07, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/beer/brand/heineken", notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | LiquorIQ, current 6 Nov 2026 range; Heineken 650ml NRB from R29.99 | Exact Heineken 650ml bottle family listing; comparator is R29.99, 7% markup." },
  { name: "Lion Lager", bottleFormat: "Can (500ml)", fixed: 165.85, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Lion Lager", bottleFormat: "Quart (750ml)", fixed: 23.53, status: "Market verified — exact bottle format + 7%", selectedBase: 21.99, markup: 0.07, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/beer/lion-lager-beer-750ml-5487", notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | LiquorIQ, 3 Nov 2026; exact Lion Lager 750ml, highest of 2 shops R21.99 | Exact 750ml bottle; 7% beer markup." },
  { name: "Sol NRB", bottleFormat: "Dumpy (330ml)", fixed: 107, status: "Receipt-backed", selectedBase: 100, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Sol NRB 330ml 6-pack: tavern base R100; 7% markup." },
  { name: "Sol", bottleFormat: "Can (500ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Sol", bottleFormat: "Quart (640ml)", fixed: 36.38, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Stella Artois", bottleFormat: "Can (500ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Stella Artois", bottleFormat: "Dumpy (330ml)", fixed: 107, status: "Receipt-backed", selectedBase: 100, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Stella Artois NRB 330ml 6-pack: tavern base R100; 7% markup." },
  { name: "Stella Artois", bottleFormat: "Quart (620ml)", fixed: 29.96, status: "Market verified — exact bottle format + 7%", selectedBase: 28, markup: 0.07, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/beer/stella-artois-pure-malt-lager-620ml-2252", notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | LiquorIQ, 1 Nov 2026; exact Stella Artois 620ml, highest R28.00 | Exact 620ml bottle; 7% beer markup." },
  { name: "Windhoek Draught", bottleFormat: "Can (440ml)", fixed: 117.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Windhoek Draught", bottleFormat: "Quart (750ml)", fixed: 41.73, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Windhoek Lager", bottleFormat: "Can (500ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Windhoek Lager", bottleFormat: "Dumpy (330ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Windhoek Lager", bottleFormat: "Quart (750ml)", fixed: 47.08, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Carling Black Label", bottleFormat: "750ml Quart Returnable Bottle Case (12 Pack)", fixed: 310, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Flying Fish Dry Apple", bottleFormat: "Can (500ml)", fixed: 278.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Bacardi Breezer Watermelon 6-pack: tavern base R150; 7% markup; confirm exact volume/format against receipt. | RECONCILIATION MAPPING CORRECTION: Bacardi Breezer Watermelon receipt line does not match Flying Fish; original price restored." },
  { name: "Flying Fish Dry Apple", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Flying Fish Dry Apple", bottleFormat: "Quart (660ml)", fixed: 64.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Flying Fish Lemon", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Flying Fish Lemon", bottleFormat: "Quart (660ml)", fixed: 64.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Belgravia Gin & Dark Cherry", bottleFormat: "Can (500ml)", fixed: 160.5, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Belgravia Gin & Dark Cherry", bottleFormat: "Dumpy (275ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Belgravia Gin & Dry Lemon", bottleFormat: "Can (500ml)", fixed: 160.5, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Belgravia Gin & Dry Lemon", bottleFormat: "Dumpy (275ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bernini Blush", bottleFormat: "Can (500ml)", fixed: 133.75, status: "Receipt-backed", selectedBase: 125, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED MAPPING: Bernini Blush 500ml can 6-pack: tavern base R125; 7% markup." },
  { name: "Bernini Blush", bottleFormat: "Dumpy (275ml)", fixed: 165.85, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bernini Classic", bottleFormat: "Can (500ml)", fixed: 133.75, status: "Receipt-backed", selectedBase: 125, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED MAPPING: Bernini Classic 500ml can 6-pack: tavern base R125; 7% markup." },
  { name: "Bernini Classic", bottleFormat: "Dumpy (275ml)", fixed: 165.85, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bernini Ruby Berry", bottleFormat: "Can (500ml)", fixed: 133.75, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bernini Ruby Berry", bottleFormat: "Dumpy (275ml)", fixed: 165.85, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bacardi Breezer Blackberry", bottleFormat: "Can (500ml)", fixed: 224.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bacardi Breezer Blackberry", bottleFormat: "Dumpy (275ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bacardi Breezer Blueberry", bottleFormat: "Can (500ml)", fixed: 224.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bacardi Breezer Blueberry", bottleFormat: "Dumpy (275ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bacardi Breezer Watermelon", bottleFormat: "Can (500ml)", fixed: 160.5, status: "Receipt-backed", selectedBase: 150, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED MAPPING: Bacardi Breezer Watermelon 500ml can 6-pack: tavern base R150; 7% markup." },
  { name: "Bacardi Breezer Watermelon", bottleFormat: "Dumpy (275ml)", fixed: 197.95, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Brutal Fruit Ruby Apple", bottleFormat: "Can (500ml)", fixed: 144.45, status: "Receipt-backed", selectedBase: 135, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Brutal Fruit Ruby Apple 500ml can 6-pack: tavern base R135; 7% markup." },
  { name: "Brutal Fruit Ruby Apple", bottleFormat: "Dumpy (330ml)", fixed: 214, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Brutal Fruit Strawberry Rouge", bottleFormat: "Can (500ml)", fixed: 144.45, status: "Receipt-backed", selectedBase: 135, markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Brutal Fruit Strawberry 500ml can 6-pack: tavern base R135; 7% markup; SKU catalogue uses Strawberry Rouge." },
  { name: "Brutal Fruit Strawberry Rouge", bottleFormat: "Dumpy (330ml)", fixed: 214, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Do not overwrite with receipt evidence: receipt batch only confirms 500ml can format, not this 330ml dumpy variant." },
  { name: "Chillers Punch Caribbean Chaos", bottleFormat: "Can (500ml)", fixed: 133.75, status: "Receipt-backed", selectedBase: 125, markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Bernini Blush 500ml can 6-pack: tavern base R125; 7% markup; confirm exact SKU mapping." },
  { name: "Chillers Punch Milano Spritz", bottleFormat: "Can (500ml)", fixed: 133.75, status: "Receipt-backed", selectedBase: 125, markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Bernini Classic 500ml can 6-pack: tavern base R125; 7% markup; confirm exact SKU mapping." },
  { name: "Chillers Punch Peach & Mango", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Chillers Punch Tequila Sunrise (Zero Alc)", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Extreme Energy", bottleFormat: "Can (440ml)", fixed: 171.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Extreme Energy", bottleFormat: "Dumpy (330ml)", fixed: 133.75, status: "Invoice-calibrated — verify exact receipt mapping", markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked." },
  { name: "Flying Fish Chill", bottleFormat: "Can (500ml)", fixed: 171.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Flying Fish Chill", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Dry", bottleFormat: "Can (440ml)", fixed: 176.55, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Dry", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Dry", bottleFormat: "Quart (750ml)", fixed: 47.08, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Gold", bottleFormat: "Can (440ml)", fixed: 176.55, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Gold", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Gold", bottleFormat: "Quart (750ml)", fixed: 47.08, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Iced Apple", bottleFormat: "Can (440ml)", fixed: 176.55, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Iced Apple", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Iced Watermelon", bottleFormat: "Can (440ml)", fixed: 176.55, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hunter's Iced Watermelon", bottleFormat: "Dumpy (330ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Mixed Fruit", bottleFormat: "Can (440ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Mixed Fruit", bottleFormat: "Dumpy (330ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Pear", bottleFormat: "Can (440ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Pear", bottleFormat: "Dumpy (330ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Raspberry", bottleFormat: "Can (440ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Raspberry", bottleFormat: "Dumpy (330ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Strawberry & Lime", bottleFormat: "Can (440ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Strawberry & Lime", bottleFormat: "Dumpy (330ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kopparberg Sweet Vintage Pear", bottleFormat: "Can (440ml)", fixed: 299.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's Berry", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's Berry", bottleFormat: "Dumpy (330ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's Dry", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's Dry", bottleFormat: "Dumpy (330ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's MXD Guarana", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's MXD Guarana", bottleFormat: "Quart (660ml)", fixed: 42.8, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's MXD Pine", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's MXD Pine", bottleFormat: "Quart (660ml)", fixed: 42.8, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's Original", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Redd's Original", bottleFormat: "Dumpy (330ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Savanna Angry Lemon", bottleFormat: "Dumpy (330ml)", fixed: 224.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Savanna Dry", bottleFormat: "Can (500ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Savanna Dry", bottleFormat: "Dumpy (330ml)", fixed: 128.4, status: "Receipt-backed — corrected", selectedBase: 120, markup: 0.07, notes: "Original supplied R513.60 is incorrect. Receipt R480 is for 4 six-packs: base per six-pack R120; +7% = R128.40. Final corrected app price R128.40. | RECONCILED: Savanna Dry NRB 330ml 6-pack: R480 is four six-packs; underlying six-pack base R120; 7% markup. R513.60 is incorrect." },
  { name: "Savanna Dry", bottleFormat: "NRB (500ml)", fixed: 53.5, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff Storm Citrus", bottleFormat: "Can (500ml)", fixed: 144.45, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff Storm Citrus", bottleFormat: "Dumpy (250ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff Storm Pine Twist", bottleFormat: "Can (500ml)", fixed: 144.45, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff Storm Pine Twist", bottleFormat: "Dumpy (250ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strongbow Gold Apple", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strongbow Gold Apple", bottleFormat: "Dumpy (330ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strongbow Gold Apple", bottleFormat: "Quart (750ml)", fixed: 49.22, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strongbow Red Berries", bottleFormat: "Can (500ml)", fixed: 192.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strongbow Red Berries", bottleFormat: "Dumpy (330ml)", fixed: 208.65, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strongbow Red Berries", bottleFormat: "Quart (750ml)", fixed: 49.22, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Belgravia Gin & Tonic", bottleFormat: "Can (500ml)", fixed: 160.5, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bain's Cape Mountain", bottleFormat: "750ml Bottle", fixed: 462, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bells Extra Special", bottleFormat: "750ml Bottle", fixed: 209.99, status: "Market-calibrated — source details pending", selectedBase: 199.99, markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Bells Extra Special regular retail benchmark R199.99; 5% markup." },
  { name: "Chivas Regal 12 Year Old", bottleFormat: "750ml Bottle", fixed: 724.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Chivas Regal 15 Year Old", bottleFormat: "750ml Bottle", fixed: 1050, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Firstwatch Whisky", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Glenfiddich 12 Year", bottleFormat: "750ml Bottle", fixed: 1081.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "J&B Rare", bottleFormat: "750ml Bottle", fixed: 209.99, status: "Market-calibrated — source details pending", selectedBase: 199.99, markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: J&B Rare regular retail benchmark R199.99; 5% markup." },
  { name: "Jack Daniel's Old No.7", bottleFormat: "750ml Bottle", fixed: 556.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Jack Daniel's Tennessee Honey", bottleFormat: "750ml Bottle", fixed: 556.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Jameson Caskmates", bottleFormat: "750ml Bottle", fixed: 682.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Jameson Original Irish", bottleFormat: "750ml Bottle", fixed: 477.75, status: "Retail-verified / receipt cross-check", selectedBase: 455, markup: 0.05, sourceDate: "2026-10-19", sourceUrl: "https://liquorprices.co.za/whisky/jameson-irish-whiskey-750ml-5345", notes: "Receipt base R420; higher regular retail R455; 5% markup." },
  { name: "Jameson Select Reserve", bottleFormat: "750ml Bottle", fixed: 693, status: "Retail-verified / receipt cross-check", selectedBase: 660, markup: 0.05, sourceDate: "2026-10-22", sourceUrl: "https://liquorprices.co.za/whisky/jameson-select-reserve-irish-whiskey-750ml-2340", notes: "Receipt base R600; higher regular retail R660; 5% markup." },
  { name: "Johnnie Walker Black Label", bottleFormat: "750ml Bottle", fixed: 524.99, status: "Market-calibrated — source details pending", selectedBase: 499.99, markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Regular retail benchmark R499.99; 5% markup. Source URL/date not included in pasted audit." },
  { name: "Johnnie Walker Double Black", bottleFormat: "750ml Bottle", fixed: 787.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Johnnie Walker Gold Label Reserve", bottleFormat: "750ml Bottle", fixed: 787.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Johnnie Walker Red Label", bottleFormat: "750ml Bottle", fixed: 408.29, status: "Retail-verified / receipt cross-check", selectedBase: 389.99, markup: 0.05, sourceDate: "2026-10-28", sourceUrl: "https://liquorprices.co.za/whisky/johnnie-walker-red-label-750ml-5292", notes: "Market verified — highest comparable regular retail R389.99; 5% markup." },
  { name: "Scottish Leader Original", bottleFormat: "750ml Bottle", fixed: 357, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "The Glenlivet 12 Year", bottleFormat: "750ml Bottle", fixed: 913.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Three Ships 5 Year Old", bottleFormat: "750ml Bottle", fixed: 231, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Jameson Irish Whisky", bottleFormat: "1 Litre Bottle", fixed: 580, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Commando Brandy", bottleFormat: "750ml Bottle", fixed: 304.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "KWV 12 Year", bottleFormat: "750ml Bottle", fixed: 597.45, status: "Retail-verified / receipt cross-check", selectedBase: 569, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/kwv-12-year-old-brandy-750ml-6888", notes: "Receipt base R480; higher regular retail R569; 5% markup." },
  { name: "Klipdrift Export", bottleFormat: "750ml Bottle", fixed: 251.99, status: "Retail-verified / receipt cross-check", selectedBase: 239.99, markup: 0.05, sourceDate: "2026-10-28", sourceUrl: "https://liquorprices.co.za/spirits/klipdrift-export-brandy-750ml-4903", notes: "Market verified — highest comparable regular retail R239.99; 5% markup." },
  { name: "Klipdrift Premium", bottleFormat: "750ml Bottle", fixed: 304.49, status: "Retail-verified / receipt cross-check", selectedBase: 289.99, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/klipdrift-premium-brandy-750ml-14", notes: "Receipt base R260; higher regular retail R289.99; 5% markup." },
  { name: "Viceroy 5 Year Old", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Wellington VO", bottleFormat: "750ml Bottle", fixed: 273, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bisquit & Dubouche VS", bottleFormat: "750ml Bottle", fixed: 640.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bisquit & Dubouche VSOP", bottleFormat: "750ml Bottle", fixed: 1102.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bisquit & Dubouche XO", bottleFormat: "750ml Bottle", fixed: 2415, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Courvoisier VS", bottleFormat: "750ml Bottle", fixed: 682.5, status: "Retail-verified / receipt cross-check", selectedBase: 650, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/courvoisier-vs-cognac-750ml-5864", notes: "Market verified — highest comparable regular retail R650; 5% markup." },
  { name: "Courvoisier VSOP", bottleFormat: "750ml Bottle", fixed: 1071, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "D'USSE VSOP", bottleFormat: "750ml Bottle", fixed: 1375.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hennessy VS", bottleFormat: "750ml Bottle", fixed: 682.5, status: "Retail-verified / receipt cross-check", selectedBase: 650, markup: 0.05, sourceDate: "2026-11-05", sourceUrl: "https://liquorprices.co.za/spirits/hennessy-vs-cognac-750ml-2800", notes: "Receipt base R650; higher than retail dearest R649; 5% markup." },
  { name: "Hennessy VSOP", bottleFormat: "750ml Bottle", fixed: 1144.5, status: "Retail-verified / receipt cross-check", selectedBase: 1090, markup: 0.05, sourceDate: "2026-10-21", sourceUrl: "https://liquorprices.co.za/spirits/hennessy-vsop-cognac-750ml-4522", notes: "Market verified — highest comparable regular retail R1,090; 5% markup." },
  { name: "Hennessy XO", bottleFormat: "750ml Bottle", fixed: 4347, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Honor VS", bottleFormat: "750ml Bottle", fixed: 640.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Martell Blue Swift VSOP", bottleFormat: "750ml Bottle", fixed: 1081.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Martell VS", bottleFormat: "750ml Bottle", fixed: 724.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Remy Martin 1738 Accord Royal", bottleFormat: "750ml Bottle", fixed: 1438.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Remy Martin VSOP", bottleFormat: "750ml Bottle", fixed: 1207.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Klipdrift Export Brandy", bottleFormat: "1 Litre Bottle", fixed: 315, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bombay Sapphire", bottleFormat: "750ml Bottle", fixed: 682.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Cruxland Gin", bottleFormat: "750ml Bottle", fixed: 525, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Flowstone African Bush Botanical", bottleFormat: "750ml Bottle", fixed: 619.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Gordons London Dry", bottleFormat: "750ml Bottle", fixed: 220.49, status: "Retail-verified / receipt cross-check", selectedBase: 209.99, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/gordons-london-dry-gin-750ml-4268", notes: "Receipt base R190; higher regular retail R209.99; 5% markup." },
  { name: "Gordons Pink Berry", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Hendrick's Original", bottleFormat: "750ml Bottle", fixed: 628.95, status: "Retail-verified / receipt cross-check", selectedBase: 599, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/hendricks-gin-750ml-6285", notes: "Market verified — highest comparable regular retail R599; 5% markup." },
  { name: "Inverroche Amber", bottleFormat: "750ml Bottle", fixed: 724.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Inverroche Classic", bottleFormat: "750ml Bottle", fixed: 724.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Inverroche Verdant", bottleFormat: "750ml Bottle", fixed: 724.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "KEM Gin", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kwande Gin Rooibos", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Kwande Gin Witty", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Musgrave Pink", bottleFormat: "750ml Bottle", fixed: 525, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Old Buck Gin", bottleFormat: "750ml Bottle", fixed: 194.25, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Royal Flush Premium", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strettons London Dry", bottleFormat: "750ml Bottle", fixed: 189, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strettons Wild Berry", bottleFormat: "750ml Bottle", fixed: 220.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tanqueray Flor de Sevilla", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tanqueray London Dry Export", bottleFormat: "750ml Bottle", fixed: 378, status: "Receipt-backed", selectedBase: 360, markup: 0.05, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Tanqueray London Dry 750ml: tavern base R360; 5% markup. Exact row name includes Export; verify label equivalence." },
  { name: "Tanqueray No. TEN", bottleFormat: "750ml Bottle", fixed: 871.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Wixworth Gin", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Gordons London Dry Gin", bottleFormat: "1 Litre Bottle", fixed: 285, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Absolut Citron", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Absolut Lime", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Absolut Original Blue", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Absolut Watermelon", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Count Pushkin Vodka", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Cruz Vintage Black Vodka", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Russian Bear Flavours", bottleFormat: "750ml Bottle", fixed: 241.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Russian Bear Standard", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Skyy Vodka Original", bottleFormat: "750ml Bottle", fixed: 330.75, status: "Retail-verified / receipt cross-check", selectedBase: 315, markup: 0.05, sourceDate: "2026-11-05", sourceUrl: "https://liquorprices.co.za/spirits/skyy-vodka-750ml-2002", notes: "Receipt base R300; higher regular retail R315; 5% markup." },
  { name: "Smirnoff Infusions", bottleFormat: "750ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff Red No. 21", bottleFormat: "750ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Wyborowa Vodka", bottleFormat: "750ml Bottle", fixed: 388.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Belvedere Pure Vodka", bottleFormat: "750ml Bottle", fixed: 629.99, status: "Retail-verified / receipt cross-check", selectedBase: 599.99, markup: 0.05, sourceDate: "2026-10-30", sourceUrl: "https://liquorprices.co.za/spirits/belvedere-vodka-750ml-2391", notes: "Market verified — highest comparable regular retail R599.99; 5% markup." },
  { name: "Ciroc Apple", bottleFormat: "750ml Bottle", fixed: 777, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ciroc Mango", bottleFormat: "750ml Bottle", fixed: 777, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ciroc Original Premium", bottleFormat: "750ml Bottle", fixed: 378, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ciroc Pineapple", bottleFormat: "750ml Bottle", fixed: 777, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Grey Goose Luxury", bottleFormat: "750ml Bottle", fixed: 1060.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff 1818 Vodka", bottleFormat: "750ml Bottle", fixed: 215, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Smirnoff 1818 Vodka", bottleFormat: "1 Litre Bottle", fixed: 275, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Captain Morgan Spiced Gold", bottleFormat: "750ml Bottle", fixed: 231, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "El Jimador Reposado", bottleFormat: "750ml Bottle", fixed: 315, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Jose Cuervo Especial Reposado", bottleFormat: "750ml Bottle", fixed: 372.75, status: "Retail-verified / receipt cross-check", selectedBase: 355, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/jose-cuervo-especial-tequila-reposado-750ml-737", notes: "Market verified — highest comparable regular retail R355; 5% markup." },
  { name: "Jose Cuervo Especial Silver", bottleFormat: "750ml Bottle", fixed: 682.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Olmeca Plata", bottleFormat: "750ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Olmeca Reposado", bottleFormat: "750ml Bottle", fixed: 388.49, status: "Retail-verified / receipt cross-check", selectedBase: 369.99, markup: 0.05, sourceDate: "2026-10-28", sourceUrl: "https://liquorprices.co.za/spirits/olmeca-reposado-tequila-750ml-1399", notes: "Receipt base R350; higher regular retail R369.99; 5% markup." },
  { name: "Ponchos Blanco Tequila", bottleFormat: "750ml Bottle", fixed: 525, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ponchos Caramel Tequila", bottleFormat: "750ml Bottle", fixed: 525, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Casamigos Blanco", bottleFormat: "750ml Bottle", fixed: 1144.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Casamigos Reposado", bottleFormat: "750ml Bottle", fixed: 1701, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Clase Azul Plata", bottleFormat: "750ml Bottle", fixed: 3129, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Clase Azul Reposado", bottleFormat: "750ml Bottle", fixed: 4872, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Don Julio Blanco", bottleFormat: "750ml Bottle", fixed: 1134, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Don Julio Reposado", bottleFormat: "750ml Bottle", fixed: 987, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Patron Reposado", bottleFormat: "750ml Bottle", fixed: 1375.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Patron Silver Luxury", bottleFormat: "750ml Bottle", fixed: 1375.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Amarula Ethiopian Coffee", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Amarula Original Cream", bottleFormat: "750ml Bottle", fixed: 209.99, status: "Retail-verified / receipt cross-check", selectedBase: 199.99, markup: 0.05, sourceDate: "2026-10-28", sourceUrl: "https://liquorprices.co.za/spirits/amarula-cream-liqueur-750ml-5812", notes: "Receipt base R190; higher regular retail R199.99; 5% markup." },
  { name: "Amarula Raspberry Chocolate Cream", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Baileys Original Irish Cream", bottleFormat: "750ml Bottle", fixed: 388.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Banana Liqueur (Butlers)", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Blue Curacao (Butlers)", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Blue Curacao (Peddler's)", bottleFormat: "750ml Bottle", fixed: 315, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Cape Velvet Cream", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Chambord Black Raspberry", bottleFormat: "500ml Bottle", fixed: 546, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Cherry Kirsch Liqueur (Butlers)", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Cointreau Orange Liqueur", bottleFormat: "750ml Bottle", fixed: 693, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Disaronno Amaretto Liqueur", bottleFormat: "750ml Bottle", fixed: 546, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Drambuie Honey/Scotch", bottleFormat: "750ml Bottle", fixed: 420, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Espresso/Coffee Liqueur (Butlers)", bottleFormat: "750ml Bottle", fixed: 231, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Frangelico Hazelnut Liqueur", bottleFormat: "750ml Bottle", fixed: 336, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ginger Liqueur (Butlers)", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Grand Marnier Cordon Rouge", bottleFormat: "750ml Bottle", fixed: 913.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Jagermeister Herbal Liqueur", bottleFormat: "750ml Bottle", fixed: 440.99, status: "Retail-verified / receipt cross-check", selectedBase: 419.99, markup: 0.05, sourceDate: "2026-11-06", sourceUrl: "https://liquorprices.co.za/spirits/jagermeister-750ml-2542", notes: "Receipt base R360; higher regular retail R419.99; 5% markup." },
  { name: "Kahlua Coffee Liqueur", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Malibu Coconut Rum Liqueur", bottleFormat: "750ml Bottle", fixed: 388.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Nachtmusik Chocolate Liqueur", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Peach Schnapps (Relic)", bottleFormat: "750ml Bottle", fixed: 273, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Peppermint Liqueur (Butlers)", bottleFormat: "750ml Bottle", fixed: 231, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ponchos Tequila Coffee", bottleFormat: "750ml Bottle", fixed: 409.49, status: "Retail-verified / receipt cross-check", selectedBase: 389.99, markup: 0.05, sourceDate: "2026-10-28", sourceUrl: "https://liquorprices.co.za/spirits/ponchos-1910-coffee-tequila-750ml-5900", notes: "Receipt base R320; higher regular retail R389.99; 5% markup." },
  { name: "Sambuca Lupini Black", bottleFormat: "750ml Bottle", fixed: 357, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Sambuca Lupini Gold", bottleFormat: "750ml Bottle", fixed: 357, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Southern Comfort", bottleFormat: "750ml Bottle", fixed: 204.75, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strawberry Lips", bottleFormat: "750ml Bottle", fixed: 262.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Strawberry Liqueur (Butlers)", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tequila Rose Cream Liqueur", bottleFormat: "750ml Bottle", fixed: 430.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tia Maria Coffee Liqueur", bottleFormat: "750ml Bottle", fixed: 472.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Triple Sec (Butlers)", bottleFormat: "750ml Bottle", fixed: 252, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Triple Sec (Peddler's)", bottleFormat: "750ml Bottle", fixed: 315, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Triple Sec Premium (San Basile)", bottleFormat: "750ml Bottle", fixed: 336, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Van Der Hum Tangerine (Butlers)", bottleFormat: "750ml Bottle", fixed: 283.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Wild Africa Cream Liqueur", bottleFormat: "750ml Bottle", fixed: 162.75, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bug Booster", bottleFormat: "20ml Shot Bottle", fixed: 21, status: "Invoice-calibrated — verify exact receipt mapping", markup: 0.05, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked." },
  { name: "Moet & Chandon Imperial Brut", bottleFormat: "750ml Bottle", fixed: 791.8, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Retail comparison from audit is a starting/promo price only; do not reduce until regular-price comparison is documented." },
  { name: "Veuve Clicquot Yellow Label", bottleFormat: "750ml Bottle", fixed: 1230.5, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Retail comparison from audit is a starting/promo price only; do not reduce until regular-price comparison is documented." },
  { name: "JC Le Roux La Fleurette", bottleFormat: "750ml Bottle", fixed: 144.45, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "JC Le Roux Le Domaine", bottleFormat: "750ml Bottle", fixed: 144.45, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Krone Borealis Brut (MCC)", bottleFormat: "750ml Bottle", fixed: 235.4, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Pongracz Brut", bottleFormat: "750ml Bottle", fixed: 288.9, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Retail comparison lacks regular-price confirmation; preserve listed price pending evidence." },
  { name: "4th Street Sweet Red", bottleFormat: "750ml Bottle", fixed: 85.6, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: 4th Street Sweet Red 750ml: R46 reference appears promotional/starting; no verified regular-price maximum supplied." },
  { name: "4th Street Sweet White", bottleFormat: "750ml Bottle", fixed: 85.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Beyerskloof Pinotage", bottleFormat: "750ml Bottle", fixed: 197.95, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Beyerskloof Pinotage R114.99 is a starting/special reference; regular retail maximum not supplied." },
  { name: "Castillo de Liria Sweet Red", bottleFormat: "750ml Bottle", fixed: 112.35, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Drostdy-Hof Adelpracht Sweet", bottleFormat: "750ml Bottle", fixed: 112.35, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Drostdy-Hof Adelpracht 750ml requires exact regular-price match." },
  { name: "Kanonkop Kadette Cabernet", bottleFormat: "750ml Bottle", fixed: 256.8, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "M'hudi Chenin Blanc", bottleFormat: "750ml Bottle", fixed: 288.9, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "M'hudi Pinotage", bottleFormat: "750ml Bottle", fixed: 278.2, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Nederburg Baronne", bottleFormat: "750ml Bottle", fixed: 144.45, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Nederburg Baronne R81.90 is a starting/special reference; regular retail maximum not supplied." },
  { name: "Nederburg Sauvignon Blanc", bottleFormat: "750ml Bottle", fixed: 133.75, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Robertson Winery Sweet Merlot", bottleFormat: "750ml Bottle", fixed: 112.35, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Robertson Chapel Dry Red", bottleFormat: "1.5L Bottle", fixed: 112.35, status: "Needs verification", markup: 0.07, notes: "Source list labels this price invoice-calibrated. Receipt is bill-only; exact master SKU/pack match must be checked. | RECONCILED: Robertson Chapel Dry Red 1.5L: market reference supplied but regular-price maximum not established." },
  { name: "Saint Raphael Smooth Red", bottleFormat: "750ml Bottle", fixed: 112.35, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Sedgwick's Old Brown", bottleFormat: "750ml Bottle", fixed: 85.6, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Seven Sisters Pinotage/Cab", bottleFormat: "750ml Bottle", fixed: 117.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "4th Street Sweet Red", bottleFormat: "5 Litre Box", fixed: 288.9, status: "Needs verification", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: 4th Street Sweet Red 5L: case listing cannot be compared directly with a single box." },
  { name: "4th Street Sweet Rosé", bottleFormat: "5 Litre Box", fixed: 288.9, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "4th Street Sweet White", bottleFormat: "5 Litre Box", fixed: 288.9, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Drostdy-Hof Adelpracht Sweet", bottleFormat: "3 Litre Box", fixed: 176.55, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Drostdy-Hof Claret Select", bottleFormat: "5 Litre Box", fixed: 224.7, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Paarl Perle White", bottleFormat: "2 Litre Co-Pack", fixed: 144.45, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Robertson Winery Smooth Red", bottleFormat: "3 Litre Box", fixed: 214, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Sedgwick's Old Brown", bottleFormat: "2 Litre Box", fixed: 160.5, status: "User-supplied listed app price — not independently verified", markup: 0.07, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Red Bull Energy Drink", bottleFormat: "Can (355ml)", fixed: 273, status: "Needs verification", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Red Bull 355ml listed as six-pack; R27.99 is an individual-can reference, not a matching multipack price." },
  { name: "Angostura Aromatic Bitters", bottleFormat: "200ml Bottle", fixed: 115.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Appletiser Sparkling Apple Juice", bottleFormat: "1L", fixed: 50.4, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Coca-Cola Original Taste Less Sugar", bottleFormat: "2L", fixed: 47.25, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Liqui Fruit Cranberry Cooler", bottleFormat: "1L", fixed: 57.75, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Lime Cordial", bottleFormat: "750ml Bottle", fixed: 73.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Passion Fruit Cordial", bottleFormat: "750ml Bottle", fixed: 73.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Maraschino Cherries (Syrup)", bottleFormat: "350ml Jar", fixed: 99.75, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Agave", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Almond Orgeat", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Blue Curaçao Syrup", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Cherry", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Crème Brûlée", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Falernum", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Grenadine", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Kiwi Syrup", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Lemon Pie / Tarte Citron", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Lemon Tea / Citron", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Melon", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin Spicy Mango", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Monin White Chocolate", bottleFormat: "700ml Bottle", fixed: 367.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Schweppes Tonic Water", bottleFormat: "Can (200ml)", fixed: 78, status: "Market reference only — pending", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided. | RECONCILED: Schweppes Tonic Water 200ml 6-pack retail reference R74.99; retain current price until regular-price comparison is confirmed." },
  { name: "Schweppes Lemonade", bottleFormat: "Can (200ml)", fixed: 78, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Aquelle Sparkling Water", bottleFormat: "500ml", fixed: 19.95, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Aquelle Still Water", bottleFormat: "1.5L", fixed: 21, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bonaqua Still Water", bottleFormat: "1.5L", fixed: 29.4, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Bonaqua Still Water", bottleFormat: "500ml", fixed: 15.75, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Thirsti Still Water", bottleFormat: "1.5L", fixed: 23.1, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tsitsikamma Sparkling Water", bottleFormat: "1L", fixed: 27.3, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tsitsikamma Sparkling Water", bottleFormat: "500ml", fixed: 16.8, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tsitsikamma Still Water", bottleFormat: "1.5L", fixed: 27.3, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Tsitsikamma Still Water", bottleFormat: "500ml", fixed: 14.7, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Valpre Natural Spring Water", bottleFormat: "1.5L", fixed: 31.5, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Valpre Natural Spring Water", bottleFormat: "500ml", fixed: 16.8, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Valpre Sparkling Water", bottleFormat: "1L", fixed: 30.45, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ekoyini Crushed Ice", bottleFormat: "1kg", fixed: 30, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ekoyini Crushed Ice", bottleFormat: "2kg", fixed: 45, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ekoyini Ice Bag", bottleFormat: "1kg", fixed: 20, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
  { name: "Ekoyini Ice Bag", bottleFormat: "2kg", fixed: 35, status: "User-supplied listed app price — not independently verified", markup: 0.05, notes: "Preserved exactly from supplied catalogue. Base price and independent retail comparator not provided." },
];

const PRICE_COMING_SOON = [{"name":"Strettons Ruby Orange","bottleFormat":"750ml Bottle"},{"name":"Strettons Triple Berry","bottleFormat":"750ml Bottle"},{"name":"Sambuca Lupini Blue","bottleFormat":"750ml Bottle"}];

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
  { from: 'Seven Sisters Pinotage/Cabernet', to: 'Seven Sisters Pinotage/Cab' },
  { from: 'Sol', to: 'Sol NRB', bottleFormat: 'Dumpy (330ml)' },
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
  { name: 'Savanna Dry', from: 'Quart (500ml)', to: 'NRB (500ml)' },
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
  // Explicitly unpriced master rows stay unpriced until an exact source is
  // verified; do not backfill them from stale or approximate legacy lists.
  if (PRICE_COMING_SOON.some((p) => p.name === row.name && p.bottleFormat === row.bottleFormat)) return null;

  // Workbook prices are final customer prices, already carrying the agreed
  // markup. Never apply the markup again to those rows.
  const final = finalPriceFor(row.name, row.bottleFormat);
  if (final != null && final > 0) return round2(final);

  // Future rows without a workbook final may use an explicit fixed final
  // override or the higher comparable source/regular-retail base, marked up
  // once at the category rate.
  const hit = shopPriceFor(row.name, row.bottleFormat);
  if (hit && Number(hit.fixed) > 0) return round2(Number(hit.fixed));
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
  MARKUP_RATE_BY_CATEGORY, DEFAULT_MARKUP_RATE, markupRateForCategory, SHOP_PRICES, FINAL_CUSTOMER_PRICES, PRICE_COMING_SOON, NAME_FIXES, FORMAT_FIXES, NEW_PRODUCTS, SPIRIT_CATEGORIES,
  roundTavern, tavernPrice, casePrice, shopPriceFor, finalPriceFor, newSinglePrice, isRemovedSize,
};
