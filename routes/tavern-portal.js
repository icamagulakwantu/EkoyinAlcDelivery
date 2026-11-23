// Tavern portal (founder approved 21 Nov 2026). See lib/tavern-portal.js.
//   Tavern side: sign in with phone + PIN, orders to pack, ready button, sold-out items, daily money.
//   Admin side:  switch a tavern's portal on, pause it, reset its PIN (shown once).
const rateLimit = require("express-rate-limit");
const { toSaWhatsApp } = require("../lib/phone.js");
const D = require("../lib/driver-app.js");
const T = require("../lib/tavern-portal.js");
const { saDay } = require("../lib/payouts.js");
const { isPushEndpoint, isConfigured, TAVERN_KEY_PREFIX } = require("../lib/push.js");

const short = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const DAY_MS = 86400000;

module.exports = function mountTavernPortal(app, { prisma, requireAdmin, writeLimiter, logAdminAction, orderEvents }) {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many attempts. Please wait a few minutes and try again." },
  });
  const pollLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Slow down a little" } });
  const { payoutsFor } = require("./payouts.js");

  async function requireTavern(req, res, next) {
    try {
      const header = String(req.headers.authorization || "");
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!D.isTokenShape(token)) return res.status(401).json({ error: "Please sign in" });
      const access = await prisma.tavernAccess.findFirst({ where: { sessionHash: D.hashToken(token) } });
      if (!access || !access.active || !access.sessionExpiresAt || new Date(access.sessionExpiresAt) < new Date()) {
        return res.status(401).json({ error: "Please sign in" });
      }
      const tavern = await prisma.tavern.findUnique({ where: { id: access.tavernId } });
      if (!tavern) return res.status(401).json({ error: "Please sign in" });
      req.access = access;
      req.tavern = tavern;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
  const publicTavern = (t) => ({ name: t.name, area: t.area });
  const pinOwner = (t) => TAVERN_KEY_PREFIX + t.id;

  // ── Sign in / out ────────────────────────────────────────────────────
  app.post("/api/tavern/login", loginLimiter, async (req, res) => {
    try {
      const phone = toSaWhatsApp(req.body && req.body.phone);
      const pin = req.body && req.body.pin;
      const wrong = () => res.status(401).json({ error: "Wrong phone number or PIN" });
      if (!phone || !D.isValidPin(pin)) return wrong();
      const taverns = await prisma.tavern.findMany({ where: { phone: { in: [phone, "0" + phone.slice(2), "+" + phone] } } });
      if (!taverns.length) return wrong();
      const accesses = (await prisma.tavernAccess.findMany({ where: { tavernId: { in: taverns.map((t) => t.id) }, active: true } }));
      if (!accesses.length) return wrong();
      const left = Math.max(...accesses.map((a) => D.lockMinutesLeft(a)));
      if (left > 0) return res.status(429).json({ error: `Too many wrong PINs. Try again in ${left} minute${left === 1 ? "" : "s"}, or ask Ekoyini to reset it.` });
      const hit = accesses.find((a) => D.verifyPin(pin, a.pinHash));
      if (!hit) {
        for (const a of accesses) {
          const fails = a.failedLogins + 1;
          const lock = fails >= D.MAX_FAILED_LOGINS;
          await prisma.tavernAccess.update({ where: { id: a.id }, data: { failedLogins: lock ? 0 : fails, lockedUntil: lock ? new Date(Date.now() + D.LOCK_MS) : null } });
        }
        return wrong();
      }
      const token = D.newSessionToken();
      await prisma.tavernAccess.update({
        where: { id: hit.id },
        data: { failedLogins: 0, lockedUntil: null, sessionHash: D.hashToken(token), sessionExpiresAt: new Date(Date.now() + D.SESSION_MS), lastLoginAt: new Date() },
      });
      res.json({ token, tavern: publicTavern(taverns.find((t) => t.id === hit.tavernId)) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not sign in" });
    }
  });

  app.post("/api/tavern/logout", requireTavern, async (req, res) => {
    await prisma.tavernAccess.update({ where: { id: req.access.id }, data: { sessionHash: null, sessionExpiresAt: null } }).catch(() => {});
    await prisma.pushSubscription.deleteMany({ where: { adminEmail: pinOwner(req.tavern) } }).catch(() => {});
    res.json({ ok: true });
  });

  // ── Closed-app alerts (web push) ─────────────────────────────────────
  app.get("/api/tavern/push/config", requireTavern, (req, res) => {
    res.json({ enabled: isConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });

  app.post("/api/tavern/push/subscribe", writeLimiter, requireTavern, async (req, res) => {
    try {
      const { endpoint, keys } = req.body || {};
      if (!isPushEndpoint(endpoint) || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 100) {
        return res.status(400).json({ error: "That phone could not be saved for order alerts" });
      }
      const owner = pinOwner(req.tavern);
      const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      if (existing && existing.adminEmail !== owner && !String(existing.adminEmail).startsWith("driver:") && !String(existing.adminEmail).startsWith(TAVERN_KEY_PREFIX)) {
        return res.status(409).json({ error: "This phone already gets admin alerts, so it cannot also get tavern alerts. Use a different phone or browser." });
      }
      const data = { p256dh: keys.p256dh, auth: keys.auth, adminEmail: owner, userAgent: short(req.headers["user-agent"], 200), lastSeenAt: new Date() };
      await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
      const mine = await prisma.pushSubscription.findMany({ where: { adminEmail: owner }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
      if (mine.length > T.MAX_DEVICES_PER_TAVERN) {
        await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.slice(T.MAX_DEVICES_PER_TAVERN).map((m) => m.id) } } });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[tavern push] subscribe failed:", err);
      res.status(500).json({ error: "Could not turn on order alerts" });
    }
  });

  app.post("/api/tavern/push/unsubscribe", writeLimiter, requireTavern, async (req, res) => {
    const endpoint = req.body && req.body.endpoint;
    if (typeof endpoint === "string") {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, adminEmail: pinOwner(req.tavern) } }).catch(() => {});
    }
    res.json({ ok: true });
  });

  // ── Everything the Orders screen needs, in one call ──────────────────
  app.get("/api/tavern/home", pollLimiter, requireTavern, async (req, res) => {
    try {
      const me = req.tavern;
      const now = new Date();
      const dayAgo = new Date(now.getTime() - DAY_MS);
      const [mine, waiting, taverns, blocked, soldOutCount] = await Promise.all([
        prisma.order.findMany({
          where: { tavernId: me.id, OR: [{ status: "PENDING" }, { status: "DISPATCHED", pickedUpAt: { gte: dayAgo } }] },
          include: { items: { select: { name: true, quantity: true } } }, orderBy: { assignedAt: "asc" },
        }),
        prisma.order.findMany({
          where: { status: "PENDING", driverPhone: null, driverName: null, tavernId: null },
          include: { items: { select: { name: true, quantity: true, skuId: true } } }, orderBy: { createdAt: "asc" }, take: 30,
        }),
        prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } }),
        T.loadBlocked(prisma),
        prisma.tavernSoldOut.count({ where: { tavernId: me.id } }),
      ]);
      const toPack = mine.filter((o) => o.status === "PENDING").map((o) => T.packView(o, now));
      const collected = mine.filter((o) => o.status === "DISPATCHED").map((o) => ({ ...T.packView(o, now), pickedUpAt: o.pickedUpAt }));
      const incoming = waiting.filter(D.isOnBoard).filter((o) => { const t = D.nearestTavern(o, taverns, blocked); return t && t.id === me.id; }).map((o) => T.incomingView(o, now));
      res.json({ tavern: publicTavern(me), toPack, incoming, collected, soldOutCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your orders" });
    }
  });

  // "Ready for collection" (and undo). Only this tavern's own waiting orders.
  app.post("/api/tavern/orders/:code/ready", writeLimiter, requireTavern, async (req, res) => {
    try {
      const ready = !(req.body && req.body.ready === false);
      const { count } = await prisma.order.updateMany({
        where: { code: String(req.params.code), tavernId: req.tavern.id, status: "PENDING" },
        data: { readyAt: ready ? new Date() : null },
      });
      if (!count) return res.status(404).json({ error: "That order is no longer waiting for collection." });
      if (ready && orderEvents) orderEvents.fire("READY", String(req.params.code)); // the driver and the customer hear it
      res.json({ ok: true, ready });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update the order" });
    }
  });

  // ── Sold-out items ───────────────────────────────────────────────────
  app.get("/api/tavern/stock", pollLimiter, requireTavern, async (req, res) => {
    try {
      const q = short(req.query.q, 60);
      const [skus, sold] = await Promise.all([
        prisma.skuItem.findMany({ select: { id: true, name: true, bottleFormat: true } }),
        prisma.tavernSoldOut.findMany({ where: { tavernId: req.tavern.id }, select: { skuId: true } }),
      ]);
      const soldIds = new Set(sold.map((s) => s.skuId));
      const byName = (a, b) => a.name.localeCompare(b.name) || String(a.bottleFormat).localeCompare(String(b.bottleFormat));
      const soldOut = skus.filter((s) => soldIds.has(s.id)).sort(byName).map(T.skuLabel);
      const results = q.length >= 2
        ? skus.filter((s) => T.matchesQuery(s, q)).sort(byName).slice(0, 40).map((s) => ({ ...T.skuLabel(s), soldOut: soldIds.has(s.id) }))
        : [];
      res.json({ soldOut, results });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load the items" });
    }
  });

  app.post("/api/tavern/stock", writeLimiter, requireTavern, async (req, res) => {
    try {
      const skuId = short(req.body && req.body.skuId, 60);
      const soldOut = !!(req.body && req.body.soldOut);
      if (!skuId || !(await prisma.skuItem.findUnique({ where: { id: skuId }, select: { id: true } }))) {
        return res.status(404).json({ error: "We could not find that item" });
      }
      if (soldOut) {
        if ((await prisma.tavernSoldOut.count({ where: { tavernId: req.tavern.id } })) >= T.MAX_SOLD_OUT) {
          return res.status(400).json({ error: "That is a lot of sold-out items. Please speak to Ekoyini." });
        }
        await prisma.tavernSoldOut.upsert({
          where: { tavernId_skuId: { tavernId: req.tavern.id, skuId } },
          create: { tavernId: req.tavern.id, skuId }, update: {},
        });
      } else {
        await prisma.tavernSoldOut.deleteMany({ where: { tavernId: req.tavern.id, skuId } });
      }
      res.json({ ok: true, soldOut });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save that" });
    }
  });

  // ── What Ekoyini owes this tavern, day by day (same sums as admin Payouts) ──
  app.get("/api/tavern/money", pollLimiter, requireTavern, async (req, res) => {
    try {
      const now = new Date();
      const days = [];
      for (let i = 0; i < 7; i++) days.push(saDay(new Date(now.getTime() - i * DAY_MS)));
      const [results, paid] = await Promise.all([
        Promise.all(days.map((d) => payoutsFor(prisma, d, d))),
        prisma.payout.findMany({ where: { payeeType: "TAVERN", payeeKey: req.tavern.id, period: { in: days } } }),
      ]);
      const paidBy = new Map(paid.map((p) => [p.period, p]));
      const rows = days.map((day, i) => {
        const mine = results[i].taverns.find((t) => t.key === req.tavern.id);
        const p = paidBy.get(day);
        return { day, orders: mine ? mine.orders.length : 0, owed: mine ? mine.owed : 0, paid: p ? { at: p.paidAt, amount: p.amount } : null };
      });
      const sum = (list) => Math.round(list.reduce((n, r) => n + r.owed, 0) * 100) / 100;
      res.json({
        today: rows[0], yesterday: rows[1], days: rows,
        weekOwed: sum(rows), weekUnpaid: sum(rows.filter((r) => r.owed > 0 && !r.paid)),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not work out your money" });
    }
  });

  // ── Admin: switch the portal on for a tavern ─────────────────────────
  app.get("/admin/tavern-access", requireAdmin, async (req, res) => {
    try {
      const [taverns, accesses, sold, subs] = await Promise.all([
        prisma.tavern.findMany({ orderBy: { name: "asc" } }),
        prisma.tavernAccess.findMany(),
        prisma.tavernSoldOut.findMany({ select: { tavernId: true } }),
        prisma.pushSubscription.findMany({ where: { adminEmail: { startsWith: TAVERN_KEY_PREFIX } }, select: { adminEmail: true } }),
      ]);
      const by = (key, list) => list.reduce((m, x) => m.set(x[key], (m.get(x[key]) || 0) + 1), new Map());
      const soldBy = by("tavernId", sold);
      const phonesBy = new Map();
      subs.forEach((s) => { const id = s.adminEmail.slice(TAVERN_KEY_PREFIX.length); phonesBy.set(id, (phonesBy.get(id) || 0) + 1); });
      const accessBy = new Map(accesses.map((a) => [a.tavernId, a]));
      res.json(taverns.map((t) => {
        const a = accessBy.get(t.id);
        return {
          id: t.id, name: t.name, area: t.area, phone: t.phone, signInOk: !!toSaWhatsApp(t.phone),
          access: a ? { active: a.active, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt } : null,
          soldOut: soldBy.get(t.id) || 0, alertPhones: phonesBy.get(t.id) || 0,
        };
      }));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load tavern access" });
    }
  });

  app.post("/admin/tavern-access/:tavernId", requireAdmin, writeLimiter, async (req, res) => {
    try {
      const tavern = await prisma.tavern.findUnique({ where: { id: String(req.params.tavernId) } });
      if (!tavern) return res.status(404).json({ error: "Tavern not found" });
      const action = req.body && req.body.action;
      const existing = await prisma.tavernAccess.findUnique({ where: { tavernId: tavern.id } });
      let pin = null;
      let access;
      if (action === "enable") {
        if (!toSaWhatsApp(tavern.phone)) return res.status(400).json({ error: "Save a valid cell number for this tavern first (Taverns tab). It is the tavern's sign-in." });
        if (existing) return res.status(409).json({ error: "The portal is already on for this tavern. Use Reset PIN instead." });
        pin = D.newDriverPin();
        access = await prisma.tavernAccess.create({ data: { tavernId: tavern.id, pinHash: D.hashPin(pin) } });
      } else if (!existing) {
        return res.status(404).json({ error: "Switch the portal on first" });
      } else if (action === "reset") {
        pin = D.newDriverPin();
        access = await prisma.tavernAccess.update({ where: { id: existing.id }, data: { pinHash: D.hashPin(pin), failedLogins: 0, lockedUntil: null, sessionHash: null, sessionExpiresAt: null } });
        await prisma.pushSubscription.deleteMany({ where: { adminEmail: pinOwner(tavern) } }).catch(() => {});
      } else if (action === "pause") {
        access = await prisma.tavernAccess.update({ where: { id: existing.id }, data: { active: false, sessionHash: null, sessionExpiresAt: null } });
        await prisma.pushSubscription.deleteMany({ where: { adminEmail: pinOwner(tavern) } }).catch(() => {});
      } else if (action === "resume") {
        access = await prisma.tavernAccess.update({ where: { id: existing.id }, data: { active: true } });
      } else {
        return res.status(400).json({ error: "Unknown action" });
      }
      await logAdminAction(req, "TAVERN_ACCESS", tavern.id, `tavern=${tavern.name}, ${action}`);
      res.json({ ok: true, pin, tavern: { id: tavern.id, name: tavern.name, phone: tavern.phone }, active: access.active });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update tavern access" });
    }
  });
};
