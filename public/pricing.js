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
  // Every category counts toward the Cooler Box — per the actual product,
  // a real cooler box is a bottle (any spirit/wine/champagne) plus two or
  // three carry packs plus ice and mixers, not a fixed subset of "high
  // turnover" categories. Previously wine/champagne/cognac/brandy were
  // excluded on a slow-turnover assumption; that assumption was wrong for
  // how customers actually build a cooler box, so now everything counts.
  const COOLER_ELIGIBLE = new Set([
    'BEER', 'CIDER_RTD', 'BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA',
    'VODKA_PREMIUM', 'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'MIXER',
    'WINE', 'WINE_BOX', 'SPARKLING', 'CHAMPAGNE', 'WATER', 'ICE',
  ]);

  // Tiers start at R600 — below that, no discount at all (previously R300
  // was the entry tier; raised per a deliberate call to make the top
  // reward take more spend to reach).
  function coolerDiscountPct(coolerSubtotal) {
    if (coolerSubtotal >= 1500) return 0.15;
    if (coolerSubtotal >= 1000) return 0.10;
    if (coolerSubtotal >= 600) return 0.05;
    return 0;
  }

  return { COOLER_ELIGIBLE, coolerDiscountPct };
});
