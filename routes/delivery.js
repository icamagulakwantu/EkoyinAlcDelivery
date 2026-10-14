// Delivery fee preview for checkout, plus the admin settings behind it
// (tavern locations and the surge on/off switch).
const rateLimit = require("express-rate-limit");
const { isValidPin } = require("../lib/delivery-quote.js");

// Checkout re-quotes on every priority tap, so this is looser than the
// order-creation limiter.
const quoteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment" },
});

function parseCoordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

module.exports = function mountDelivery(app, { prisma, requireAdmin, requireSuperAdmin, logAdminAction, quoteDelivery }) {
  // PUBLIC: preview the delivery fee. The real fee is recalculated on the
  // server when the order is placed, so nothing sent here can lower the price.
  app.post("/api/delivery-quote", quoteLimiter, async (req, res) => {
    try {
      const { subtotal, deliveryLat, deliveryLng, priorityFee } = req.body || {};
      const parsedSubtotal = parseFloat(subtotal);
      if (!Number.isFinite(parsedSubtotal) || parsedSubtotal < 0) {
        return res.status(400).json({ error: "subtotal is required" });
      }
      const lat = parseCoordinate(deliveryLat);
      const lng = parseCoordinate(deliveryLng);
      const pinOk = lat !== null && lng !== null && isValidPin(lat, lng);
      const result = await quoteDelivery({
        subtotal: parsedSubtotal,
        deliveryLat: pinOk ? lat : null,
        deliveryLng: pinOk ? lng : null,
        priorityFee,
      });
      if (result.error) return res.status(400).json({ error: result.error });
      res.json({ needsPin: result.needsPin, quote: result.quote });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to work out the delivery fee" });
    }
  });

  // ADMIN: surge switch + every tavern with its saved location.
  app.get("/admin/delivery-settings", requireAdmin, async (req, res) => {
    try {
      const [settings, taverns] = await Promise.all([
        prisma.deliverySettings.findUnique({ where: { id: "default" } }),
        prisma.tavern.findMany({
          select: { id: true, name: true, area: true, latitude: true, longitude: true },
          orderBy: { name: "asc" },
        }),
      ]);
      res.json({ surgesEnabled: settings ? settings.surgesEnabled : true, taverns });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load delivery settings" });
    }
  });

  app.patch("/admin/delivery-settings", requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const { surgesEnabled } = req.body || {};
      if (typeof surgesEnabled !== "boolean") return res.status(400).json({ error: "surgesEnabled must be true or false" });
      const settings = await prisma.deliverySettings.upsert({
        where: { id: "default" },
        update: { surgesEnabled },
        create: { id: "default", surgesEnabled },
      });
      await logAdminAction(req, "UPDATE_DELIVERY_SETTINGS", "default", `surgesEnabled=${surgesEnabled}`);
      res.json({ surgesEnabled: settings.surgesEnabled });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save delivery settings" });
    }
  });

  // ADMIN: save (or clear, with nulls) a tavern's coordinates.
  app.patch("/admin/taverns/:id/location", requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const lat = parseCoordinate(req.body?.latitude);
      const lng = parseCoordinate(req.body?.longitude);
      const clearing = lat === null && lng === null;
      if (!clearing && (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng) || !isValidPin(lat, lng))) {
        return res.status(400).json({ error: "Enter a valid South African location, like -26.2041, 28.0473" });
      }
      const tavern = await prisma.tavern.update({
        where: { id: req.params.id },
        data: { latitude: clearing ? null : lat, longitude: clearing ? null : lng },
        select: { id: true, name: true, latitude: true, longitude: true },
      });
      await logAdminAction(req, "UPDATE_TAVERN_LOCATION", tavern.name, clearing ? "cleared" : `${lat}, ${lng}`);
      res.json(tavern);
    } catch (err) {
      console.error(err);
      res.status(404).json({ error: "Tavern not found" });
    }
  });
};
