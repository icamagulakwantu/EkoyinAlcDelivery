// priceOrder() is the one total calculation shared by the cart, checkout
// and server — these pin down its order of operations and the Safety Seal rule.
const test = require("node:test");
const assert = require("node:assert");
const P = require("../public/pricing.js");

const DAY = new Date("2026-11-08T10:00:00Z"); // 12:00 SA — Cooler Box open
const NIGHT = new Date("2026-11-08T19:00:00Z"); // 21:00 SA — Cooler Box closed

test("Safety Seal is only charged when the order has a spirit", () => {
  assert.equal(P.safetySealFeeFor(true, ["BEER", "CIDER_RTD"]), 0);
  assert.equal(P.safetySealFeeFor(true, ["BEER", "GIN"]), P.SAFETY_SEAL_FEE);
  assert.equal(P.safetySealFeeFor(false, ["GIN"]), 0);
  assert.equal(P.safetySealFeeFor("yes", ["GIN"]), 0, "only a real true opts in");
});

test("priceOrder: subtotal, Cooler Box, promo on the remainder, delivery, seal", () => {
  const r = P.priceOrder({
    lines: [{ category: "BEER", total: 1200 }, { category: "GIN", total: 1000 }],
    promoPct: 10,
    deliveryTotal: 117,
    safetySeal: true,
    now: DAY,
  });
  assert.equal(r.subtotal, 2200);
  assert.equal(r.coolerDiscount, 110); // 5% of 2200 (5% starts at R2000)
  assert.equal(r.promoDiscount, 209); // 10% of 2090
  assert.equal(r.safetySealFee, 10);
  assert.equal(r.total, 2200 - 110 - 209 + 117 + 10);
});

test("priceOrder: no Cooler Box discount after 20:00 SA time", () => {
  const r = P.priceOrder({ lines: [{ category: "BEER", total: 2500 }], deliveryTotal: 0, now: NIGHT });
  assert.equal(r.coolerDiscount, 0);
});

test("priceOrder: bad values never produce NaN", () => {
  const r = P.priceOrder({ lines: [{ category: "BEER", total: "abc" }], deliveryTotal: undefined });
  assert.equal(r.total, 0);
});

test("coolerNudge points at the next tier", () => {
  assert.deepEqual(
    { needed: P.coolerNudge(400, DAY).needed, pct: P.coolerNudge(400, DAY).pct },
    { needed: 1600, pct: 0.05 }
  );
  assert.equal(P.coolerNudge(2500, DAY).pct, 0.08);
  assert.equal(P.coolerNudge(2500, DAY).needed, 1500);
  assert.equal(P.coolerNudge(4000, DAY), null);
  assert.equal(P.coolerNudge(400, NIGHT), null);
});
