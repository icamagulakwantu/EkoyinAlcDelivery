// lib/price-corrections-2026-11-08.js
//
// Founder-requested price correction (8 Nov 2026): "check the entire SKU
// list, Amstel quarts can't be R47". Many rows still carried unverified
// prices that were far above the shelf (Amstel and Hansa quarts at R47.08,
// beer six-packs at R165–R210, Monin at R367.50) and a few were below it
// (Ciroc Original at R378).
//
// Rule (unchanged, the founder's own): customer price = the HIGHEST regular
// shelf price of the same pack (never a crate or case divided down, never a
// promotion) + 7% (beer, cider/RTD, wine) or 5% (spirits, liqueurs,
// mixers, energy drinks, water). Six-packs are priced per pack. Promotion
// prices are never used.
//
// `verified: true`  = the shelf price was seen on a South African retailer
//                     listing (Shoprite/Checkers/Woolworths/PriceCheck) on
//                     8 Nov 2026, or is the regular price already recorded
//                     in SHOP_PRICES.
// `verified: false` = estimate from the same brand's other packs or the
//                     same price tier. Worth a check on the shelf.
//
// Founder-fixed prices are deliberately NOT in this list and stay as they
// are: Johnnie Walker Red R315, Klipdrift Export R252, Castle Milk Stout
// quart R29.96, Heineken dumpy R117.70, Hennessy VS R682.50, Corona dumpy
// R135, Bernini cans R133.75, Brutal Fruit cans R144.45, Sambuca Lupini R357.
//
// Pure data, unit-tested in test/price-corrections.test.js.

