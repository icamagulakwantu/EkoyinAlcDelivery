// Proven pickup/delivery PINs and delay alerts (founder, 18 Nov 2026).
const test = require("node:test");
const assert = require("node:assert");
const { newPin, pinMatches, alertFor, ALERT_MINUTES } = require("../lib/dispatch.js");

const now = new Date("2026-11-18T18:00:00Z");
const ago = (m) => new Date(now.getTime() - m * 60000);

test("PINs are 4 digits and only the right one matches", () => {
  for (let i = 0; i < 50; i++) assert.match(newPin(), /^\d{4}$/);
  assert.ok(pinMatches("0427", "0427"));
  assert.ok(pinMatches("0427", " 04 27 "), "spaces are ignored");
  assert.ok(!pinMatches("0427", "0428"));
  assert.ok(!pinMatches("0427", ""));
  assert.ok(!pinMatches(null, "0000"), "an order without a PIN never matches");
});

test("paid but no driver: amber at 10 minutes, red at 20", () => {
  assert.equal(alertFor({ status: "PENDING", paidAt: ago(9) }, now), null);
  assert.equal(alertFor({ status: "PENDING", paidAt: ago(11) }, now).level, "amber");
  const r = alertFor({ status: "PENDING", paidAt: ago(25) }, now);
  assert.equal(r.kind, "NOT_ASSIGNED");
  assert.equal(r.level, "red");
});

test("driver assigned but order not collected after 20 minutes", () => {
  const a = alertFor({ status: "PENDING", driverName: "Sipho", paidAt: ago(60), assignedAt: ago(21) }, now);
  assert.equal(a.kind, "NOT_PICKED_UP");
  assert.equal(a.level, "amber");
});

test("on the way: silent location after 3 minutes, slow delivery after 45", () => {
  assert.equal(alertFor({ status: "DISPATCHED", pickedUpAt: ago(10), driverLocationAt: ago(1) }, now), null);
  assert.equal(alertFor({ status: "DISPATCHED", pickedUpAt: ago(10), driverLocationAt: ago(4) }, now).kind, "LOCATION_SILENT");
  assert.equal(alertFor({ status: "DISPATCHED", pickedUpAt: ago(50), driverLocationAt: ago(1) }, now).kind, "DELIVERY_SLOW");
  assert.equal(ALERT_MINUTES.LOCATION_SILENT, 3);
});

test("delivered, cancelled and awaiting-EFT orders never alert", () => {
  for (const status of ["DELIVERED", "CANCELLED", "PAYMENT_PENDING"]) {
    assert.equal(alertFor({ status, createdAt: ago(500) }, now), null, status);
  }
});
