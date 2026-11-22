// Closed-app alerts for partner taverns (web push), tavern portal 21 Nov 2026.
//   notifyIncoming(order): a paid order is waiting for a driver and this tavern is the one it
//                          will go to, so start packing.
//   notifyAssigned(order): a driver took the order (or dispatch assigned it): pack it now.
// Tavern phones live in PushSubscription as adminEmail = "tavern:<tavern id>". No customer details.
const D = require("./driver-app.js");
const T = require("./tavern-portal.js");
const { TAVERN_KEY_PREFIX } = require("./push.js");

function createTavernPush({ prisma, push, log = console }) {
  async function sendToTavern(tavernId, payload) {
    if (!tavernId || !push || typeof push.sendToSubscription !== "function") return { sent: 0 };
    const access = prisma.tavernAccess ? await prisma.tavernAccess.findUnique({ where: { tavernId } }) : null;
    if (!access || !access.active) return { sent: 0 };
    const subs = await prisma.pushSubscription.findMany({ where: { adminEmail: TAVERN_KEY_PREFIX + tavernId } });
    const results = await Promise.all(subs.map((s) => push.sendToSubscription(s, payload)));
    return { sent: results.filter((r) => r === "ok").length };
  }

  async function notifyAssigned(order) {
    try {
      if (!order || !order.tavernId) return { sent: 0 };
      const items = order.items || (await prisma.orderItem.findMany({ where: { orderId: order.id }, select: { quantity: true } }));
      return await sendToTavern(order.tavernId, T.assignedPayload(order, items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)));
    } catch (err) {
      log.error("[tavern push] assigned alert failed:", err);
      return { sent: 0 };
    }
  }

  async function notifyIncoming(order) {
    try {
      if (!order) return { sent: 0 };
      const full = order.items && order.items[0] && "skuId" in order.items[0] ? order
        : await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
      if (!full || !D.isOnBoard(full)) return { sent: 0 };
      const taverns = await prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } });
      const blocked = await T.loadBlocked(prisma, log);
      const tavern = D.nearestTavern(full, taverns, blocked);
      if (!tavern) return { sent: 0 };
      return await sendToTavern(tavern.id, T.incomingPayload(T.incomingView(full)));
    } catch (err) {
      log.error("[tavern push] incoming alert failed:", err);
      return { sent: 0 };
    }
  }

  // The order was cancelled: stop packing (22 Nov 2026).
  async function notifyCancelled(order) {
    try {
      if (!order || !order.tavernId) return { sent: 0 };
      return await sendToTavern(order.tavernId, { title: `Order ${order.code} was cancelled`, body: "Stop packing it. Nothing to collect.", tag: "tavern-" + order.code, url: "/tavern.html", urgent: true });
    } catch (err) {
      log.error("[tavern push] cancelled alert failed:", err);
      return { sent: 0 };
    }
  }

  return { notifyAssigned, notifyIncoming, notifyCancelled };
}

module.exports = { createTavernPush };