const BEER = 0.07; // beer, cider/RTD, wine
const SPIRIT = 0.05; // spirits, liqueurs, mixers, energy drinks, water

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// [name, bottleFormat, shelf price of the exact pack sold, markup, verified, source]
const ROWS = [
  // ── Beer (six-packs are per pack) ──
  ['Amstel Lager', 'Can (500ml)', 109.99, BEER, false, 'Amstel cans R18.99 each (Shoprite); 6-pack estimate'],
  ['Amstel Lager', 'Dumpy (330ml)', 99.99, BEER, false, 'Amstel 330ml R16.99 each (Shoprite); 6-pack estimate'],
  ['Amstel Lager', 'Quart (660ml)', 23.99, BEER, true, 'Checkers single 660ml R23.99 (9 Nov: single bottle, not crate / 12)'],
  ['Carling Black Label', 'Can (500ml)', 115, BEER, true, 'Siba receipt 9 Nov 2026: 6 x 500ml R115 (Shoprite R104.99)'],
  ['Carling Black Label', 'Dumpy (330ml)', 99.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 330ml R99.99'],
  ['Carling Black Label', 'Quart (750ml)', 21.99, BEER, true, 'Shoprite Liquor single 750ml R21.99 (9 Nov: single bottle, not crate / 12)'],
  ['Budweiser', 'Can (500ml)', 109.99, BEER, false, 'Premium-lager can tier estimate'],
  ['Budweiser', 'Dumpy (330ml)', 99.99, BEER, false, 'Premium-lager dumpy tier estimate (Stella 6 x 330ml R99.99)'],
  ['Castle Lager', 'Can (500ml)', 94.99, BEER, true, 'Checkers 6 x 500ml R94.99'],
  ['Castle Lager', 'Dumpy (330ml)', 89.99, BEER, false, 'Same tier as Black Label 6 x 340ml R89.99'],
  ['Castle Lite', 'Dumpy (330ml)', 99.99, BEER, false, 'Premium-lager dumpy tier estimate'],
  ['Castle Milk Stout', 'Can (500ml)', 104.99, BEER, true, 'Shoprite and Checkers 6 x 500ml R104.99'],
  ['Castle Milk Stout', 'Dumpy (330ml)', 99.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 330ml R99.99'],
  ['Corona Extra', 'Can (410ml)', 119.99, BEER, false, 'Import can tier estimate'],
  ['Guinness Draught Stout', 'Can (440ml)', 6 * 27.99, BEER, false, '6 cans at R27.99 (SHOP_PRICES records R28 a can)'],
  ['Guinness Foreign Extra', '325ml Bottle', 24, BEER, true, 'Ekoyini retail list base R24 (SHOP_PRICES)'],
  ['Guinness Foreign Extra', 'Can (440ml)', 139.99, BEER, false, 'Import stout can tier estimate'],
  ['Hansa Pilsener', 'Can (500ml)', 94.99, BEER, true, 'Checkers 6 x 500ml R94.99'],
  ['Hansa Pilsener', 'Dumpy (330ml)', 89.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 330ml R89.99'],
  ['Hansa Pilsener', 'Quart (750ml)', 19.99, BEER, true, 'Shoprite 750ml R19.99'],
  ['Heineken', 'Can (500ml)', 129.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 500ml R129.99'],
  ['Heineken', 'Quart (650ml)', 29.99, BEER, true, 'Highest regular retail R29.99 (liquorprices.co.za; Shoprite R27.99)'],
  ['Lion Lager', 'Can (500ml)', 89.99, BEER, true, 'Checkers 6 x 500ml R89.99'],
  ['Sol', 'Can (500ml)', 109.99, BEER, false, 'Import can tier estimate'],
  ['Sol', 'Quart (640ml)', 27.99, BEER, false, 'Same tier as Heineken 650ml R27.99'],
  ['Stella Artois', 'Can (500ml)', 109.99, BEER, false, 'Premium-lager can tier estimate'],
  ['Windhoek Draught', 'Can (440ml)', 114.99, BEER, true, 'Shoprite 6 x 440ml R114.99'],
  ['Windhoek Lager', 'Can (500ml)', 114.99, BEER, true, 'Checkers 6 x 440ml R114.99'],
  ['Windhoek Lager', 'Dumpy (330ml)', 104.99, BEER, false, 'Premium-lager dumpy tier estimate'],

  // ── Cider and RTDs (six-packs) ──
  ['Bacardi Breezer Blackberry', 'Can (500ml)', 150, BEER, true, 'Siba receipt 9 Nov 2026: 6 x 500ml R150'],
  ['Bacardi Breezer Blueberry', 'Can (500ml)', 150, BEER, false, 'Same as Blackberry and Watermelon cans (Siba receipt 9 Nov 2026 R150)'],
  ['Bacardi Breezer Watermelon', 'Can (500ml)', 150, BEER, true, 'Siba receipt 9 Nov 2026: 6 x 500ml R150'],
  ['Ice Tropez', 'Dumpy (275ml)', 489.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 275ml R489.99'],
  ['Bacardi Breezer Blackberry', 'Dumpy (275ml)', 124.99, BEER, false, 'Same as Blueberry 6 x 275ml R124.99'],
  ['Bacardi Breezer Blueberry', 'Dumpy (275ml)', 124.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 275ml R124.99'],
  ['Bacardi Breezer Watermelon', 'Dumpy (275ml)', 124.99, BEER, false, 'Same as Blueberry 6 x 275ml R124.99'],
  ['Belgravia Gin & Dark Cherry', 'Can (440ml)', 154.99, BEER, false, 'Same as Belgravia G&T 6 x 440ml R154.99'],
  ['Belgravia Gin & Dry Lemon', 'Can (440ml)', 154.99, BEER, false, 'Same as Belgravia G&T 6 x 440ml R154.99'],
  ['Belgravia Gin & Tonic', 'Can (440ml)', 154.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 440ml R154.99'],
  ['Belgravia Gin & Dark Cherry', 'Dumpy (275ml)', 129.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 275ml R129.99'],
  ['Belgravia Gin & Dry Lemon', 'Dumpy (275ml)', 129.99, BEER, false, 'Same as Dark Cherry 6 x 275ml R129.99'],
  ['Bernini Blush', 'Dumpy (275ml)', 109.99, BEER, false, 'Highest price on file R109.99 (Shoprite 6 x 275ml R104.99, 11 Nov 2026; founder rule: always the higher price)'],
  ['Bernini Classic', 'Dumpy (275ml)', 109.99, BEER, false, 'Highest price on file R109.99 (Shoprite 6 x 275ml R104.99, 11 Nov 2026; founder rule: always the higher price)'],
  ['Bernini Ruby Berry', 'Dumpy (275ml)', 109.99, BEER, false, 'Highest price on file R109.99 (Shoprite 6 x 275ml R104.99, 11 Nov 2026; founder rule: always the higher price)'],
  ['Brutal Fruit Ruby Apple', 'Dumpy (275ml)', 119.94, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 275ml bottle R19.99 x 6'],
  ['Brutal Fruit Strawberry Rouge', 'Dumpy (275ml)', 119.94, BEER, false, 'Same as Ruby Apple 275ml R19.99 x 6'],
  ['Chillers Punch Peach & Mango', 'Can (440ml)', 154.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 440ml R154.99'],
  ['Chillers Punch Tequila Sunrise (Zero Alc)', 'Can (440ml)', 154.99, BEER, false, 'Same as Peach & Mango 6 x 440ml R154.99'],
  ['Flying Fish Chill', 'Can (500ml)', 119.99, BEER, false, 'Flying Fish Lemon 6 x 500ml R109.99 (Checkers) to Dry Apple R134.99'],
  ['Flying Fish Chill', 'Dumpy (330ml)', 104.99, BEER, false, 'Flavoured-beer 6 x 330ml tier (Hunter\'s R104.99)'],
  ['Flying Fish Dry Apple', 'Can (500ml)', 134.99, BEER, true, 'Shoprite 6 x 500ml R134.99'],
  ['Flying Fish Dry Apple', 'Dumpy (330ml)', 104.99, BEER, false, 'Flavoured-beer 6 x 330ml tier (Hunter\'s R104.99)'],
  ['Flying Fish Dry Apple', 'Quart (660ml)', 24.99, BEER, false, 'Same as Flying Fish Lemon quart (R27.81)'],
  ['Flying Fish Lemon', 'Dumpy (330ml)', 104.99, BEER, false, 'Flavoured-beer 6 x 330ml tier (Hunter\'s R104.99)'],
  ["Hunter's Dry", 'Can (440ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Hunter's Dry", 'Dumpy (330ml)', 104.99, BEER, true, 'Shoprite 6 x 330ml R104.99'],
  ["Hunter's Gold", 'Can (440ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Hunter's Gold", 'Dumpy (330ml)', 104.99, BEER, true, 'Checkers 6 x 330ml R104.99'],
  ["Hunter's Iced Apple", 'Can (500ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Hunter's Iced Apple", 'Dumpy (330ml)', 104.99, BEER, false, 'Same as Hunter\'s Dry 6 x 330ml R104.99'],
  ["Hunter's Iced Watermelon", 'Can (500ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Hunter's Iced Watermelon", 'Dumpy (330ml)', 104.99, BEER, false, 'Same as Hunter\'s Dry 6 x 330ml R104.99'],
  ['Kopparberg Mixed Fruit', 'Can (440ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Mixed Fruit', 'Dumpy (330ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Pear', 'Can (440ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Pear', 'Dumpy (330ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Raspberry', 'Can (440ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Raspberry', 'Dumpy (330ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Strawberry & Lime', 'Can (440ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Strawberry & Lime', 'Dumpy (330ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ['Kopparberg Sweet Vintage Pear', 'Can (440ml)', 180, BEER, false, 'Sold as 4 x 330ml in SA (~R30 each); 6-pack estimate'],
  ["Redd's Berry", 'Can (500ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Redd's Berry", 'Dumpy (330ml)', 104.99, BEER, false, 'Cider 6 x 330ml tier (Hunter\'s R104.99)'],
  ["Redd's Dry", 'Can (500ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Redd's Dry", 'Dumpy (330ml)', 104.99, BEER, false, 'Cider 6 x 330ml tier (Hunter\'s R104.99)'],
  ["Redd's MXD Guarana", 'Can (440ml)', 143.94, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): single 440ml can R23.99 x 6'],
  ["Redd's MXD Pine", 'Can (440ml)', 143.94, BEER, false, 'Same as MXD Guarana 440ml R23.99 x 6'],
  ["Redd's Original", 'Can (500ml)', 119.99, BEER, false, 'Cider can tier estimate'],
  ["Redd's Original", 'Dumpy (330ml)', 104.99, BEER, false, 'Cider 6 x 330ml tier (Hunter\'s R104.99)'],
  ['Savanna Angry Lemon', 'Dumpy (330ml)', 124.99, BEER, false, 'Savanna Dry 6 x 330ml R119.99–R124.99'],
  ['Savanna Dry', 'Can (500ml)', 134.99, BEER, false, 'Savanna 500ml tier estimate'],
  ['Savanna Dry', 'NRB (500ml)', 165 / 6, BEER, true, 'Siba receipt 9 Nov 2026: 6 x 500ml R165 (R27.50 a bottle)'],
  ['Castle Lite', 'Can (500ml)', 115, BEER, true, 'Siba receipt 9 Nov 2026: 6 x 500ml R115'],
  ['Smirnoff Storm Citrus', 'Can (440ml)', 144.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 440ml regular R144.99'],
  ['Smirnoff Storm Pine Twist', 'Can (440ml)', 144.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 440ml regular R144.99'],
  ['Smirnoff Storm Citrus', 'Dumpy (250ml)', 99.99, BEER, false, 'RTD 250ml tier estimate'],
  ['Smirnoff Storm Pine Twist', 'Dumpy (250ml)', 99.99, BEER, false, 'RTD 250ml tier estimate'],
  ['Strongbow Gold Apple', 'Can (440ml)', 129.99, BEER, false, 'Same as Red Berries 6 x 440ml R129.99'],
  ['Strongbow Gold Apple', 'Dumpy (330ml)', 114.99, BEER, false, 'Same as Red Berries 6 x 330ml R114.99'],
  ['Strongbow Red Berries', 'Can (440ml)', 129.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 440ml R129.99'],
  ['Strongbow Red Berries', 'Dumpy (330ml)', 114.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 330ml R114.99'],

  // ── Shoprite shelf check, 11 Nov 2026 (founder screenshots) ──
  ['Strongbow Gold Apple', 'Quart (660ml)', 30, BEER, false, 'Highest verified retail on file R30 (Shoprite 660ml R28.99)'],
  ['Strongbow Red Berries', 'Quart (660ml)', 30, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 660ml R28.99; highest verified retail on file R30'],
  ["Redd's Berry", 'Quart (660ml)', 24.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 660ml R24.99 (new product)'],
  ["Redd's Original", 'Quart (660ml)', 24.99, BEER, false, 'Same as Berry 660ml R24.99 (new product)'],
  ['Chillers Punch Caribbean Chaos', 'Can (440ml)', 154.99, BEER, false, 'Same as Peach & Mango 6 x 440ml R154.99'],
  ['Chillers Punch Milano Spritz', 'Can (440ml)', 154.99, BEER, false, 'Same as Peach & Mango 6 x 440ml R154.99'],
  ['Extreme Energy', 'Dumpy (275ml)', 149.94, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): Extreme Guarana 275ml R24.99 x 6'],

  // ── Beer & spirits, Shoprite shelf check 11 Nov 2026: only where it RAISES our price (founder rule) ──
  ['Sol NRB', 'Dumpy (330ml)', 104.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 330ml R104.99'],
  ['Stella Artois', 'Dumpy (330ml)', 104.99, BEER, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 6 x 330ml R104.99'],
  ['Southern Comfort', '750ml Bottle', 199.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml regular R199.99 (R159.99 was a promotion)'],
  ['Wild Africa Cream Liqueur', '750ml Bottle', 169.99, SPIRIT, false, 'Same as Wild Africa Chocolate and Caffe Latte R169.99 (Shoprite, 11 Nov 2026)'],

  // ── Brandy ──
  ['Commando Brandy', '750ml Bottle', 194.99, SPIRIT, true, 'Checkers 750ml R194.99'],
  ['Klipdrift Premium', '750ml Bottle', 289.99, SPIRIT, true, 'Highest regular retail R289.99 (liquorprices.co.za)'],
  ['Viceroy 5 Year Old', '750ml Bottle', 224.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml regular R224.99 (R189.99 was a promotion)'],
  ['Wellington VO', '750ml Bottle', 219.99, SPIRIT, false, 'Shelf estimate'],

  // ── Whisky ──
  ['Chivas Regal 12 Year Old', '750ml Bottle', 599.99, SPIRIT, false, 'Shelf estimate'],
  ['Chivas Regal 15 Year Old', '750ml Bottle', 899.99, SPIRIT, false, 'Shelf estimate'],
  ['Firstwatch Whisky', '750ml Bottle', 199.99, SPIRIT, false, 'Shelf estimate'],
  ['Glenfiddich 12 Year', '750ml Bottle', 599.99, SPIRIT, true, 'Checkers Hyper / Pick n Pay R599.99'],
  ["Jack Daniel's Old No.7", '750ml Bottle', 429.99, SPIRIT, false, 'Shelf estimate'],
  ["Jack Daniel's Tennessee Honey", '750ml Bottle', 429.99, SPIRIT, false, 'Same as Old No.7'],
  ['Jameson Caskmates', '750ml Bottle', 469.99, SPIRIT, true, 'Checkers and Shoprite R469.99'],
  ['Jameson Original Irish', '750ml Bottle', 455, SPIRIT, true, 'Highest regular retail R455 (liquorprices.co.za; Checkers R399.99)'],
  ['Jameson Select Reserve', '750ml Bottle', 660, SPIRIT, true, 'Highest regular retail R660 (liquorprices.co.za; Checkers R589.99)'],
  ['Johnnie Walker Double Black', '750ml Bottle', 699.99, SPIRIT, false, 'Shelf estimate'],
  ['Scottish Leader Original', '750ml Bottle', 309.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R309.99'],
  ['The Glenlivet 12 Year', '750ml Bottle', 649.99, SPIRIT, false, 'Shelf estimate'],

  // ── Cognac (regular bases already recorded in SHOP_PRICES) ──
  ['Bisquit & Dubouche VS', '750ml Bottle', 649.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml regular R649.99 (R550 was a promotion)'],
  ['Bisquit & Dubouche VSOP', '750ml Bottle', 840, SPIRIT, true, 'Ekoyini retail base R840 (SHOP_PRICES)'],
  ['Courvoisier VSOP', '750ml Bottle', 949.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R949.99'],
  ['Hennessy VSOP', '750ml Bottle', 1090, SPIRIT, true, 'Highest regular retail R1,090 (liquorprices.co.za; Ultra Liquors case R989/bottle)'],
  ['Honor VS', '750ml Bottle', 490, SPIRIT, true, 'Ultra Liquors R490 (SHOP_PRICES); Shoprite Honor VS Gold Edition R599.99 is a different bottle'],
  ['Martell VS', '750ml Bottle', 579.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R579.99'],

  // ── Gin ──
  ['Bombay Sapphire', '750ml Bottle', 379.99, SPIRIT, true, 'Woolworths R329.99–R379.99 (higher used)'],
  ['Flowstone African Bush Botanical', '750ml Bottle', 449.99, SPIRIT, false, 'Craft-gin tier estimate'],
  ['Gordons Pink Berry', '750ml Bottle', 217.06, SPIRIT, true, 'Ekoyini retail base R217.06 (SHOP_PRICES)'],
  ["Hendrick's Original", '750ml Bottle', 599, SPIRIT, true, 'Highest regular retail R599 (liquorprices.co.za; old Ekoyini list R450)'],
  ['Inverroche Amber', '750ml Bottle', 539.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R539.99'],
  ['Inverroche Classic', '750ml Bottle', 499.99, SPIRIT, false, 'Craft-gin tier estimate'],
  ['Inverroche Verdant', '750ml Bottle', 499.99, SPIRIT, false, 'Craft-gin tier estimate'],
  ['Tanqueray Flor de Sevilla', '750ml Bottle', 360, SPIRIT, true, 'Ekoyini retail base R360 (SHOP_PRICES)'],
  ['Tanqueray No. TEN', '750ml Bottle', 649.99, SPIRIT, false, 'Shelf estimate'],

  // ── Vodka ──
  ['Absolut Citron', '750ml Bottle', 319.99, SPIRIT, true, 'Checkers R319.99 (all Absolut flavours)'],
  ['Absolut Lime', '750ml Bottle', 319.99, SPIRIT, true, 'Checkers R319.99'],
  ['Absolut Original Blue', '750ml Bottle', 319.99, SPIRIT, true, 'Checkers R319.99'],
  ['Absolut Watermelon', '750ml Bottle', 319.99, SPIRIT, true, 'Shoprite R319.99'],
  ['Count Pushkin Vodka', '750ml Bottle', 229.99, SPIRIT, false, 'Shelf estimate'],
  ['Cruz Vintage Black Vodka', '750ml Bottle', 349.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml regular R349.99 (R249.99 was a promotion)'],
  ['Russian Bear Standard', '750ml Bottle', 229.99, SPIRIT, false, 'Not above the Russian Bear flavours (R241.50)'],
  ['Smirnoff Infusions', '750ml Bottle', 229.99, SPIRIT, false, 'Shelf estimate'],
  ['Smirnoff Red No. 21', '750ml Bottle', 279.99, SPIRIT, false, 'Shelf estimate'],
  ['Wyborowa Vodka', '750ml Bottle', 299.99, SPIRIT, false, 'Shelf estimate'],
  ['Ciroc Apple', '750ml Bottle', 599.99, SPIRIT, false, 'Same as Ciroc Original'],
  ['Ciroc Mango', '750ml Bottle', 599.99, SPIRIT, false, 'Same as Ciroc Original'],
  ['Ciroc Original Premium', '750ml Bottle', 599.99, SPIRIT, true, 'Checkers R599.99 (was under-priced at R378)'],
  ['Ciroc Pineapple', '750ml Bottle', 599.99, SPIRIT, false, 'Same as Ciroc Original'],
  ['Grey Goose Luxury', '750ml Bottle', 749.99, SPIRIT, false, 'Shelf estimate'],

  // ── Tequila ──
  ['Jose Cuervo Especial Silver', '750ml Bottle', 355, SPIRIT, false, 'Same as Jose Cuervo Reposado (R372.75)'],
  ['Ponchos Blanco Tequila', '750ml Bottle', 349.99, SPIRIT, false, 'Shelf estimate'],
  ['Ponchos Caramel Tequila', '750ml Bottle', 349.99, SPIRIT, false, 'Shelf estimate'],
  ['Casamigos Reposado', '750ml Bottle', 1199.99, SPIRIT, false, 'Shelf estimate'],

  // ── Liqueurs ──
  ['Amarula Ethiopian Coffee', '750ml Bottle', 229.99, SPIRIT, false, 'Amarula range tier estimate'],
  ['Amarula Raspberry Chocolate Cream', '750ml Bottle', 229.99, SPIRIT, false, 'Amarula range tier estimate'],
  ['Banana Liqueur (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ['Blue Curacao (Butlers)', '750ml Bottle', 229.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R229.99'],
  ['Cherry Kirsch Liqueur (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ['Espresso/Coffee Liqueur (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ['Ginger Liqueur (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ['Peppermint Liqueur (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ['Strawberry Liqueur (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ['Triple Sec (Butlers)', '750ml Bottle', 229.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R229.99'],
  ['Van Der Hum Tangerine (Butlers)', '750ml Bottle', 229.99, SPIRIT, false, 'Same as Butlers Triple Sec and Blue Curacao R229.99 (Shoprite, 11 Nov 2026)'],
  ["Blue Curacao (Peddler's)", '750ml Bottle', 240, SPIRIT, true, 'Ekoyini retail base R240 (SHOP_PRICES)'],
  ["Triple Sec (Peddler's)", '750ml Bottle', 240, SPIRIT, true, 'Ekoyini retail base R240 (SHOP_PRICES)'],
  ['Cape Velvet Cream', '750ml Bottle', 199.99, SPIRIT, false, 'Cream-liqueur tier estimate'],
  ['Cointreau Orange Liqueur', '750ml Bottle', 449, SPIRIT, true, 'Norman Goodfellows R449 (PriceCheck)'],
  ['Disaronno Amaretto Liqueur', '750ml Bottle', 429.99, SPIRIT, false, 'Shelf estimate'],
  ['Frangelico Hazelnut Liqueur', '750ml Bottle', 329.99, SPIRIT, true, 'Shoprite Ziyabuya 11 Nov 2026 (founder screenshot): 750ml R329.99'],
  ['Grand Marnier Cordon Rouge', '750ml Bottle', 649.99, SPIRIT, false, 'Shelf estimate'],
  ['Jagermeister Herbal Liqueur', '750ml Bottle', 419.99, SPIRIT, true, 'Highest regular retail R419.99 (liquorprices.co.za; Ultra Liquors R295)'],
  ['Kahlua Coffee Liqueur', '750ml Bottle', 319.99, SPIRIT, true, 'Checkers R319.99'],
  ['Malibu Coconut Rum Liqueur', '750ml Bottle', 269.99, SPIRIT, false, 'Shelf estimate'],
  ['Nachtmusik Chocolate Liqueur', '750ml Bottle', 199.99, SPIRIT, false, 'Cream-liqueur tier estimate'],
  ['Peach Schnapps (Relic)', '750ml Bottle', 205, SPIRIT, true, 'Ekoyini retail base R205 (SHOP_PRICES)'],
  ['Ponchos Tequila Coffee', '750ml Bottle', 389.99, SPIRIT, true, 'Highest regular retail R389.99 (liquorprices.co.za; founder receipt R336)'],
  ['Strawberry Lips', '750ml Bottle', 179.99, SPIRIT, false, 'Shelf estimate'],
  ['Tequila Rose Cream Liqueur', '750ml Bottle', 299.99, SPIRIT, false, 'Shelf estimate'],
  ['Tia Maria Coffee Liqueur', '750ml Bottle', 299.99, SPIRIT, false, 'Same tier as Kahlua R319.99'],

  // ── Mixers, energy drinks, water ──
  ['Angostura Aromatic Bitters', '200ml Bottle', 90, SPIRIT, true, 'Ekoyini retail base R90 (SHOP_PRICES)'],
  ['Appletiser Sparkling Apple Juice', '1L', 32.99, SPIRIT, false, 'Shelf estimate'],
  ['Coca-Cola Original Taste Less Sugar', '2L', 26.99, SPIRIT, true, 'Checkers 6 x 2L R159.99 (R26.67 each)'],
  ['Liqui Fruit Cranberry Cooler', '1L', 32.99, SPIRIT, false, 'Shelf estimate'],
  ['Monin Agave', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Almond Orgeat', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Blue Curaçao Syrup', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Cherry', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Crème Brûlée', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Falernum', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Grenadine', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Kiwi Syrup', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Lemon Pie / Tarte Citron', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Lemon Tea / Citron', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Melon', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin Spicy Mango', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Monin White Chocolate', '700ml Bottle', 219.99, SPIRIT, false, 'Monin 700ml shelf estimate'],
  ['Bonaqua Still Water', '1.5L', 17.99, SPIRIT, false, 'Shelf estimate'],
  ['Thirsti Still Water', '1.5L', 18, SPIRIT, false, 'Founder estimate R18 (CLAUDE.md)'],
  ['Tsitsikamma Sparkling Water', '1L', 17.99, SPIRIT, false, 'Shelf estimate'],
  ['Tsitsikamma Still Water', '1.5L', 19.99, SPIRIT, false, 'Shelf estimate'],
  ['Valpre Natural Spring Water', '1.5L', 18.99, SPIRIT, false, 'Shelf estimate'],
  ['Valpre Sparkling Water', '1L', 16.99, SPIRIT, false, 'Shelf estimate'],

  // ── Wine (7%) ──
  ['Beyerskloof Pinotage', '750ml Bottle', 119.99, BEER, false, 'Shelf estimate'],
  ['Kanonkop Kadette Cabernet', '750ml Bottle', 159.99, BEER, false, 'Shelf estimate'],
  ['Nederburg Baronne', '750ml Bottle', 109.99, BEER, false, 'Shelf estimate'],
  ['Nederburg Sauvignon Blanc', '750ml Bottle', 99.99, BEER, false, 'Shelf estimate'],
  ['Veuve Clicquot Yellow Label', '750ml Bottle', 920, BEER, true, 'Ekoyini retail base R920 (SHOP_PRICES)'],
];

const PRICE_CORRECTIONS = ROWS.map(([name, bottleFormat, shelf, markup, verified, source]) => ({
  name,
  bottleFormat,
  shelf: round2(shelf),
  markup,
  verified,
  source,
  fixed: round2(round2(shelf) * (1 + markup)),
}));

function correctedPriceFor(name, bottleFormat) {
  const hit = PRICE_CORRECTIONS.find((p) => p.name === name && p.bottleFormat === bottleFormat);
  return hit ? hit.fixed : null;
}

module.exports = { PRICE_CORRECTIONS, correctedPriceFor };
