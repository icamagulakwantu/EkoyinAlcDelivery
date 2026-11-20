// Driver app logic (founder approved 20 Nov 2026): PINs, sessions, what a
// driver sees on the job board and in earnings. Pure functions so they can be
// unit-tested without a database. Routes are in routes/drivers.js.
const crypto = require("crypto");
const { saDay } = require("./payouts.js");
const { areaOf } = require("./push.js");
const { routedDistanceKm } = require("../public/pricing.js");

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 14 * 24 * 3600 * 1000;
const MAX_ACTIVE_JOBS = 3;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ── PINs and sessions ──────────────────────────────────────────────────
function newDriverPin() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}
function isValidPin(pin) {
  return typeof pin === "string" && /^\d{6}$/.test(pin);
}
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), salt, 32).toString("hex");
  return `s1:${salt}:${hash}`;
}
function verifyPin(pin, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 3 || parts[0] !== "s1" || typeof pin !== "string") return false;
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(pin, parts[1], expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
function newSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
function isTokenShape(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

// null when the driver may try to sign in, otherwise minutes left on the lock.
function lockMinutesLeft(driver, now = new Date()) {
  if (!driver || !driver.lockedUntil) return 0;
  const ms = new Date(driver.lockedUntil).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

// ── Money (same rules as lib/payouts.js) ───────────────────────────────
function driverEarn(o) {
  return round2((Number(o.deliveryFee) || 0) + (Number(o.surgeFee) || 0) + (Number(o.priorityFee) || 0));
}
function cashHeld(o) {
  return o.paymentMethod === "cod" ? round2(Number(o.total) || 0) : 0;
}

// Delivered orders -> today / this week totals in South African days.
function summariseEarnings(orders, now = new Date()) {
  const today = saDay(now);
  const weekDays = new Set();
  for (let i = 0; i < 7; i++) weekDays.add(saDay(new Date(now.getTime() - i * 86400000)));
  const empty = () => ({ deliveries: 0, earned: 0, cash: 0, net: 0 });
  const out = { today: empty(), week: empty(), recent: [] };
  for (const o of orders || []) {
    if (!o.deliveredAt) continue;
    const day = saDay(o.deliveredAt);
    if (!weekDays.has(day)) continue;
    const earned = driverEarn(o);
    const cash = cashHeld(o);
    const add = (b) => { b.deliveries += 1; b.earned = round2(b.earned + earned); b.cash = round2(b.cash + cash); b.net = round2(b.earned - b.cash); };
    add(out.week);
    if (day === today) add(out.today);
    out.recent.push({ code: o.code, day, deliveredAt: o.deliveredAt, earned, cash });
  }
  out.recent.sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt));
  return out;
}

// Customer ratings (1 to 5) on a driver's delivered orders. Needs at least 3 ratings
// before an average is shown, so one unhappy customer does not define a new driver.
function summariseRatings(orders) {
  const rated = (orders || []).map((o) => Number(o.rating)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
  if (rated.length < 3) return { avg: null, count: rated.length };
  return { avg: Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10, count: rated.length };
}

// ── Job board ──────────────────────────────────────────────────────────
// blocked: Map<tavernId, Set<skuId>> of items a tavern has marked sold out
// (lib/tavern-portal.js). A tavern that cannot supply every item is skipped,
// so the order goes to the next nearest tavern that can.
function cannotSupply(blocked, tavernId, order) {
  const set = blocked && blocked.get(tavernId);
  if (!set || !set.size) return false;
  return (order.items || []).some((i) => i.skuId && set.has(i.skuId));
}

function nearestTavern(order, taverns, blocked) {
  if (order.tavernId) return (taverns || []).find((t) => t.id === order.tavernId) || { id: order.tavernId, name: order.tavern && order.tavern.name, area: order.tavern && order.tavern.area };
  if (order.deliveryLat == null || order.deliveryLng == null) return null;
  let best = null;
  let bestKm = null;
  for (const t of taverns || []) {
    if (t.latitude == null || t.longitude == null) continue;
    if (cannotSupply(blocked, t.id, order)) continue;
    const km = routedDistanceKm(t.latitude, t.longitude, order.deliveryLat, order.deliveryLng);
    if (bestKm === null || km < bestKm) { best = t; bestKm = km; }
  }
  return best;
}

function isOnBoard(order) {
  return !!order && order.status === "PENDING" && !order.driverPhone && !order.driverName;
}

// What every driver may see BEFORE taking a job: no street address, no customer.
function boardView(order, taverns, now = new Date(), blocked) {
  const tavern = nearestTavern(order, taverns, blocked);
  return {
    id: order.id,
    area: areaOf(order.address),
    distanceKm: order.distanceKm != null ? round2(order.distanceKm) : null,
    earn: driverEarn(order),
    cash: cashHeld(order),
    items: (order.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0),
    tavern: tavern ? { name: tavern.name, area: tavern.area } : null,
    canTake: !!tavern,
    waitingMin: Math.max(0, Math.round((now.getTime() - new Date(order.paidAt || order.createdAt).getTime()) / 60000)),
  };
}

// A driver's own job: the address and customer are theirs once they took it.
// The collection and delivery PINs are never included.
function jobView(order, baseUrl = "") {
  return {
    code: order.code,
    status: order.status,
    earn: driverEarn(order),
    cash: cashHeld(order),
    address: order.address,
    landmark: order.landmark || null,
    lat: order.deliveryLat ?? null,
    lng: order.deliveryLng ?? null,
    customerName: order.customerName || null,
    customerPhone: order.customerPhone || null,
    tavern: order.tavern ? { name: order.tavern.name, area: order.tavern.area, phone: order.tavern.phone } : null,
    ready: !!order.readyAt, // the tavern tapped "Ready for collection"
    items: (order.items || []).map((i) => ({ name: i.name, quantity: i.quantity })),
    link: order.driverShareToken
      ? `${baseUrl}/driver-track.html?code=${encodeURIComponent(order.code)}&token=${encodeURIComponent(order.driverShareToken)}`
      : null,
  };
}

module.exports = {
  MAX_FAILED_LOGINS, LOCK_MS, SESSION_MS, MAX_ACTIVE_JOBS,
  newDriverPin, isValidPin, hashPin, verifyPin, newSessionToken, hashToken, isTokenShape, lockMinutesLeft,
  driverEarn, cashHeld, summariseEarnings, summariseRatings, nearestTavern, cannotSupply, isOnBoard, boardView, jobView,
};
