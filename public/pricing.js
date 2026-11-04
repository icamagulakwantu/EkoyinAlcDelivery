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

  // Cooler Box discount (founder decision, Nov 2026): 5% once the eligible
  // subtotal (the physical cooler box itself is not counted) reaches R1000,
  // and 8% above R2000. It is only available until 20:00 South African time
  // and comes back at 04:00, when the late-night window ends.
  const COOLER_MIN_SUBTOTAL = 1000;
  const COOLER_DISCOUNT_PCT = 0.05;
  const COOLER_TOP_SUBTOTAL = 2000; // above this amount the top tier applies
  const COOLER_TOP_DISCOUNT_PCT = 0.08;
  const COOLER_CUTOFF_HOUR = 20;
  const COOLER_RESUME_HOUR = 4;

  function saHourOf(now) {
    return new Date(now.getTime() + SA_UTC_OFFSET_HOURS * 3600 * 1000).getUTCHours();
  }

  // True while the Cooler Box discount may be given (04:00 to 19:59 SA time).
  function coolerDiscountAvailable(now) {
    const hour = saHourOf(now || new Date());
    return hour >= COOLER_RESUME_HOUR && hour < COOLER_CUTOFF_HOUR;
  }

  // `now` is the moment the order is priced. The server passes it in so the
  // quote and the payment check use the same clock.
  function coolerDiscountPct(coolerSubtotal, now) {
    if (!coolerDiscountAvailable(now)) return 0;
    if (coolerSubtotal > COOLER_TOP_SUBTOTAL) return COOLER_TOP_DISCOUNT_PCT;
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
  //   4. Service fee   — R50 to R110, rising with the order value
  //
  // There is no free delivery: every order pays the distance fee.

  // Service fee bands, by pre-discount order value. Edit the numbers here;
  // the server, checkout and cart all read this one table.
  const SERVICE_FEE_BANDS = [
    { upTo: 500, fee: 50 }, // R300 - R499
    { upTo: 800, fee: 65 }, // R500 - R799
    { upTo: 1201, fee: 80 }, // R800 - R1200
    { upTo: 1600, fee: 95 }, // R1201 - R1599
    { upTo: Infinity, fee: 110 }, // R1600 and above
  ];

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

  // Rounds any money value to cents. Non-numeric input (undefined, null,
  // "abc") becomes 0 instead of NaN, so a bad value can never print as
  // "RNaN" or poison a total.
  function roundCurrency(value) {
    const n = Number(value);
    return Number.isFinite(n) ? round2(n) : 0;
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

  // Platform service fee for an order, by its pre-discount subtotal.
  function serviceFeeFor(subtotal) {
    const value = Number(subtotal);
    const amount = Number.isFinite(value) ? value : 0;
    return SERVICE_FEE_BANDS.find((band) => amount < band.upTo).fee;
  }

  function buildDeliveryQuote({ subtotal, distanceKm, priorityFee, now, surgesEnabled }) {
    const km = Number.isFinite(distanceKm) ? distanceKm : null;
    const surge = surgesEnabled === false ? { key: null, fee: 0 } : surgeWindow(now || new Date());
    const priority = PRIORITY_OPTIONS.includes(priorityFee) ? priorityFee : 0;
    const deliveryFee = distanceDeliveryFee(km);
    const serviceFee = serviceFeeFor(subtotal);
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

  // Base delivery fee, ignoring distance. Used by the cart for a rough
  // estimate only (delivery is never free); checkout shows the real quote.
  function deliveryFee() {
    return BASE_DELIVERY_FEE;
  }

  return {
    MIN_ORDER_SUBTOTAL,
    COOLER_ELIGIBLE,
    COOLER_MIN_SUBTOTAL,
    COOLER_DISCOUNT_PCT,
    COOLER_TOP_SUBTOTAL,
    COOLER_TOP_DISCOUNT_PCT,
    COOLER_CUTOFF_HOUR,
    coolerDiscountPct,
    coolerDiscountAvailable,
    SERVICE_FEE_BANDS,
    DELIVERY_FEE,
    deliveryFee,
    roundCurrency,
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
