// Server-side delivery quote: finds the nearest tavern that has a saved
// location, measures the distance to the customer's pin, and builds the fee
// breakdown with the shared rules in public/pricing.js.
//
// Note: stock is tracked per product, not per tavern, so "nearest tavern"
// means the nearest one with a saved location.
const { routedDistanceKm, buildDeliveryQuote, PRIORITY_OPTIONS, orderWeightKg } = require("../public/pricing.js");

// Rough bounding box of South Africa. A pin outside it is almost certainly
// a desktop browser's IP-based guess, not where the customer really is.
const SA_BOUNDS = { minLat: -35.5, maxLat: -21.5, minLng: 16, maxLng: 33.5 };

function isValidPin(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= SA_BOUNDS.minLat && lat <= SA_BOUNDS.maxLat
    && lng >= SA_BOUNDS.minLng && lng <= SA_BOUNDS.maxLng;
}

function createQuoter(prisma) {
  // Returns { error } | { needsPin, quote, tavern }.
  // needsPin is true when taverns have saved locations but the customer
  // hasn't shared a pin yet; the quote then uses the base fee as a preview.
  // weightKg: the order's weight, worked out by the caller from real SKU rows.
  return async function quoteDelivery({ subtotal, deliveryLat, deliveryLng, priorityFee, now, weightKg }) {
    const priority = Number(priorityFee || 0);
    if (!PRIORITY_OPTIONS.includes(priority)) return { error: "Invalid priority option" };

    const [settings, taverns] = await Promise.all([
      prisma.deliverySettings.findUnique({ where: { id: "default" } }),
      prisma.tavern.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { id: true, name: true, latitude: true, longitude: true },
      }),
    ]);

    const hasPin = deliveryLat != null && deliveryLng != null;
    let distanceKm = null;
    let tavern = null;
    let needsPin = false;

    if (taverns.length > 0) {
      if (!hasPin) {
        needsPin = true;
      } else {
        for (const t of taverns) {
          const km = routedDistanceKm(t.latitude, t.longitude, deliveryLat, deliveryLng);
          if (distanceKm === null || km < distanceKm) {
            distanceKm = km;
            tavern = { id: t.id, name: t.name };
          }
        }
      }
    }

    const quote = buildDeliveryQuote({
      subtotal,
      distanceKm,
      priorityFee: priority,
      now: now || new Date(),
      surgesEnabled: settings ? settings.surgesEnabled : true,
      weightKg,
    });
    return { needsPin, quote, tavern };
  };
}

// Weight of a cart from SKU ids, using the real catalogue rows (never trusts
// sizes sent by the browser). items: [{ skuId, quantity }].
async function cartWeightKg(prisma, items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) return 0;
  const ids = items.map((i) => String(i && i.skuId || "")).filter(Boolean);
  const skus = await prisma.skuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, bottleFormat: true, packSize: true, category: true },
  });
  const byId = new Map(skus.map((s) => [s.id, s]));
  return orderWeightKg(items.map((i) => {
    const s = byId.get(String(i && i.skuId || ""));
    const q = parseInt(i && i.quantity, 10);
    return s && Number.isInteger(q) && q > 0 && q <= 1000 ? { ...s, quantity: q } : null;
  }).filter(Boolean));
}

module.exports = { createQuoter, isValidPin, SA_BOUNDS, cartWeightKg };
