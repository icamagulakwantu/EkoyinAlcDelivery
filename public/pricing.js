// ═══════════════════════════════════════════════
// EKOYINI — Shared pricing logic (Cooler Box + delivery fee)
// Single source of truth, loaded by both server.js (via require) and the
// browser (via <script src="pricing.js">). Previously this exact set +
// function was copy-pasted into server.js, shop.html, and checkout.html
// separately — any edit to the thresholds or eligible categories had to
// be made in three places by hand, with nothing to catch a missed one.
// The delivery fee lives here too now: it had drifted (R200 on the server
// and checkout, R1000 on the cart page), so customers saw one number and
// were charged another. R1000 is correct — that's the intended free-
// delivery threshold — so the server and checkout now match the cart
// instead of the other way around.
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
  // Below that, no discount. The old R600/R1000/R1500 tiers are gone.
  const COOLER_MIN_SUBTOTAL = 750;
  const COOLER_DISCOUNT_PCT = 0.05;

  function coolerDiscountPct(coolerSubtotal) {
    return coolerSubtotal >= COOLER_MIN_SUBTOTAL ? COOLER_DISCOUNT_PCT : 0;
  }

  // Delivery is free once the (pre-discount) subtotal is above this.
  // Change it here and the server, cart and checkout all follow.
  const FREE_DELIVERY_THRESHOLD = 1000;
  const DELIVERY_FEE = 50;

  function deliveryFee(subtotal) {
    return subtotal > FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  }

  // Orders below this (pre-discount) subtotal don't qualify for delivery.
  const MIN_ORDER_SUBTOTAL = 300;

  return {
    MIN_ORDER_SUBTOTAL,
    COOLER_ELIGIBLE,
    COOLER_MIN_SUBTOTAL,
    COOLER_DISCOUNT_PCT,
    coolerDiscountPct,
    FREE_DELIVERY_THRESHOLD,
    DELIVERY_FEE,
    deliveryFee,
  };
});
