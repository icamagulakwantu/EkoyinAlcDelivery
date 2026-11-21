// lib/founder-prices-2026-11-09.js
//
// Founder decisions of 9 Nov 2026, made after comparing the app with his
// Siba stock receipts. These are FINAL customer prices: no markup is added
// on top, and they win over every other price list (finalPriceFor checks
// this file first).
//
// 1. Fixed prices the founder named.
// 2. "No can carry pack should be less than R130": every alcoholic six-pack
//    of cans costs at least R130. Corona and Savanna keep their own prices
//    (the founder's named exceptions). Cold drinks and mixers are sold loose
//    or in their own packs and are not covered.
// 3. "14% within reason, on a few strategic bottles": Siba cost + 14% on the
//    slower spirits from the receipts, instead of the 15–28% they reached
//    from the highest-retail rule.
//
// Pure data, unit-tested in test/founder-prices.test.js.

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

const STRATEGIC_MARKUP = 0.14;

// [name, bottleFormat, final customer price, reason]
const FIXED = [
  ['Heineken', 'Dumpy (330ml)', 145, 'Founder price 9 Nov 2026 (6 x 330ml dumpies; Siba R130)'],
  ['Castle Lite', 'Can (500ml)', 130, 'Founder price 9 Nov 2026 (6 x 500ml; Siba R115)'],
  ['Carling Black Label', 'Can (500ml)', 130, 'Founder price 9 Nov 2026 (6 x 500ml; Siba R115)'],
  ['Savanna Dry', 'NRB (500ml)', 210, 'Founder price 9 Nov 2026: six-pack of 500ml bottles (Siba R165)'],
  ['Appletiser Sparkling Apple Juice', '1L', 45, 'Founder price 9 Nov 2026'],
  ['Red Bull Energy Drink', 'Can (250ml)', 30, 'Founder price 9 Nov 2026: single 250ml can (Siba R25)'],
  ['Red Bull Energy Drink', 'Can (355ml)', 35, 'Founder price 19 Nov 2026: single 355ml can, hard to find in the taverns'],
  ['Coca-Cola Original', 'Can (500ml)', 20, 'Founder price 9 Nov 2026: single 500ml can (Siba R15)'],
  ['Budweiser', 'Dumpy (330ml)', 120, 'Founder price 21 Nov 2026: six-pack of 330ml dumpies; shelf R74.99 would be too low, we never go for lesser prices'],
  ['Windhoek Lager', 'Dumpy (330ml)', 110, 'Founder price 21 Nov 2026: six-pack of 330ml dumpies (shelf R104.99)'],
];

// [name, bottleFormat, Siba cost] → cost + 14%
const STRATEGIC = [
  ['Jagermeister Herbal Liqueur', '750ml Bottle', 360],
  ['Ponchos Tequila Coffee', '750ml Bottle', 320],
  ['Jameson Original Irish', '750ml Bottle', 420],
  ['Jameson Select Reserve', '750ml Bottle', 600],
  ['Olmeca Reposado', '750ml Bottle', 350],
];

// Founder, 19 Nov 2026: every 1.5L water is R25 (taverns sell it at R20).
const WATER_15L = [
  'Aquelle Still Water', 'Aquelle Sparkling Water', 'Bonaqua Still Water', 'Bonaqua Sparkling Water',
  'Thirsti Still Water', 'Thirsti Sparkling Water', 'Tsitsikamma Still Water', 'Tsitsikamma Sparkling Water',
  'Valpre Natural Spring Water', 'Valpre Sparkling Water',
].map((name) => [name, '1.5L', 25, 'Founder 19 Nov 2026: taverns sell 1.5L water at R20, so every 1.5L water is R25']);

// Founder, 19 Nov 2026: "fix the prices that are below". These sold under the
// supplier case price per unit. Now supplier unit price + the category markup
// (7% beer/cider/RTD, 5% mixers/water), so the tavern payout (price / (1 + markup))
// equals what the item costs.
// [name, bottleFormat, supplier price per unit, markup]
const WAS_BELOW_COST = [
  ['Hansa Pilsener', 'Quart (750ml)', 22.31, 0.07],
  ["Hunter's Dry", 'Quart (660ml)', 34.92, 0.07],
  ["Hunter's Gold", 'Quart (660ml)', 34.92, 0.07],
  ["Hunter's Iced Apple", 'Quart (660ml)', 34.92, 0.07], // 19 Nov late: was labelled 330ml dumpy; same supplier cost as the other Hunter's quarts
  ["Hunter's Iced Watermelon", 'Quart (660ml)', 34.92, 0.07],
  ["Redd's Berry", 'Quart (660ml)', 30.83, 0.07],
  ["Redd's Original", 'Quart (660ml)', 30.83, 0.07],
  ['Strongbow Gold Apple', 'Quart (660ml)', 32.98, 0.07],
  ['Strongbow Red Berries', 'Quart (660ml)', 32.98, 0.07],
  ['Coca-Cola Original Taste Less Sugar', '2L', 29, 0.05],
  ['Casamigos Reposado', '750ml Bottle', 816, 0.05], // 19 Nov late: real shelf R749.99 is under Siba cost, so cost + 5%
  ['Ciroc Pineapple', '750ml Bottle', 422.4, 0.05], // 19 Nov late: real shelf R369 is under Siba cost, so cost + 5%
  ['Valpre Sparkling Water', '1L', 18.75, 0.05],
];

const FOUNDER_PRICES = [
  ...WATER_15L.map(([name, bottleFormat, price, reason]) => ({ name, bottleFormat, fixed: round2(price), reason })),
  ...WAS_BELOW_COST.map(([name, bottleFormat, cost, markup]) => ({
    name, bottleFormat, cost, fixed: round2(cost * (1 + markup)),
    reason: `Founder 19 Nov 2026: was below cost; supplier R${cost} + ${markup * 100}%`,
  })),
  ...FIXED.map(([name, bottleFormat, price, reason]) => ({ name, bottleFormat, fixed: round2(price), reason })),
  ...STRATEGIC.map(([name, bottleFormat, cost]) => ({
    name, bottleFormat, cost, fixed: round2(cost * (1 + STRATEGIC_MARKUP)),
    reason: `Founder decision 9 Nov 2026: Siba cost R${cost} + 14%`,
  })),
];

const CAN_SIXPACK_FLOOR = 130;
const FLOOR_EXEMPT = /^(Corona|Savanna)/;
// Cans that are not alcoholic six-packs (sold loose, or their own pack).
const NOT_ALCOHOL_CANS = /^(Red Bull|Coca-Cola|Mofaya|Schweppes)/;

function founderPriceFor(name, bottleFormat) {
  const hit = FOUNDER_PRICES.find((p) => p.name === name && p.bottleFormat === bottleFormat);
  return hit ? hit.fixed : null;
}

// Applies the R130 floor to an already-worked-out price.
function applyCanFloor(name, bottleFormat, price) {
  if (price == null) return price;
  if (!/^Can/.test(String(bottleFormat))) return price;
  if (FLOOR_EXEMPT.test(name) || NOT_ALCOHOL_CANS.test(name)) return price;
  return Math.max(price, CAN_SIXPACK_FLOOR);
}

module.exports = {
  FOUNDER_PRICES, CAN_SIXPACK_FLOOR, STRATEGIC_MARKUP, founderPriceFor, applyCanFloor, NOT_ALCOHOL_CANS,
};
