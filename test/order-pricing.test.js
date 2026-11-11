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
  assert.equal(r.coolerDiscount, 55); // 2.5% of 2200 (2.5% starts at R2000)
  assert.equal(r.promoDiscount, 214.5); // 10% of 2145
  assert.equal(r.safetySealFee, 10);
  assert.equal(r.total, 2200 - 55 - 214.5 + 117 + 10);
});

test("priceOrder: no Cooler Box discount after 20:00 SA time", () => {
  const r = P.priceOrder({ lines: [{ category: "BEER", total: 2500 }], deliveryTotal: 0, now: NIGHT });
  assert.equal(r.coolerDiscount, 0);
});

test("priceOrder: bad values never produce NaN", () => {
  const r = P.priceOrder({ lines: [{ category: "BEER", total: "abc" }], deliveryTotal: undefined });
  assert.equal(r.total, 0);
});

test("coolerNudge points at the one 2.5% tier, then stops", () => {
  assert.deepEqual(
    { needed: P.coolerNudge(400, DAY).needed, pct: P.coolerNudge(400, DAY).pct },
    { needed: 1600, pct: 0.025 }
  );
  assert.equal(P.coolerNudge(2500, DAY), null, "no second tier any more");
  assert.equal(P.coolerNudge(4000, DAY), null);
  assert.equal(P.coolerNudge(400, NIGHT), null);
});

// Bottles & crates on returnable quarts (founder, 10 Nov 2026).
test("bottles & crates: R52 per crate of 12, R3 a loose bottle", () => {
  assert.equal(P.bottleDepositFor(12, true).fee, 52); // R2 x 12 + R28 crate
  assert.equal(P.bottleDepositFor(12, false).fee, 36); // no crate: R3 x 12
  assert.equal(P.bottleDepositFor(6, true).fee, 18); // under a crate: R3 each
  assert.equal(P.bottleDepositFor(18, true).fee, 70); // 1 crate + 6 loose
  assert.equal(P.bottleDepositFor(96, true).fee, 416); // 8 crates
  assert.equal(P.bottleDepositFor(0, true).fee, 0);
  assert.equal(P.bottleDepositFor("abc", true).fee, 0);
});

test("only returnable quarts carry the bottle charge", () => {
  const fs = require("fs");
  const path = require("path");
  const rows = fs.readFileSync(path.join(__dirname, "../prisma/data/skus.csv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
  const returnable = rows.filter((r) => P.isReturnableQuart(r[0], r[2])).map((r) => r[0]).sort();
  assert.deepEqual(returnable, [
    "Carling Black Label", "Castle Lager", "Castle Lite", "Castle Milk Stout", "Flying Fish Dry Apple", "Flying Fish Lemon",
    "Hansa Pilsener", "Lion Lager", "Redd's Berry", "Redd's MXD Guarana", "Redd's MXD Pine", "Redd's Original", "Strongbow Gold Apple", "Strongbow Red Berries",
    "Windhoek Draught", "Windhoek Lager",
  ]);
  for (const [name, fmt] of [["Amstel Lager", "Quart (660ml)"], ["Corona Extra", "Quart (600ml)"], ["Stella Artois", "Quart (620ml)"],
    ["Heineken", "Quart (650ml)"], ["Hunter's Dry", "Quart (660ml)"], ["Castle Lager", "Can (500ml)"], ["Carling Black Label", "Dumpy (330ml)"]]) {
    assert.equal(P.isReturnableQuart(name, fmt), false, `${name} ${fmt}`);
  }
});

test("priceOrder adds bottles & crates after every discount", () => {
  const r = P.priceOrder({ lines: [{ category: "BEER", total: 2400 }], deliveryTotal: 80, bottleDeposit: 52, now: DAY });
  assert.equal(r.coolerDiscount, 60); // 2.5% of the drinks only, never of the bottles
  assert.equal(r.bottleDepositFee, 52);
  assert.equal(r.total, 2400 - 60 + 80 + 52);
});

test("No GPS pin: allowed with a landmark, refused without one", () => {
  // Taverns have pins but the customer didn't share one.
  assert.ok(P.noPinProblem({ needsPin: true, hasPin: false, landmark: "" }), "no pin and no landmark is refused");
  assert.ok(P.noPinProblem({ needsPin: true, hasPin: false, landmark: "  ab " }), "a 2-letter landmark is too short");
  assert.equal(P.noPinProblem({ needsPin: true, hasPin: false, landmark: "Blue gate opposite the spaza" }), null);
  // With a pin, or before any tavern has a pin, nothing extra is asked.
  assert.equal(P.noPinProblem({ needsPin: true, hasPin: true, landmark: "" }), null);
  assert.equal(P.noPinProblem({ needsPin: false, hasPin: false, landmark: "" }), null);
  // No pin means the base delivery fee (distance unknown).
  assert.equal(P.distanceDeliveryFee(null), P.BASE_DELIVERY_FEE);
});
