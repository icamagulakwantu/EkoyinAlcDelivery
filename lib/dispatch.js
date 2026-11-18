// Proven pickup and delivery, plus delay alerts (founder, 18 Nov 2026).
//
// - Collection PIN: 4 digits, sent ONLY to the tavern (WhatsApp). The driver
//   types it in at the counter to confirm pickup, which proves the driver
//   was at the tavern and the tavern handed the order over.
// - Delivery PIN: 4 digits, shown ONLY to the customer. The driver types it
//   in at the gate to mark the order delivered.
// - Pickup also needs the driver's location, and starts live tracking.
// - Alerts when an order sits still: not assigned, not collected, location
//   silent, or out for delivery too long. Amber at the limit, red at 2x.
//
// Pure functions, tested in test/dispatch.test.js.
const crypto = require("crypto");

const ALERT_MINUTES = {
  NOT_ASSIGNED: 10, // paid, no driver yet
  NOT_PICKED_UP: 20, // driver assigned, order not collected
  LOCATION_SILENT: 3, // on the way, no location update
  DELIVERY_SLOW: 45, // on the way this long
};

const ALERT_TEXT = {
  NOT_ASSIGNED: "Paid but no driver assigned",
  NOT_PICKED_UP: "Driver assigned but order not collected",
  LOCATION_SILENT: "Driver's live location has stopped",
  DELIVERY_SLOW: "Out for delivery too long",
};

function newPin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

// Constant-time compare so a PIN can't be guessed by timing.
function pinMatches(expected, given) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(String(given || "").replace(/\D/g, ""));
  return a.length === 4 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

const minutesSince = (t, now) => (t ? (now.getTime() - new Date(t).getTime()) / 60000 : null);

// order: { status, driverName, paidAt, createdAt, assignedAt, pickedUpAt, driverLocationAt }
// Returns the one alert this order needs right now, or null.
function alertFor(order, now = new Date()) {
  let kind = null;
  let since = null;
  if (order.status === "PENDING" && !order.driverName) {
    kind = "NOT_ASSIGNED"; since = order.paidAt || order.createdAt;
  } else if (order.status === "PENDING" && order.driverName) {
    kind = "NOT_PICKED_UP"; since = order.assignedAt || order.paidAt || order.createdAt;
  } else if (order.status === "DISPATCHED") {
    const out = minutesSince(order.pickedUpAt, now);
    if (out != null && out >= ALERT_MINUTES.DELIVERY_SLOW) {
      kind = "DELIVERY_SLOW"; since = order.pickedUpAt;
    } else {
      kind = "LOCATION_SILENT"; since = order.driverLocationAt || order.pickedUpAt;
    }
  }
  if (!kind || !since) return null;
  const mins = minutesSince(since, now);
  const limit = ALERT_MINUTES[kind];
  if (mins < limit) return null;
  return { kind, level: mins >= limit * 2 ? "red" : "amber", minutes: Math.floor(mins), text: ALERT_TEXT[kind] };
}

module.exports = { ALERT_MINUTES, ALERT_TEXT, newPin, pinMatches, alertFor };
