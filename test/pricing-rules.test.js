// test/pricing-rules.test.js — run with `node --test`
// Fee rules decided by the founder in Nov 2026.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/pricing.js');
const C = require('../lib/catalogue-2026-11.js');

// South Africa is UTC+2 all year, so 17:59Z is 19:59 and 18:00Z is 20:00 there.
const at = (hhmmUtc) => new Date(`2026-11-04T${hhmmUtc}:00Z`);

test('Care & Handling fee bands follow the current subtotal percentages', () => {
  const cases = [[300, 15], [499.99, 25], [500, 25], [799.99, 40], [800, 56], [1200, 84], [1200.5, 84.04], [1201, 84.07], [1599.99, 112], [1600, 112], [5000, 750]];
  for (const [subtotal, fee] of cases) assert.equal(P.serviceFeeFor(subtotal), fee, `R${subtotal}`);
  assert.equal(P.serviceFeeFor('abc'), 0);
});

test('there is no free delivery: a big order still pays the distance fee', () => {
  assert.equal(P.FREE_DELIVERY_THRESHOLD, undefined);
  assert.equal(P.deliveryFee(5000), 40);
  const q = P.buildDeliveryQuote({ subtotal: 2500, distanceKm: 3, priorityFee: 0, now: at('08:00') });
  assert.equal(q.deliveryFee, 40);
  assert.equal(q.serviceFee, 375);
  assert.equal(q.total, 415);
});

test('service fee no longer depends on distance or surge, and surge stays separate', () => {
  const day = P.buildDeliveryQuote({ subtotal: 600, distanceKm: 12, priorityFee: 0, now: at('08:00') });
  assert.equal(day.serviceFee, 30);
  const night = P.buildDeliveryQuote({ subtotal: 600, distanceKm: 1, priorityFee: 10, now: at('21:00') }); // 23:00 SA
  assert.equal(night.serviceFee, 30);
  assert.equal(night.surgeFee, 30);
  assert.equal(night.total, 40 + 30 + 10 + 30);
});

test('Cooler Box: 5% from R1000, 8% above R2000', () => {
  const noon = at('10:00');
  assert.equal(P.coolerDiscountPct(999.99, noon), 0);
  assert.equal(P.coolerDiscountPct(1000, noon), 0.05);
  assert.equal(P.coolerDiscountPct(2000, noon), 0.05);
  assert.equal(P.coolerDiscountPct(2000.01, noon), 0.08);
});

test('Cooler Box is only available until 20:00 South African time', () => {
  assert.equal(P.coolerDiscountPct(1500, at('17:59')), 0.05); // 19:59
  assert.equal(P.coolerDiscountPct(1500, at('18:00')), 0); // 20:00
  assert.equal(P.coolerDiscountPct(3000, at('20:30')), 0); // 22:30
  assert.equal(P.coolerDiscountPct(1500, at('01:59')), 0); // 03:59
  assert.equal(P.coolerDiscountPct(1500, at('02:00')), 0.05); // 04:00
});

test('minimum delivery order stays R300', () => {
  assert.equal(P.MIN_ORDER_SUBTOTAL, 300);
});

test('Castle Milk Stout uses its current receipt-calibrated customer prices', () => {
  const row = (bottleFormat, packSize, listPriceZAR) => ({ name: 'Castle Milk Stout', bottleFormat, packSize, listPriceZAR });
  assert.equal(C.newSinglePrice(row('Can (500ml)', 6, 24.22)), 139.1);
  assert.equal(C.newSinglePrice(row('Quart (750ml)', 1, 38.65)), 28.88);
  assert.equal(C.newSinglePrice(row('Dumpy (330ml)', 6, 25.95)), 128.4);
  assert.equal(C.casePrice(139.1, 4, 8), 511.89);
  assert.equal(C.casePrice(28.88, 12, 8), 318.84);
  assert.equal(C.casePrice(128.4, 4, 8), 472.51);
});
