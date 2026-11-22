// Driver app (founder approved 20 Nov 2026).
//   Driver side: sign in with phone + PIN, see own jobs, take a job from the board, earnings.
//   Admin side:  add a driver, pause or resume, reset a PIN.
// Pickup and delivery stay on the existing PIN-proven endpoints (/order/:code/confirm-*),
// authorised by the per-order driver link this app hands to the driver who took the job.
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { toSaWhatsApp } = require("../lib/phone.js");
const { newPin } = require("../lib/dispatch.js");
const D = require("../lib/driver-app.js");
const { buildReceipt } = require("../public/receipt.js");
const { isPushEndpoint, isConfigured, DRIVER_KEY_PREFIX } = require("../lib/push.js");
const { loadBlocked } = require("../lib/tavern-portal.js");

const MAX_DEVICES_PER_DRIVER = 5;
const short = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

module.exports = function mountDrivers(app, { prisma, requireAdmin, writeLimiter, logAdminAction, push, tavernPush, orderEvents }) {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many attempts. Please wait a few minutes and try again." },
  });
  const pollLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Slow down a little" } });

  async function requireDriver(req, res, next) {
    try {
      const header = String(req.headers.authorization || "");
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!D.isTokenShape(token)) return res.status(401).json({ error: "Please sign in" });
      const driver = await prisma.driver.findFirst({ where: { sessionHash: D.hashToken(token) } });
      if (!driver || !driver.active || !driver.sessionExpiresAt || new Date(driver.sessionExpiresAt) < new Date()) {
        return res.status(401).json({ error: "Please sign in" });
      }
      req.driver = driver;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }

  const publicDriver = (d) => ({ name: d.name, vehicle: d.vehicle || null, phone: d.phone });

  // ── Sign in / out ────────────────────────────────────────────────────
  app.post("/api/driver/login", loginLimiter, async (req, res) => {
    try {
      const phone = toSaWhatsApp(req.body && req.body.phone);
      const pin = req.body && req.body.pin;
      const wrong = () => res.status(401).json({ error: "Wrong phone number or PIN" });
      if (!phone || !D.isValidPin(pin)) return wrong();
      const driver = await prisma.driver.findUnique({ where: { phone } });
      if (!driver || !driver.active) return wrong();
      const left = D.lockMinutesLeft(driver);
      if (left > 0) return res.status(429).json({ error: `Too many wrong PINs. Try again in ${left} minute${left === 1 ? "" : "s"}, or ask dispatch to reset it.` });
      if (!D.verifyPin(pin, driver.pinHash)) {
        const fails = driver.failedLogins + 1;
        const lock = fails >= D.MAX_FAILED_LOGINS;
        await prisma.driver.update({ where: { id: driver.id }, data: { failedLogins: lock ? 0 : fails, lockedUntil: lock ? new Date(Date.now() + D.LOCK_MS) : null } });
        return wrong();
      }
      const token = D.newSessionToken();
      await prisma.driver.update({
        where: { id: driver.id },
        data: { failedLogins: 0, lockedUntil: null, sessionHash: D.hashToken(token), sessionExpiresAt: new Date(Date.now() + D.SESSION_MS), lastLoginAt: new Date() },
      });
      res.json({ token, driver: publicDriver(driver) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not sign in" });
    }
  });

  app.post("/api/driver/logout", requireDriver, async (req, res) => {
    await prisma.driver.update({ where: { id: req.driver.id }, data: { sessionHash: null, sessionExpiresAt: null } }).catch(() => {});
    // A signed-out phone must stop buzzing.
    await prisma.pushSubscription.deleteMany({ where: { adminEmail: DRIVER_KEY_PREFIX + req.driver.id } }).catch(() => {});
    res.json({ ok: true });
  });

  // ── Closed-app job alerts (web push) ─────────────────────────────────
  app.get("/api/driver/push/config", requireDriver, (req, res) => {
    res.json({ enabled: isConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });

  app.post("/api/driver/push/subscribe", writeLimiter, requireDriver, async (req, res) => {
    try {
      const { endpoint, keys } = req.body || {};
      if (!isPushEndpoint(endpoint) || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 100) {
        return res.status(400).json({ error: "That phone could not be saved for job alerts" });
      }
      const owner = DRIVER_KEY_PREFIX + req.driver.id;
      const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      if (existing && existing.adminEmail !== owner && !existing.adminEmail.startsWith(DRIVER_KEY_PREFIX)) {
        return res.status(409).json({ error: "This phone already gets admin alerts, so it cannot also get driver alerts. Use a different phone or browser." });
      }
      const data = { p256dh: keys.p256dh, auth: keys.auth, adminEmail: owner, userAgent: short(req.headers["user-agent"], 200), lastSeenAt: new Date() };
      await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
      // Keep the newest few phones per driver.
      const mine = await prisma.pushSubscription.findMany({ where: { adminEmail: owner }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
      if (mine.length > MAX_DEVICES_PER_DRIVER) {
        await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.slice(MAX_DEVICES_PER_DRIVER).map((m) => m.id) } } });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[driver push] subscribe failed:", err);
      res.status(500).json({ error: "Could not turn on job alerts" });
    }
  });

  app.post("/api/driver/push/unsubscribe", writeLimiter, requireDriver, async (req, res) => {
    const endpoint = req.body && req.body.endpoint;
    if (typeof endpoint === "string") {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, adminEmail: DRIVER_KEY_PREFIX + req.driver.id } }).catch(() => {});
    }
    res.json({ ok: true });
  });

  // ── Everything the driver screen needs, in one call ──────────────────
  app.get("/api/driver/home", pollLimiter, requireDriver, async (req, res) => {
    try {
      const d = req.driver;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 8 * 86400000);
      const [mine, waiting, delivered, taverns, blocked, rated] = await Promise.all([
        prisma.order.findMany({
          where: { driverPhone: d.phone, status: { in: ["PENDING", "DISPATCHED"] } },
          include: { tavern: true, items: true }, orderBy: { createdAt: "asc" },
        }),
        prisma.order.findMany({
          where: { status: "PENDING", driverPhone: null, driverName: null },
          include: { items: { select: { quantity: true, skuId: true } } }, orderBy: { createdAt: "asc" }, take: 30,
        }),
        prisma.order.findMany({
          where: { driverPhone: d.phone, status: "DELIVERED", deliveredAt: { gte: weekAgo } },
          select: { code: true, total: true, paymentMethod: true, deliveryFee: true, surgeFee: true, priorityFee: true, deliveredAt: true },
        }),
        prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } }),
        loadBlocked(prisma),
        prisma.order.findMany({ where: { driverPhone: d.phone, status: "DELIVERED", rating: { not: null } }, select: { rating: true }, orderBy: { deliveredAt: "desc" }, take: 200 }),
      ]);
      res.json({
        driver: publicDriver(d),
        maxJobs: D.MAX_ACTIVE_JOBS,
        jobs: mine.map((o) => D.jobView(o)),
        board: waiting.filter(D.isOnBoard).map((o) => D.boardView(o, taverns, now, blocked)),
        earnings: D.summariseEarnings(delivered, now),
        ratings: D.summariseRatings(rated),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your jobs" });
    }
  });

  // ── Take a job from the board (first driver wins, atomically) ────────
  app.post("/api/driver/jobs/:id/take", writeLimiter, requireDriver, async (req, res) => {
    try {
      const d = req.driver;
      const order = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: { tavern: true, items: { select: { skuId: true } } } });
      if (!order || !D.isOnBoard(order)) return res.status(409).json({ error: "Someone else already took this job." });
      const active = await prisma.order.count({ where: { driverPhone: d.phone, status: { in: ["PENDING", "DISPATCHED"] } } });
      if (active >= D.MAX_ACTIVE_JOBS) return res.status(400).json({ error: `You already have ${D.MAX_ACTIVE_JOBS} jobs. Finish one first.` });
      const taverns = await prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } });
      const tavern = D.nearestTavern(order, taverns, await loadBlocked(prisma));
      if (!tavern) return res.status(400).json({ error: "Dispatch needs to pick the tavern for this one. Please ask them." });
      const driverShareToken = crypto.randomBytes(16).toString("hex");
      const { count } = await prisma.order.updateMany({
        where: { id: order.id, status: "PENDING", driverPhone: null, driverName: null },
        data: { tavernId: tavern.id, driverName: d.name, driverPhone: d.phone, driverVehicle: d.vehicle, driverShareToken, collectionPin: newPin(), assignedAt: new Date() },
      });
      if (count === 0) return res.status(409).json({ error: "Someone else already took this job." });
      // The tavern portal shows the tavern its PIN; a tavern without the portal still needs admin to send it.
      if (tavernPush) tavernPush.notifyAssigned({ id: order.id, code: order.code, tavernId: tavern.id, driverName: d.name }).catch(() => {});
      if (push && push.sendToAdmins) {
        push.sendToAdmins({
          title: `${d.name} took ${order.code}`,
          body: `Send ${tavern.name} the collection PIN so ${d.name} can collect it.`,
          tag: "driver-took-job", url: "/admin/admin.html", urgent: true,
        }).catch((e) => console.error("[push] driver took job alert failed:", e));
      }
      if (orderEvents) orderEvents.fire("DRIVER_TOOK", order.code); // tells the customer
      res.json({ ok: true, code: order.code });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not take the job" });
    }
  });

  // ── The driver's copy of the receipt for a delivery they made (founder, 22 Nov 2026) ──
  // Same receipt the customer gets (items, fees, order time, delivery time) plus what the driver earned and any
  // cash to hand in. Only for the driver who delivered it; no phone numbers or PINs.
  app.get("/api/driver/receipt/:code", pollLimiter, requireDriver, async (req, res) => {
    try {
      const order = await prisma.order.findUnique({ where: { code: String(req.params.code) }, include: { items: true, tavern: true } });
      if (!order || order.driverPhone !== req.driver.phone || order.status !== "DELIVERED") return res.status(404).json({ error: "Receipt not found" });
      res.set("Cache-Control", "no-store").json({ receipt: buildReceipt(order), earned: D.driverEarn(order), cash: D.cashHeld(order) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load the receipt" });
    }
  });

  // ── Admin: manage drivers ────────────────────────────────────────────
  const adminView = (d) => ({ id: d.id, name: d.name, phone: d.phone, vehicle: d.vehicle, active: d.active, lastLoginAt: d.lastLoginAt, createdAt: d.createdAt });

  app.get("/admin/drivers", requireAdmin, async (req, res) => {
    const list = await prisma.driver.findMany({ orderBy: { createdAt: "asc" } });
    res.json(list.map(adminView));
  });

  app.post("/admin/drivers", requireAdmin, writeLimiter, async (req, res) => {
    try {
      const name = short(req.body && req.body.name, 60);
      const phone = toSaWhatsApp(req.body && req.body.phone);
      const vehicle = short(req.body && req.body.vehicle, 60) || null;
      if (!name) return res.status(400).json({ error: "Enter the driver's name" });
      if (!phone) return res.status(400).json({ error: "Enter the driver's cell number, e.g. 071 234 5678" });
      if (await prisma.driver.findUnique({ where: { phone } })) return res.status(409).json({ error: "That number is already a driver. Use Reset PIN instead." });
      const pin = D.newDriverPin();
      const driver = await prisma.driver.create({ data: { name, phone, vehicle, pinHash: D.hashPin(pin) } });
      await logAdminAction(req, "ADD_DRIVER", driver.id, `driver=${name}`);
      res.json({ driver: adminView(driver), pin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not add the driver" });
    }
  });

  app.patch("/admin/drivers/:id", requireAdmin, writeLimiter, async (req, res) => {
    try {
      const driver = await prisma.driver.findUnique({ where: { id: String(req.params.id) } });
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      const body = req.body || {};
      const data = {};
      let pin = null;
      if (typeof body.active === "boolean") {
        data.active = body.active;
        if (!body.active) { data.sessionHash = null; data.sessionExpiresAt = null; } // signed out at once
      }
      if (typeof body.name === "string" && body.name.trim()) data.name = short(body.name, 60);
      if (typeof body.vehicle === "string") data.vehicle = short(body.vehicle, 60) || null;
      if (body.resetPin === true) {
        pin = D.newDriverPin();
        Object.assign(data, { pinHash: D.hashPin(pin), failedLogins: 0, lockedUntil: null, sessionHash: null, sessionExpiresAt: null });
      }
      const updated = await prisma.driver.update({ where: { id: driver.id }, data });
      if (data.active === false || body.resetPin === true) {
        await prisma.pushSubscription.deleteMany({ where: { adminEmail: DRIVER_KEY_PREFIX + driver.id } }).catch(() => {});
      }
      await logAdminAction(req, "UPDATE_DRIVER", driver.id, `driver=${driver.name}${pin ? ", pin reset" : ""}${typeof body.active === "boolean" ? `, active=${body.active}` : ""}`);
      res.json({ driver: adminView(updated), pin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update the driver" });
    }
  });
};
