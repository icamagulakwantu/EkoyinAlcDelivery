// Server-side delivery quote: finds the nearest tavern that has a saved
// location, measures the distance to the customer's pin, and builds the fee
// breakdown with the shared rules in public/pricing.js.
//
// Note: stock is tracked per product, not per tavern, so "nearest tavern"
// means the nearest one with a saved location.
const { routedDistanceKm, buildDeliveryQuote, PRIORITY_OPTIONS } = require("../public/pricing.js");

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
  return async function quoteDelivery({ subtotal, deliveryLat, deliveryLng, priorityFee, now }) {
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
    });
    return { needsPin, quote, tavern };
  };
}

module.exports = { createQuoter, isValidPin, SA_BOUNDS };
