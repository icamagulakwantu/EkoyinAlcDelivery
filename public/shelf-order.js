// ═══════════════════════════════════════════════
// EKOYINI — Shelf order (founder, 9 Nov 2026)
// One sensible order for the shop, the admin stock list and /api/products:
// sections in a fixed order (beer → RTDs → spirits → wine → mixers & cold
// drinks → energy → water & ice), brands kept together, packs in
// can → dumpy → NRB → quart → bottle order, and in-stock before sold-out.
// Loaded by server.js (require) and the browser (<script src="shelf-order.js">).
// ═══════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EkoyiniShelf = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Water and ice share one section.
  const SHELF_ORDER = ['BEER', 'CIDER_RTD', 'BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA', 'VODKA_PREMIUM',
    'RUM', 'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'WINE', 'WINE_BOX', 'SPARKLING', 'CHAMPAGNE',
    'MIXER', 'ENERGY_DRINK', 'WATER_ICE'];

  function shelfOf(cat) { return cat === 'WATER' || cat === 'ICE' ? 'WATER_ICE' : cat; }

  const PACK_ORDER = ['Can', 'Dumpy', 'NRB', 'Quart'];
  function packRank(fmt) {
    const i = PACK_ORDER.findIndex((k) => String(fmt || '').startsWith(k));
    return i === -1 ? PACK_ORDER.length : i;
  }

  // Mixers: cold drinks first, then cordials, Monin syrups, then bar extras.
  function mixerRank(p) {
    if (p.category !== 'MIXER') return 0;
    if (/Cordial/i.test(p.name)) return 1;
    if (/^Monin/i.test(p.name)) return 2;
    if (/Bitters|Cherries/i.test(p.name)) return 3;
    return 0;
  }

  // Still water, then sparkling water, then ice.
  function waterIceRank(p) {
    if (p.category === 'ICE') return 2;
    if (p.category === 'WATER' && /Sparkling/i.test(p.name)) return 1;
    return 0;
  }

  function shelfIndex(cat) {
    const i = SHELF_ORDER.indexOf(shelfOf(cat));
    return i === -1 ? SHELF_ORDER.length : i;
  }

  function compareShelf(a, b) {
    return (shelfIndex(a.category) - shelfIndex(b.category))
      || (((a.stock ?? 1) <= 0) - ((b.stock ?? 1) <= 0))
      || (mixerRank(a) - mixerRank(b))
      || (waterIceRank(a) - waterIceRank(b))
      || String(a.name).localeCompare(String(b.name))
      || (packRank(a.bottleFormat) - packRank(b.bottleFormat))
      || String(a.bottleFormat).localeCompare(String(b.bottleFormat), undefined, { numeric: true });
  }

  // Same order, but sold-out items are not moved to the end (admin stock list).
  function compareCatalogue(a, b) {
    return compareShelf({ ...a, stock: 1 }, { ...b, stock: 1 });
  }

  return { SHELF_ORDER, shelfOf, packRank, compareShelf, compareCatalogue };
});
