// lib/order-rules.js
//
// Small, pure rules used by server.js. Kept here (no database, no Express)
// so they can be unit-tested with `node --test`.

const crypto = require("crypto");

// ── Driver share token ───────────────────────────────────────────────────
// Constant-time comparison, so response timing can't be used to guess the
// token one character at a time.
function driverTokenMatches(order, token) {
  if (!order || !order.driverShareToken || typeof token !== "string") return false;
  const expected = Buffer.from(order.driverShareToken);
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// ── Order status rules ───────────────────────────────────────────────────
// The only forward moves an order can make. Cancellation is separate
// (cancelOrderTransaction in server.js) because it must also restore stock
// and promo use. Previously an admin could move a CANCELLED order back to
// PENDING without re-taking stock, or skip PAYMENT_PENDING -> DELIVERED.
const ALLOWED_STATUS_TRANSITIONS = {
  PAYMENT_PENDING: new Set(["PENDING"]),
  PENDING: new Set(["DISPATCHED"]),
  DISPATCHED: new Set(["DELIVERED"]),
  DELIVERED: new Set(),
  CANCELLED: new Set(),
};

function canTransition(from, to) {
  return !!ALLOWED_STATUS_TRANSITIONS[from]?.has(to);
}

// ── Customer input limits ────────────────────────────────────────────────
const MAX_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 200;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function hasControlChars(value) {
  return typeof value === "string" && CONTROL_CHARS.test(value);
}

// Normalises SA numbers to +27XXXXXXXXX: "072 123 4567", "0721234567",
// "27721234567" and "+27 72 123 4567" all become "+27721234567".
// Returns null if it isn't a plausible 9-digit SA number.
function normalizeSaPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  let national = null;
  if (digits.length === 10 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 11 && digits.startsWith("27")) national = digits.slice(2);
  else if (digits.length === 9 && !digits.startsWith("0")) national = digits;
  return national ? `+27${national}` : null;
}

module.exports = {
  driverTokenMatches,
  ALLOWED_STATUS_TRANSITIONS,
  canTransition,
  MAX_NAME_LENGTH,
  MAX_ADDRESS_LENGTH,
  hasControlChars,
  normalizeSaPhone,
};
