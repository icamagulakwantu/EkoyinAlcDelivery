// test/pricing-rules.test.js — run with `node --test`
// Fee rules decided by the founder in Nov 2026.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/pricing.js');
const C = require('../lib/catalogue-2026-11.js');

// South Africa is UTC+2 all year, so 17:59Z is 19:59 and 18:00Z is 20:00 there.
const at = (hhmmUtc) => new Date(`2026-11-04T${hhmmUtc}:00Z`);

test('Care & Handling is 3% of items, at least R10 and at most R40, with no jumps (founder, 10 Nov 2026)', () => {
  const cases = [[100, 10], [300, 10], [500, 15], [1000, 30], [1333.33, 40], [2000, 40], [5000, 40]];
  for (const [subtotal, fee] of cases) assert.equal(P.serviceFeeFor(subtotal), fee, `R${subtotal}`);
  assert.equal(P.serviceFeeFor('abc'), 0);
  assert.equal(P.careFeeFor(0), 0);
  // Never goes down as the basket grows.
  let last = 0;
  for (let r = 300; r <= 3000; r += 7) { const f = P.careFeeFor(r); assert.ok(f >= last, `R${r}`); last = f; }
});

test('there is no free delivery: a big order still pays the distance fee', () => {
  assert.equal(P.FREE_DELIVERY_THRESHOLD, undefined);
  assert.equal(P.deliveryFee(5000), 40);
  const q = P.buildDeliveryQuote({ subtotal: 2500, distanceKm: 3, priorityFee: 0, now: at('08:00') });
  assert.equal(q.deliveryFee, 40);
  assert.equal(q.serviceFee, 40); // capped
  assert.equal(q.total, 80);
});

test('distance like the delivery apps: R40 covers 3 km, then R6 a km, no jumps (founder, 10 Nov 2026)', () => {
  assert.equal(P.distanceDeliveryFee(null), 40);
  assert.equal(P.distanceDeliveryFee(2), 40);
  assert.equal(P.distanceDeliveryFee(3), 40);
  assert.equal(P.distanceDeliveryFee(5), 52);
  assert.equal(P.distanceDeliveryFee(10), 82);
  let last = 0;
  for (let km = 0; km <= 30; km += 0.25) { const f = P.distanceDeliveryFee(km); assert.ok(f >= last, `${km} km`); last = f; }
});

test('heavy loads pay the driver more: R1.50 a kg above 20 kg', () => {
  // A normal cooler box: 4 six-packs of cans, a bottle, 2 kg of ice.
  const box = [
    { bottleFormat: 'Can (500ml)', packSize: 6, category: 'BEER', quantity: 4 },
    { bottleFormat: '750ml Bottle', packSize: 1, category: 'WHISKY', quantity: 1 },
    { bottleFormat: '2kg', packSize: 1, category: 'ICE', quantity: 1 },
  ];
  assert.ok(P.orderWeightKg(box) < 20);
  assert.equal(P.loadFeeFor(P.orderWeightKg(box)), 0);
  // The founder's 96 Black Label quarts (8 crates): about 120 kg.
  const crates = [{ bottleFormat: 'Quart (750ml)', packSize: 1, category: 'BEER', quantity: 96 }];
  const kg = P.orderWeightKg(crates);
  assert.ok(kg > 110 && kg < 130, `${kg} kg`);
  assert.equal(P.loadFeeFor(kg), Math.round((kg - 20) * 1.5)); // whole rands
  assert.equal(P.loadFeeFor(20.25), 0); // a few grams over shows nothing, not R0.38
  const q = P.buildDeliveryQuote({ subtotal: 2258.88, distanceKm: 3, priorityFee: 0, now: at('08:00'), weightKg: kg });
  assert.equal(q.distanceFee, 40);
  assert.equal(q.loadFee, P.loadFeeFor(kg));
  assert.equal(q.deliveryFee, Math.round((40 + q.loadFee) * 100) / 100);
  assert.equal(q.total, Math.round((q.deliveryFee + 40) * 100) / 100);
  // No weight given: no load fee.
  assert.equal(P.buildDeliveryQuote({ subtotal: 500, distanceKm: 1, priorityFee: 0, now: at('08:00') }).loadFee, 0);
});

