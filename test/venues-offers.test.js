const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const P = require("../public/pricing.js");
const { applyVenue, findVenue, loadVenues } = require("../lib/venues.js");

const noon = new Date("2026-11-19T10:00:00Z");

test("Cooler Box discount is for the first 5 orders only", () => {
  assert.equal(P.COOLER_FIRST_ORDERS, 5);
  const lines = [{ category: "BEER", total: 2400 }];
  assert.equal(P.priceOrder({ lines, deliveryTotal: 0, now: noon }).coolerDiscount, 50);
  assert.equal(P.priceOrder({ lines, deliveryTotal: 0, now: noon, coolerAllowed: true }).coolerDiscount, 50);
  const later = P.priceOrder({ lines, deliveryTotal: 0, now: noon, coolerAllowed: false });
  assert.equal(later.coolerDiscount, 0);
  assert.equal(later.coolerPct, 0);
  assert.equal(later.total, 2400);
});

test("server counts orders for the offer and defaults cash to 10 delivered orders", () => {
  const s = fs.readFileSync("server.js", "utf8");
  assert.match(s, /intFromEnv\("COD_MIN_DELIVERED_ORDERS", 10\)/);
  assert.match(s, /countOrdersForOffers\(userId\)\) < COOLER_FIRST_ORDERS/);
  assert.match(s, /const cashSpot = !!\(venue && venue\.cash\)/);
});

test("venues file: ids are unique, Lifa and Mafa and KwaMagxaki Butchery take cash, others do not", () => {
  const all = loadVenues();
  assert.equal(new Set(all.map((v) => v.id)).size, all.length);
  assert.equal(findVenue("lifa-and-mafa").cash, true);
  assert.equal(findVenue("kwamagxaki-butchery").cash, true);
  assert.equal(findVenue("patzar-butchery").cash, false);
  assert.equal(findVenue("nope"), null);
  assert.equal(findVenue(undefined), null);
});

test("choosing a spot overrides the address and pin, and keeps the customer's note", () => {
  assert.deepEqual(applyVenue({}), { venue: null });
  assert.deepEqual(applyVenue({ venueId: "" }), { venue: null });
  assert.ok(applyVenue({ venueId: "unknown" }).error);
  const r = applyVenue({ venueId: "lifa-and-mafa", address: "12 Somewhere Else St", landmark: "by the blue tent", deliveryLat: -33.9, deliveryLng: 25.5 });
  assert.equal(r.venue.id, "lifa-and-mafa");
  assert.equal(r.fields.address, findVenue("lifa-and-mafa").address);
  assert.equal(r.fields.landmark, "Lifa and Mafa — by the blue tent");
  // The customer's own pin is ignored: cash at a spot cannot go to another address.
  assert.equal(r.fields.deliveryLat, null);
  assert.equal(r.fields.deliveryLng, null);
  assert.equal(applyVenue({ venueId: "lifa-and-mafa" }).fields.landmark, "Lifa and Mafa");
});
