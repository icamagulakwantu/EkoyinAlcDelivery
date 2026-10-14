// ═══════════════════════════════════════════════
// EKOYINI — Shared pricing logic (Cooler Box + delivery quote)
// Single source of truth, loaded by both server.js (via require) and the
// browser (via <script src="pricing.js">). Previously this exact set +
// function was copy-pasted into server.js, shop.html, and checkout.html
// separately — any edit to the thresholds or eligible categories had to
// be made in three places by hand, with nothing to catch a missed one.
// ═══════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EkoyiniPricing = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Every category counts toward the Cooler Box — per the actual product,
  // a real cooler box is a bottle (any spirit/wine/champagne) plus two or
  // three carry packs plus ice and mixers, not a fixed subset of "high
  // turnover" categories.
  const COOLER_ELIGIBLE = new Set([
    'BEER', 'CIDER_RTD', 'BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA',
    'VODKA_PREMIUM', 'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'MIXER',
    'WINE', 'WINE_BOX', 'SPARKLING', 'CHAMPAGNE', 'WATER', 'ICE',
  ]);

  // Negotiated with the supplier: a single flat 5% once the eligible
  // subtotal (the physical cooler box itself is not counted) reaches R750.
  const COOLER_MIN_SUBTOTAL = 750;
  const COOLER_DISCOUNT_PCT = 0.05;

  function coolerDiscountPct(coolerSubtotal) {
    return coolerSubtotal >= COOLER_MIN_SUBTOTAL ? COOLER_DISCOUNT_PCT : 0;
  }

  // Orders below this (pre-discount) subtotal don't qualify for delivery.
  const MIN_ORDER_SUBTOTAL = 300;

  // ── Delivery quote ─────────────────────────────────────────────
  // The delivery fee is built from four parts, all calculated on the server
  // at order time (the browser only previews them):
  //   1. Distance fee  — by straight-line distance x ROUTING_BUFFER
  //   2. Surge fee     — time of day (South African time), 100% to the driver
  //   3. Priority fee  — optional "Super Priority" the customer adds
  //   4. Service fee   — flat R10-R25, based on distance and surge window

  // Delivery is free once the (pre-discount) subtotal is above this. Only the
  // distance fee is waived; surge, priority and service fees still apply.
  const FREE_DELIVERY_THRESHOLD = 1000;

  // Straight-line distance is multiplied by this to account for real roads.
  const ROUTING_BUFFER = 1.2;

  const BASE_DELIVERY_FEE = 40; // up to 5 km (also the floor)
  const MID_DELIVERY_FEE = 55; // over 5 km, up to 10 km
  const FAR_DELIVERY_FEE = 75; // over 10 km, plus the per-km charge below
  const FAR_PER_KM_FEE = 6.5; // per km beyond 10 km
  const DELIVERY_FEE = BASE_DELIVERY_FEE; // kept for older callers

  const PEAK_SURGE_FEE = 20; // 16:00 to 22:00
  const LATE_NIGHT_SURGE_FEE = 30; // 22:00 to 04:00
  const PEAK_START_HOUR = 16;
  const LATE_NIGHT_START_HOUR = 22;
  const LATE_NIGHT_END_HOUR = 4;

  const PRIORITY_OPTIONS = [0, 10, 20, 30, 40, 50];

  const SA_UTC_OFFSET_HOURS = 2; // South Africa has no daylight saving

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  // Great-circle ("as the crow flies") distance in km.
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Straight-line distance with the township-roads buffer applied.
  function routedDistanceKm(lat1, lng1, lat2, lng2) {
    return round2(haversineKm(lat1, lng1, lat2, lng2) * ROUTING_BUFFER);
  }

  // distanceKm null (no distance data) falls back to the base fee.
  function distanceDeliveryFee(distanceKm) {
    if (distanceKm == null || distanceKm <= 5) return BASE_DELIVERY_FEE;
    if (distanceKm <= 10) return MID_DELIVERY_FEE;
    return round2(FAR_DELIVERY_FEE + FAR_PER_KM_FEE * (distanceKm - 10));
  }

  // Which surge window (if any) is active at this moment, on SA time.
  function surgeWindow(now) {
    const saHour = new Date(now.getTime() + SA_UTC_OFFSET_HOURS * 3600 * 1000).getUTCHours();
    if (saHour >= LATE_NIGHT_START_HOUR || saHour < LATE_NIGHT_END_HOUR) {
      return { key: 'LATE_NIGHT', fee: LATE_NIGHT_SURGE_FEE };
    }
    if (saHour >= PEAK_START_HOUR) return { key: 'PEAK', fee: PEAK_SURGE_FEE };
    return { key: null, fee: 0 };
  }

  // R10 / R15 / R20 by distance band, +R5 inside a surge window (max R25).
  function serviceFeeFor(distanceKm, surgeKey) {
    let fee = 10;
    if (distanceKm != null && distanceKm > 10) fee = 20;
    else if (distanceKm != null && distanceKm > 5) fee = 15;
    return fee + (surgeKey ? 5 : 0);
  }

  function buildDeliveryQuote({ subtotal, distanceKm, priorityFee, now, surgesEnabled }) {
    const km = Number.isFinite(distanceKm) ? distanceKm : null;
    const surge = surgesEnabled === false ? { key: null, fee: 0 } : surgeWindow(now || new Date());
    const priority = PRIORITY_OPTIONS.includes(priorityFee) ? priorityFee : 0;
    const deliveryFee = subtotal > FREE_DELIVERY_THRESHOLD ? 0 : distanceDeliveryFee(km);
    const serviceFee = serviceFeeFor(km, surge.key);
    return {
      distanceKm: km,
      deliveryFee,
      surgeKey: surge.key,
      surgeFee: surge.fee,
      priorityFee: priority,
      serviceFee,
      total: round2(deliveryFee + surge.fee + priority + serviceFee),
    };
  }

  // Base delivery fee for a subtotal, ignoring distance. Used by the cart
  // for a rough estimate only; checkout shows the real quote.
  function deliveryFee(subtotal) {
    return subtotal > FREE_DELIVERY_THRESHOLD ? 0 : BASE_DELIVERY_FEE;
  }

  return {
    MIN_ORDER_SUBTOTAL,
    COOLER_ELIGIBLE,
    COOLER_MIN_SUBTOTAL,
    COOLER_DISCOUNT_PCT,
    coolerDiscountPct,
    FREE_DELIVERY_THRESHOLD,
    DELIVERY_FEE,
    deliveryFee,
    ROUTING_BUFFER,
    PRIORITY_OPTIONS,
    haversineKm,
    routedDistanceKm,
    distanceDeliveryFee,
    surgeWindow,
    serviceFeeFor,
    buildDeliveryQuote,
  };
});
