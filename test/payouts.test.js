// Daily payouts: taverns get the shelf price (item price less our markup)
// plus bottles; drivers get 100% of delivery, surge and priority, less any
// cash they collected; Ekoyini keeps the rest (founder, 11 Nov 2026).
const test = require("node:test");
const assert = require("node:assert");
const { buildPayouts, driverKey, saDay, saDayRange } = require("../lib/payouts.js");

const markup = (c) => (["BEER", "CIDER_RTD", "WINE"].includes(c) ? 0.07 : 0.05);
const tavern = { id: "tav_1", name: "KwaSiba", phone: "27640000000" };

test("tavern gets the shelf price plus bottles; driver gets every delivery rand", () => {
  const r = buildPayouts([{
    code: "EKO-1", total: 642.5, paymentMethod: "eft",
    deliveryFee: 52, surgeFee: 10, priorityFee: 20, bottleDepositFee: 52,
    driverName: "Sipho", driverPhone: "072 123 4567", tavern,
    items: [{ price: 107, quantity: 2, category: "BEER" }, { price: 262.5, quantity: 1, category: "BRANDY" }],
  }], markup);
  // 214 / 1.07 = 200 ; 262.5 / 1.05 = 250 ; + 52 bottles
  assert.equal(r.taverns[0].owed, 502);
  assert.equal(r.drivers[0].earned, 82);
  assert.equal(r.drivers[0].owed, 82);
  assert.equal(r.totals.ekoyini, 642.5 - 502 - 82);
});

test("cash orders: the driver keeps their fee from the cash and owes the rest", () => {
  const r = buildPayouts([
    { code: "EKO-C", total: 900, paymentMethod: "cod", deliveryFee: 40, driverName: "Sipho", driverPhone: "0721234567", tavern, items: [{ price: 856, quantity: 1, category: "BEER" }] },
    { code: "EKO-D", total: 500, paymentMethod: "card", deliveryFee: 60, driverName: "Sipho", driverPhone: "+27 72 123 4567", tavern, items: [{ price: 420, quantity: 1, category: "GIN" }] },
  ], markup);
  assert.equal(r.drivers.length, 1, "the same phone written three ways is one driver");
  assert.equal(r.drivers[0].earned, 100);
  assert.equal(r.drivers[0].cashCollected, 900);
  assert.equal(r.drivers[0].owed, -800, "negative: the driver owes Ekoyini");
  assert.equal(r.totals.yocoFees, Math.round((500 * 0.0325 + 2.5) * 100) / 100);
});

test("an order without a tavern or driver is listed, not lost", () => {
  const r = buildPayouts([{ code: "EKO-X", total: 400, paymentMethod: "eft", items: [] }], markup);
  assert.deepEqual(r.unassigned, ["EKO-X"]);
});

test("South African days", () => {
  assert.equal(driverKey("072 123 4567"), "27721234567");
  assert.equal(saDay(new Date("2026-11-10T22:30:00Z")), "2026-11-11"); // 00:30 SA
  const { start, end } = saDayRange("2026-11-10");
  assert.equal(start.toISOString(), "2026-11-09T22:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-10T22:00:00.000Z");
});
