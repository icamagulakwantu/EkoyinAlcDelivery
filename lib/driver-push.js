// Closed-app job alerts for drivers (web push). When a paid order is ready for a
// driver and has a tavern, every active driver who turned alerts on (and has fewer
// than the maximum jobs) gets "New job in <area>", with NO street address or customer.
const D = require("./driver-app.js");
const { loadBlocked } = require("./tavern-portal.js");
const { DRIVER_KEY_PREFIX } = require("./push.js");

const rand = (n) => "R" + Number(n || 0).toFixed(2).replace(/\.00$/, "");

function jobPayload(view) {
  const parts = [rand(view.earn), view.distanceKm != null ? `${view.distanceKm} km` : null, `${view.items} item${view.items === 1 ? "" : "s"}`, view.cash ? "cash on delivery" : null];
  return { title: `New job in ${view.area}`, body: parts.filter(Boolean).join(" · "), tag: "new-job", url: "/driver.html", urgent: true };
}

function createDriverPush({ prisma, push, log = console }) {
  async function notifyNewJob(order) {
    try {
      if (!order || !push || typeof push.sendToSubscription !== "function") return { sent: 0 };
      const full = order.items ? order : await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
      if (!full || !D.isOnBoard(full)) return { sent: 0 };
      const taverns = await prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } });
      const view = D.boardView(full, taverns, new Date(), await loadBlocked(prisma, log));
      if (!view.canTake) return { sent: 0 }; // dispatch assigns these by hand
      const subs = await prisma.pushSubscription.findMany({ where: { adminEmail: { startsWith: DRIVER_KEY_PREFIX } } });
      if (!subs.length) return { sent: 0 };
      const ids = [...new Set(subs.map((s) => s.adminEmail.slice(DRIVER_KEY_PREFIX.length)))];
      const drivers = (await prisma.driver.findMany({ where: { id: { in: ids }, active: true } }));
      const active = await prisma.order.findMany({ where: { driverPhone: { in: drivers.map((d) => d.phone) }, status: { in: ["PENDING", "DISPATCHED"] } }, select: { driverPhone: true } });
      const load = new Map();
      active.forEach((o) => load.set(o.driverPhone, (load.get(o.driverPhone) || 0) + 1));
      const free = new Set(drivers.filter((d) => (load.get(d.phone) || 0) < D.MAX_ACTIVE_JOBS).map((d) => d.id));
      const payload = jobPayload(view);
      const targets = subs.filter((s) => free.has(s.adminEmail.slice(DRIVER_KEY_PREFIX.length)));
      const results = await Promise.all(targets.map((s) => push.sendToSubscription(s, payload)));
      return { sent: results.filter((r) => r === "ok").length };
    } catch (err) {
      log.error("[driver push] new job alert failed:", err);
      return { sent: 0 };
    }
  }
  // Alerts for the ONE driver an order is assigned to (22 Nov 2026): given a job by dispatch, the order is
  // packed and waiting, or it was cancelled. Never includes a street address or customer details.
  async function sendToAssignedDriver(order, payload) {
    try {
      if (!order || !order.driverPhone || !push || typeof push.sendToSubscription !== "function") return { sent: 0 };
      const driver = await prisma.driver.findFirst({ where: { phone: order.driverPhone, active: true } });
      if (!driver) return { sent: 0 };
      const subs = await prisma.pushSubscription.findMany({ where: { adminEmail: DRIVER_KEY_PREFIX + driver.id } });
      const results = await Promise.all(subs.map((s) => push.sendToSubscription(s, payload)));
      return { sent: results.filter((r) => r === "ok").length };
    } catch (err) {
      log.error("[driver push] assigned-driver alert failed:", err);
      return { sent: 0 };
    }
  }
  const outlet = (order) => (order.tavern && order.tavern.name) || "the outlet";
  const notifyAssigned = (order) => sendToAssignedDriver(order, { title: `Job for you: ${order.code}`, body: `Collect it from ${outlet(order)}. Open the app for the details.`, tag: "job-" + order.code, url: "/driver.html", urgent: true });
  const notifyReady = (order) => sendToAssignedDriver(order, { title: `Order ${order.code} is packed`, body: `${outlet(order)} has it ready. Collect it now.`, tag: "job-" + order.code, url: "/driver.html", urgent: true });
  const notifyCancelled = (order) => sendToAssignedDriver(order, { title: `Order ${order.code} was cancelled`, body: "Do not collect or deliver it. Call dispatch if you already have it.", tag: "job-" + order.code, url: "/driver.html", urgent: true });
  return { notifyNewJob, notifyAssigned, notifyReady, notifyCancelled };
}

module.exports = { createDriverPush, jobPayload };
