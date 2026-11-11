// Admin → Payouts (founder, 11 Nov 2026): who is owed what for a day (or a
// range of days) of delivered orders, "Mark as paid", and the 12:00 summary
// email. Amounts are always worked out on the server from the orders.
const { buildPayouts, saDay, saDayRange, isDay } = require("../lib/payouts.js");
const { markupRateForCategory } = require("../lib/catalogue-2026-11.js");
const { sendPayoutSummaryEmail } = require("../emails.js");

const DAY_MS = 86400000;

function yesterdaySA(now = new Date()) {
  return saDay(new Date(now.getTime() - DAY_MS));
}

async function payoutsFor(prisma, from, to) {
  const { start, end } = saDayRange(from, to);
  const orders = await prisma.order.findMany({
    where: { status: "DELIVERED", deliveredAt: { gte: start, lt: end } },
    select: {
      code: true, total: true, paymentMethod: true, deliveryFee: true, surgeFee: true, priorityFee: true,
      bottleDepositFee: true, driverName: true, driverPhone: true,
      tavern: { select: { id: true, name: true, phone: true } },
      items: { select: { name: true, price: true, quantity: true, sku: { select: { category: true } } } },
    },
    orderBy: { deliveredAt: "asc" },
  });
  const flat = orders.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i, category: i.sku?.category || "BEER" })) }));
  return buildPayouts(flat, (c) => markupRateForCategory(c));
}

module.exports = function mountPayouts(app, { prisma, requireAdmin, requireSuperAdmin, logAdminAction }) {
  app.get("/admin/payouts", requireAdmin, async (req, res) => {
    try {
      const from = isDay(req.query.from) ? req.query.from : yesterdaySA();
      const to = isDay(req.query.to) && req.query.to >= from ? req.query.to : from;
      if ((Date.parse(to) - Date.parse(from)) / DAY_MS > 31) return res.status(400).json({ error: "Choose at most 31 days" });
      const period = from === to ? from : `${from}..${to}`;
      const [result, paid] = await Promise.all([
        payoutsFor(prisma, from, to),
        prisma.payout.findMany({ where: { period } }),
      ]);
      const paidBy = new Map(paid.map((p) => [`${p.payeeType}|${p.payeeKey}`, p]));
      const mark = (type) => (x) => {
        const p = paidBy.get(`${type}|${x.key}`);
        return { ...x, paid: p ? { amount: p.amount, at: p.paidAt, by: p.paidBy } : null };
      };
      res.json({ from, to, period, ...result, drivers: result.drivers.map(mark("DRIVER")), taverns: result.taverns.map(mark("TAVERN")) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to work out payouts" });
    }
  });

  // Record a payment made in the banking app. Super admins only; the amount
  // is recalculated here, never taken from the browser.
  app.post("/admin/payouts/paid", requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const { from, to: rawTo, payeeType, payeeKey } = req.body || {};
      if (!isDay(from) || !["DRIVER", "TAVERN"].includes(payeeType) || typeof payeeKey !== "string") {
        return res.status(400).json({ error: "Invalid payout" });
      }
      const to = isDay(rawTo) && rawTo >= from ? rawTo : from;
      const period = from === to ? from : `${from}..${to}`;
      const result = await payoutsFor(prisma, from, to);
      const list = payeeType === "DRIVER" ? result.drivers : result.taverns;
      const payee = list.find((x) => x.key === payeeKey);
      if (!payee) return res.status(404).json({ error: "Nothing owed to this person for that day" });
      const amount = payee.owed;
      const codes = JSON.stringify(payee.orders.map((o) => o.code));
      const saved = await prisma.payout.upsert({
        where: { period_payeeType_payeeKey: { period, payeeType, payeeKey } },
        create: { period, payeeType, payeeKey, payeeName: payee.name, amount, orderCodes: codes, paidBy: req.user?.email || "api-token" },
        update: {},
      });
      await logAdminAction(req, "payout_paid", payeeKey, `${payeeType} ${payee.name} R${amount.toFixed(2)} for ${period}`);
      res.json({ ok: true, payout: saved });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to record the payment" });
    }
  });

  app.delete("/admin/payouts/paid", requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const { period, payeeType, payeeKey } = req.body || {};
      const { count } = await prisma.payout.deleteMany({ where: { period: String(period), payeeType: String(payeeType), payeeKey: String(payeeKey) } });
      if (count) await logAdminAction(req, "payout_unmarked", String(payeeKey), `${payeeType} for ${period}`);
      res.json({ ok: true, removed: count });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to undo" });
    }
  });

  // 12:00 SA: email yesterday's payouts once. Render's free plan sleeps when
  // idle, so this runs on the first check after 12:00 that the server is awake.
  async function maybeSendNoonEmail() {
    try {
      const now = new Date();
      const saHour = new Date(now.getTime() + 2 * 3600 * 1000).getUTCHours();
      if (saHour < 12) return;
      const today = saDay(now);
      // Claim the day first so two server instances never both send it.
      try {
        await prisma.payoutEmail.create({ data: { day: today } });
      } catch {
        return; // already sent (or being sent) today
      }
      const day = yesterdaySA(now);
      const result = await payoutsFor(prisma, day, day);
      if (result.totals.orders === 0) return;
      await sendPayoutSummaryEmail(day, result);
    } catch (err) {
      console.error("[payouts] noon email failed:", err);
    }
  }
  if (process.env.NODE_ENV !== "test") {
    setInterval(maybeSendNoonEmail, 10 * 60 * 1000).unref();
    setTimeout(maybeSendNoonEmail, 60 * 1000).unref();
  }
};
