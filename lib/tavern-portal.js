// Tavern portal (founder approved 21 Nov 2026).
//
// A partner tavern signs in with its phone number + a 6-digit PIN (made by admin) and can:
//   - see the orders it has to pack (with the collection PIN to give the driver),
//   - see the orders coming its way, before a driver has taken them,
//   - tap "Ready for collection",
//   - mark items it cannot supply right now (sold out),
//   - see what Ekoyini owes it each day.
//
// Stock and prices stay shared platform-wide. "Sold out" only steers which tavern
// an order goes to (lib/driver-app.js nearestTavern skips a tavern that lacks an item).
// Pure functions, unit-tested in test/tavern-portal.test.js.
const { areaOf } = require("./push.js");

const MAX_DEVICES_PER_TAVERN = 5;
const MAX_SOLD_OUT = 300;

// Rows of { tavernId, skuId } -> Map<tavernId, Set<skuId>>
function blockedMap(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!r || !r.tavernId || !r.skuId) continue;
    if (!map.has(r.tavernId)) map.set(r.tavernId, new Set());
    map.get(r.tavernId).add(r.skuId);
  }
  return map;
}

// Never lets a missing/failed sold-out table stop an order being assigned.
async function loadBlocked(prisma, log = console) {
  try {
    if (!prisma || !prisma.tavernSoldOut) return new Map();
    return blockedMap(await prisma.tavernSoldOut.findMany({ select: { tavernId: true, skuId: true } }));
  } catch (err) {
    log.error("[tavern] could not read sold-out items:", err && err.message);
    return new Map();
  }
}

const minutesSince = (t, now) => (t ? Math.max(0, Math.round((now.getTime() - new Date(t).getTime()) / 60000)) : null);
const countItems = (items) => (items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);

// An order this tavern has to pack. The collection PIN is the tavern's to read to the
// driver at the counter; the customer's name, phone, address and total are never included.
function packView(order, now = new Date()) {
  const waiting = order.status === "PENDING";
  return {
    code: order.code,
    status: order.status,
    collectionPin: waiting ? order.collectionPin || null : null,
    driver: order.driverName ? { name: order.driverName, vehicle: order.driverVehicle || null } : null,
    ready: !!order.readyAt,
    readyAt: order.readyAt || null,
    assignedMin: minutesSince(order.assignedAt || order.paidAt || order.createdAt, now),
    itemCount: countItems(order.items),
    items: (order.items || []).map((i) => ({ name: i.name, quantity: i.quantity })),
  };
}

// An order that is paid and heading this way but has no driver yet: so the tavern can start
// packing. No code (so it can't be tracked), no customer, only the area and the items.
function incomingView(order, now = new Date()) {
  return {
    area: areaOf(order.address),
    waitingMin: minutesSince(order.paidAt || order.createdAt, now),
    itemCount: countItems(order.items),
    items: (order.items || []).map((i) => ({ name: i.name, quantity: i.quantity })),
  };
}

// "Heineken 330ml Dumpy (330ml)" style label for the stock list.
function skuLabel(sku) {
  return { skuId: sku.id, name: sku.name, pack: sku.bottleFormat || "" };
}

// Stock search: matches every word of the query against name + pack.
function matchesQuery(sku, q) {
  const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${sku.name} ${sku.bottleFormat || ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

// Push messages to a tavern phone. No customer details: they can show on a lock screen.
function assignedPayload(order, itemCount) {
  const who = order.driverName ? `${order.driverName} is coming to collect` : "A driver is coming to collect";
  return {
    title: `Pack order ${order.code}`,
    body: `${who}. ${itemCount} item${itemCount === 1 ? "" : "s"}. Open to see the items and the collection PIN.`,
    tag: "tavern-pack-" + order.code,
    url: "/tavern.html",
    urgent: true,
  };
}
function incomingPayload(view) {
  return {
    title: `New order coming to you`,
    body: `${view.area} · ${view.itemCount} item${view.itemCount === 1 ? "" : "s"}. Start packing.`,
    tag: "tavern-incoming",
    url: "/tavern.html",
    urgent: true,
  };
}

module.exports = {
  MAX_DEVICES_PER_TAVERN, MAX_SOLD_OUT,
  blockedMap, loadBlocked, packView, incomingView, skuLabel, matchesQuery, assignedPayload, incomingPayload,
};
