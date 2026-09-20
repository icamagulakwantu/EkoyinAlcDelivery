// ═══════════════════════════════════════════════
// EKOYINI — Shared Cooler Box pricing logic
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
  // Categories the Cooler Box builder accepts — the target market's actual
  // buying pattern (dumpies, spirits, mixers, ice, water). Wine/champagne/
  // cognac/brandy stay purchasable in the regular grid but don't feed the
  // Cooler Box (slow-turnover, not what this feature is built for).
  const COOLER_ELIGIBLE = new Set([
    'BEER', 'CIDER_RTD', 'WHISKY', 'GIN', 'VODKA', 'VODKA_PREMIUM',
    'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'MIXER', 'WATER', 'ICE',
  ]);

  function coolerDiscountPct(coolerSubtotal) {
    if (coolerSubtotal >= 1000) return 0.15;
    if (coolerSubtotal >= 600) return 0.10;
    if (coolerSubtotal >= 300) return 0.05;
    return 0;
  }

  return { COOLER_ELIGIBLE, coolerDiscountPct };
});