test('service fee no longer depends on distance or surge, and surge stays separate', () => {
  const day = P.buildDeliveryQuote({ subtotal: 600, distanceKm: 12, priorityFee: 0, now: at('08:00') });
  assert.equal(day.serviceFee, 18);
  const night = P.buildDeliveryQuote({ subtotal: 600, distanceKm: 1, priorityFee: 10, now: at('21:00') }); // 23:00 SA
  assert.equal(night.serviceFee, 18);
  assert.equal(night.surgeFee, 30);
  assert.equal(night.total, 40 + 30 + 10 + 18);
});

test('Cooler Box: 2.5% from R2000, 3.5% from R4000 (founder, 11 Nov 2026)', () => {
  const noon = at('10:00');
  assert.equal(P.coolerDiscountPct(1999.99, noon), 0);
  assert.equal(P.coolerDiscountPct(2000, noon), 0.025);
  assert.equal(P.coolerDiscountPct(3999.99, noon), 0.025);
  assert.equal(P.coolerDiscountPct(4000, noon), 0.035);
  assert.equal(P.pctLabel(0.025), '2.5%');
  assert.equal(P.pctLabel(0.035), '3.5%');
});

test('Discounts never pass half our markup, and cases have no discount (founder, 11 Nov 2026)', () => {
  // Markup is 5% (spirits, mixers, water, ice) or 7% (beer, cider, RTD, wine).
  assert.ok(P.COOLER_TOP_DISCOUNT_PCT <= 0.07 / 2, 'top Cooler Box tier stays at or under 3.5% (half of 7%)');
  assert.ok(P.COOLER_DISCOUNT_PCT <= 0.05 / 2, 'first Cooler Box tier stays at or under 2.5% (half of 5%)');
  assert.equal(C.CASE_DISCOUNT_PCT, 0);
  assert.equal(C.casePrice(130, 4, 8), 520, 'an old 8% case discount is ignored');
});

test('Cooler Box is only available until 20:00 South African time', () => {
  assert.equal(P.coolerDiscountPct(2500, at('17:59')), 0.025); // 19:59
  assert.equal(P.coolerDiscountPct(2500, at('18:00')), 0); // 20:00
  assert.equal(P.coolerDiscountPct(5000, at('20:30')), 0); // 22:30
  assert.equal(P.coolerDiscountPct(2500, at('01:59')), 0); // 03:59
  assert.equal(P.coolerDiscountPct(2500, at('02:00')), 0.025); // 04:00
});

test('minimum delivery order stays R300', () => {
  assert.equal(P.MIN_ORDER_SUBTOTAL, 300);
});

test('Castle Milk Stout: shelf-corrected packs, founder-fixed quart', () => {
  const row = (bottleFormat, packSize, listPriceZAR) => ({ name: 'Castle Milk Stout', bottleFormat, packSize, listPriceZAR });
  assert.equal(C.newSinglePrice(row('Can (500ml)', 6, 24.22)), 130); // R130 can six-pack floor (founder, 9 Nov 2026)
  assert.equal(C.newSinglePrice(row('Quart (750ml)', 1, 38.65)), 29.96); // founder-fixed
  assert.equal(C.newSinglePrice(row('Dumpy (330ml)', 6, 25.95)), 106.99); // Shoprite R99.99 + 7% (11 Nov 2026)
  assert.equal(C.casePrice(130, 4, 8), 520); // no case discount (11 Nov 2026)
  assert.equal(C.casePrice(29.96, 12, 8), 359.52);
  assert.equal(C.casePrice(101.64, 4, 8), 406.56);
});
