// Delay alerts (founder, 18 Nov 2026): no order may sit still. Every minute
// the server checks open orders; Admin shows the alerts (GET /admin/alerts)
// and the team gets one email per alert level (amber, then red).
// Also: the customer's own delivery PIN (owner only).
const { alertFor } = require("../lib/dispatch.js");
const { sendDispatchAlertEmail } = require("../emails.js");

const OPEN = ["PENDING", "DISPATCHED"];
const SELECT = {
  code: true, status: true, driverName: true, driverPhone: true, paidAt: true, createdAt: true,
  assignedAt: true, pickedUpAt: true, driverLocationAt: true, alertsSent: true, address: true,
  tavern: { select: { name: true } },
};

async function openAlerts(prisma, now = new Date()) {
  const orders = await prisma.order.findMany({ where: { status: { in: OPEN } }, select: SELECT });
  return orders
    .map((o) => ({ order: o, alert: alertFor(o, now) }))
    .filter((x) => x.alert)
    .sort((a, b) => (a.alert.level === b.alert.level ? b.alert.minutes - a.alert.minutes : a.alert.level === "red" ? -1 : 1));
}

module.exports = function mountDispatchAlerts(app, { prisma, requireAdmin, requireUser, push }) {
  app.get("/admin/alerts", requireAdmin, async (req, res) => {
    try {
      const list = await openAlerts(prisma);
      res.json(list.map(({ order, alert }) => ({
        code: order.code, status: order.status, driverName: order.driverName, tavern: order.tavern?.name || null,
        ...alert,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load alerts" });
    }
  });

  // The customer's own delivery PIN, for their Track page.
  app.get("/api/order/:code/delivery-pin", requireUser, async (req, res) => {
    try {
      const order = await prisma.order.findUnique({ where: { code: req.params.code }, select: { userId: true, deliveryPin: true, status: true } });
      if (!order || order.userId !== req.user.id) return res.status(404).json({ error: "Order not found" });
      if (["DELIVERED", "CANCELLED"].includes(order.status)) return res.json({ pin: null });
      res.json({ pin: order.deliveryPin || null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load your PIN" });
    }
  });

  async function checkAndEmail() {
    try {
      const list = await openAlerts(prisma);
      const fresh = [];
      for (const { order, alert } of list) {
        let sent = [];
        try { sent = JSON.parse(order.alertsSent || "[]"); } catch { sent = []; }
        const key = `${alert.kind}:${alert.level}`;
        if (sent.includes(key)) continue;
        sent.push(key);
        // Record first, so a crash can never send the same alert twice.
        await prisma.order.update({ where: { code: order.code }, data: { alertsSent: JSON.stringify(sent) } });
        fresh.push({ order, alert });
      }
      if (fresh.length) {
        // Phone alert first (never throws, never blocks the email).
        if (push) push.notifyDispatchAlerts(fresh);
        await sendDispatchAlertEmail(fresh);
      }
    } catch (err) {
      console.error("[alerts] check failed:", err);
    }
  }
  if (process.env.NODE_ENV !== "test") {
    setInterval(checkAndEmail, 60 * 1000).unref();
  }
};
