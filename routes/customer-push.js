// A customer turns on order updates for ONE order from its tracking page (22 Nov 2026).
// Knowing the order code is the same access the tracking page already has. See lib/customer-push.js.
const { isPushEndpoint, CUSTOMER_KEY_PREFIX, isCustomerKey } = require("../lib/push.js");

const MAX_DEVICES_PER_ORDER = 3;

module.exports = function mountCustomerPush(app, { prisma, trackLimiter, push }) {
  app.get("/api/push/key", trackLimiter, (req, res) => {
    res.json({ enabled: !!push && push.isEnabled(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });

  app.post("/api/order/:code/push-subscribe", trackLimiter, async (req, res) => {
    try {
      const code = String(req.params.code || "").slice(0, 40);
      const { endpoint, keys } = req.body || {};
      if (!isPushEndpoint(endpoint) || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string"
        || keys.p256dh.length > 200 || keys.auth.length > 100) {
        return res.status(400).json({ error: "That phone could not be saved for updates" });
      }
      const order = await prisma.order.findUnique({ where: { code }, select: { code: true, status: true } });
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status === "DELIVERED" || order.status === "CANCELLED") return res.json({ ok: true, finished: true });

      const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      // A phone that already rings for admin, driver or tavern alerts is never taken over by a customer order.
      if (existing && !isCustomerKey(existing.adminEmail)) return res.json({ ok: true, shared: true });

      const key = CUSTOMER_KEY_PREFIX + order.code;
      const data = { p256dh: keys.p256dh, auth: keys.auth, adminEmail: key, userAgent: String(req.headers["user-agent"] || "").slice(0, 200), lastSeenAt: new Date() };
      const sub = await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });

      const mine = await prisma.pushSubscription.findMany({ where: { adminEmail: key }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
      if (mine.length > MAX_DEVICES_PER_ORDER) {
        await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.slice(MAX_DEVICES_PER_ORDER).map((m) => m.id) } } });
      }

      let confirmed = false;
      if (!existing || existing.adminEmail !== key) {
        confirmed = (await push.sendToSubscription(sub, {
          title: "Order updates are on",
          body: `We will tell you when ${order.code} is packed, out for delivery and delivered.`,
          tag: "order-" + order.code,
          url: `/track.html?code=${encodeURIComponent(order.code)}`,
          urgent: false,
        })) === "ok";
      }
      res.json({ ok: true, confirmed });
    } catch (err) {
      console.error("[customer push] subscribe failed:", err);
      res.status(500).json({ error: "Could not turn on updates" });
    }
  });
};
