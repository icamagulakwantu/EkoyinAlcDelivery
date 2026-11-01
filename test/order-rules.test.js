// test/order-rules.test.js — run with `node --test` (no extra packages)
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  driverTokenMatches,
  canTransition,
  hasControlChars,
  normalizeSaPhone,
} = require("../lib/order-rules.js");
const { roundCurrency } = require("../public/pricing.js");

test("status: only forward moves are allowed", () => {
  assert.equal(canTransition("PAYMENT_PENDING", "PENDING"), true);
  assert.equal(canTransition("PENDING", "DISPATCHED"), true);
  assert.equal(canTransition("DISPATCHED", "DELIVERED"), true);
});

test("status: a cancelled order can never be revived", () => {
  for (const to of ["PAYMENT_PENDING", "PENDING", "DISPATCHED", "DELIVERED"]) {
    assert.equal(canTransition("CANCELLED", to), false, `CANCELLED -> ${to}`);
  }
});

test("status: no skipping steps or going backwards", () => {
  assert.equal(canTransition("PAYMENT_PENDING", "DELIVERED"), false);
  assert.equal(canTransition("PENDING", "DELIVERED"), false);
  assert.equal(canTransition("DISPATCHED", "PENDING"), false);
  assert.equal(canTransition("DELIVERED", "DISPATCHED"), false);
  assert.equal(canTransition("NONSENSE", "PENDING"), false);
});

test("driver token: exact match only", () => {
  const order = { driverShareToken: "abc123" };
  assert.equal(driverTokenMatches(order, "abc123"), true);
  assert.equal(driverTokenMatches(order, "abc124"), false);
  assert.equal(driverTokenMatches(order, "abc12"), false);
  assert.equal(driverTokenMatches(order, undefined), false);
  assert.equal(driverTokenMatches(order, { toString: () => "abc123" }), false);
});

test("driver token: cleared token (finished order) never matches", () => {
  assert.equal(driverTokenMatches({ driverShareToken: null }, ""), false);
  assert.equal(driverTokenMatches(null, "abc"), false);
});

test("phone: SA formats normalise to +27", () => {
  assert.equal(normalizeSaPhone("072 123 4567"), "+27721234567");
  assert.equal(normalizeSaPhone("0721234567"), "+27721234567");
  assert.equal(normalizeSaPhone("27721234567"), "+27721234567");
  assert.equal(normalizeSaPhone("+27 72 123 4567"), "+27721234567");
  assert.equal(normalizeSaPhone("721234567"), "+27721234567");
});

test("phone: rejects numbers that aren't SA-shaped", () => {
  assert.equal(normalizeSaPhone(""), null);
  assert.equal(normalizeSaPhone("12345"), null);
  assert.equal(normalizeSaPhone("+44 7911 123456"), null);
  assert.equal(normalizeSaPhone("072123456789"), null);
});

test("control characters are detected, normal text is not", () => {
  assert.equal(hasControlChars("10 Plaatjies Crescent, KwaMagxaki"), false);
  assert.equal(hasControlChars("Line one\nline two"), false);
  assert.equal(hasControlChars("bad\u0000value"), true);
  assert.equal(hasControlChars("bell\u0007"), true);
  assert.equal(hasControlChars(undefined), false);
});

test("roundCurrency rounds to cents and never returns NaN", () => {
  assert.equal(roundCurrency(10.005), 10.01);
  assert.equal(roundCurrency("12.344"), 12.34);
  assert.equal(roundCurrency(undefined), 0);
  assert.equal(roundCurrency("abc"), 0);
});
