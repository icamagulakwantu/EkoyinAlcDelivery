// Saves and removes the devices that get order alerts (web push).
// All routes are admin only. See lib/push.js.
const { isPushEndpoint } = require("../lib/push.js");

const MAX_DEVICES_PER_ADMIN = 10;
const short = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

module.exports = function mountPush(app, { prisma, requireAdmin, push }) {
  // Is push set up on the server, and the public key the browser needs.
  app.get("/admin/push/config", requireAdmin, (req, res) => {
    res.json({ enabled: push.isEnabled(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });

  app.post("/admin/push/subscribe", requireAdmin, async (req, res) => {
    try {
      const email = req.user && req.user.email ? req.user.email.toLowerCase() : null;
      if (!email) return res.status(400).json({ error: "Log in with your admin account to get alerts" });
      const { endpoint, keys } = req.body || {};
      if (!isPushEndpoint(endpoint) || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string"
        || keys.p256dh.length > 200 || keys.auth.length > 100) {
        return res.status(400).json({ error: "That device could not be saved for alerts" });
      }
      const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      const data = { p256dh: keys.p256dh, auth: keys.auth, adminEmail: email, userAgent: short(req.headers["user-agent"], 200), lastSeenAt: new Date() };
      const sub = await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });

      // Keep the newest few devices per admin so the list cannot grow forever.
      const mine = await prisma.pushSubscription.findMany({ where: { adminEmail: email }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
      if (mine.length > MAX_DEVICES_PER_ADMIN) {
        await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.slice(MAX_DEVICES_PER_ADMIN).map((m) => m.id) } } });
      }

      // First time on this device: send a confirmation so they know it works.
      let confirmed = false;
      if (!existing) {
        confirmed = (await push.sendToSubscription(sub, {
          title: "Order alerts are on",
          body: "This device will ring for new orders, even when Ekoyini is closed.",
          tag: "alerts-on",
          url: "/admin/admin.html",
          urgent: false,
        })) === "ok";
      }
      res.json({ ok: true, confirmed });
    } catch (err) {
      console.error("[push] subscribe failed:", err);
      res.status(500).json({ error: "Could not turn on phone alerts" });
    }
  });

  app.post("/admin/push/unsubscribe", requireAdmin, async (req, res) => {
    try {
      const email = req.user && req.user.email ? req.user.email.toLowerCase() : null;
      const endpoint = req.body && req.body.endpoint;
      if (email && typeof endpoint === "string") {
        await prisma.pushSubscription.deleteMany({ where: { endpoint, adminEmail: email } });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[push] unsubscribe failed:", err);
      res.status(500).json({ error: "Could not turn off phone alerts" });
    }
  });
};
