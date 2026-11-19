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

const short = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

module.exports = function mountDrivers(app, { prisma, requireAdmin, writeLimiter, logAdminAction, push }) {
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
    res.json({ ok: true });
  });

  // ── Everything the driver screen needs, in one call ──────────────────
  app.get("/api/driver/home", pollLimiter, requireDriver, async (req, res) => {
    try {
      const d = req.driver;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 8 * 86400000);
      const [mine, waiting, delivered, taverns] = await Promise.all([
        prisma.order.findMany({
          where: { driverPhone: d.phone, status: { in: ["PENDING", "DISPATCHED"] } },
          include: { tavern: true, items: true }, orderBy: { createdAt: "asc" },
        }),
        prisma.order.findMany({
          where: { status: "PENDING", driverPhone: null, driverName: null },
          include: { items: { select: { quantity: true } } }, orderBy: { createdAt: "asc" }, take: 30,
        }),
        prisma.order.findMany({
          where: { driverPhone: d.phone, status: "DELIVERED", deliveredAt: { gte: weekAgo } },
          select: { code: true, total: true, paymentMethod: true, deliveryFee: true, surgeFee: true, priorityFee: true, deliveredAt: true },
        }),
        prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } }),
      ]);
      res.json({
        driver: publicDriver(d),
        maxJobs: D.MAX_ACTIVE_JOBS,
        jobs: mine.map((o) => D.jobView(o)),
        board: waiting.filter(D.isOnBoard).map((o) => D.boardView(o, taverns, now)),
        earnings: D.summariseEarnings(delivered, now),
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
      const order = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: { tavern: true } });
      if (!order || !D.isOnBoard(order)) return res.status(409).json({ error: "Someone else already took this job." });
      const active = await prisma.order.count({ where: { driverPhone: d.phone, status: { in: ["PENDING", "DISPATCHED"] } } });
      if (active >= D.MAX_ACTIVE_JOBS) return res.status(400).json({ error: `You already have ${D.MAX_ACTIVE_JOBS} jobs. Finish one first.` });
      const taverns = await prisma.tavern.findMany({ select: { id: true, name: true, area: true, latitude: true, longitude: true } });
      const tavern = D.nearestTavern(order, taverns);
      if (!tavern) return res.status(400).json({ error: "Dispatch needs to pick the tavern for this one. Please ask them." });
      const driverShareToken = crypto.randomBytes(16).toString("hex");
      const { count } = await prisma.order.updateMany({
        where: { id: order.id, status: "PENDING", driverPhone: null, driverName: null },
        data: { tavernId: tavern.id, driverName: d.name, driverPhone: d.phone, driverVehicle: d.vehicle, driverShareToken, collectionPin: newPin(), assignedAt: new Date() },
      });
      if (count === 0) return res.status(409).json({ error: "Someone else already took this job." });
      // Admin still sends the tavern its collection PIN, so tell them right away.
      if (push && push.sendToAdmins) {
        push.sendToAdmins({
          title: `${d.name} took ${order.code}`,
          body: `Send ${tavern.name} the collection PIN so ${d.name} can collect it.`,
          tag: "driver-took-job", url: "/admin/admin.html", urgent: true,
        }).catch((e) => console.error("[push] driver took job alert failed:", e));
      }
      res.json({ ok: true, code: order.code });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not take the job" });
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
      await logAdminAction(req, "UPDATE_DRIVER", driver.id, `driver=${driver.name}${pin ? ", pin reset" : ""}${typeof body.active === "boolean" ? `, active=${body.active}` : ""}`);
      res.json({ driver: adminView(updated), pin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update the driver" });
    }
  });
};
