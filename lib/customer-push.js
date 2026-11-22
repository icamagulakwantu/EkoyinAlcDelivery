// Order updates for the customer's phone (web push), 22 Nov 2026.
// A customer who taps "Get updates on this phone" on their tracking page is saved as
// PushSubscription.adminEmail = "customer:<order code>" (same table as drivers and taverns, no migration).
// They are told when the order is accepted, packed, out for delivery, delivered or cancelled.
// Nothing private goes in a notification (no PIN, no address): it can show on a lock screen.
// Their saved devices are removed once the order is delivered or cancelled.
const { CUSTOMER_KEY_PREFIX } = require("./push.js");

const first = (name) => String(name || "").trim().split(/\s+/)[0];

function customerPayload(event, order) {
  const code = order.code;
  const driver = first(order.driverName);
  const url = `/track.html?code=${encodeURIComponent(code)}`;
  const base = { tag: "order-" + code, url, urgent: false };
  switch (event) {
    case "ASSIGNED":
      return { ...base, title: "Your order is being prepared", body: driver ? `${driver} will bring it. The outlet is packing it now.` : "A driver has been lined up and the outlet is packing it." };
    case "READY":
      return { ...base, title: "Your order is packed", body: driver ? `Waiting for ${driver} to collect it.` : "Waiting for the driver to collect it." };
    case "PICKED_UP":
      return { ...base, urgent: true, title: "Out for delivery", body: "Follow your driver live. Have your 4-digit delivery PIN ready and your ID (18+)." };
    case "DELIVERED":
      return { ...base, title: "Delivered. Enjoy!", body: "Your receipt with the delivery time is on your tracking page." };
    case "CANCELLED":
      return { ...base, urgent: true, title: "Your order was cancelled", body: "Tap to see what happened." };
    default:
      return null;
  }
}

function createCustomerPush({ prisma, push, log = console }) {
  async function notify(order, event) {
    try {
      if (!order || !order.code || !push || typeof push.sendToSubscription !== "function") return { sent: 0 };
      const payload = customerPayload(event, order);
      if (!payload) return { sent: 0 };
      const subs = await prisma.pushSubscription.findMany({ where: { adminEmail: CUSTOMER_KEY_PREFIX + order.code } });
      if (!subs.length) return { sent: 0 };
      const results = await Promise.all(subs.map((s) => push.sendToSubscription(s, payload)));
      if (event === "DELIVERED" || event === "CANCELLED") {
        await prisma.pushSubscription.deleteMany({ where: { adminEmail: CUSTOMER_KEY_PREFIX + order.code } });
      }
      return { sent: results.filter((r) => r === "ok").length };
    } catch (err) {
      log.error("[customer push] failed:", err);
      return { sent: 0 };
    }
  }
  return { notify };
}

module.exports = { createCustomerPush, customerPayload };
