// ═══════════════════════════════════════════════
// EKOYINI — Shelf order (founder, 9 Nov 2026)
// One sensible order for the shop, the admin stock list and /api/products:
// sections in a fixed order (beer → RTDs → spirits → wine → mixers & cold
// drinks → energy → water & ice), brands ALWAYS kept together (18 Nov 2026),
// packs in can → dumpy → NRB → quart → bottle order, sizes small to big, and
// a sold-out item last within its own brand.
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

  // Ice goes after all the water.
  function waterIceRank(p) {
    return p.category === 'ICE' ? 1 : 0;
  }

  // Brand key (founder, 18 Nov 2026: products of one brand always sit
  // together). "Banana Liqueur (Butlers)" belongs to Butlers; otherwise the
  // first word of the name ("Tsitsikamma Still Water", "Tsitsikamma
  // Sparkling Water" -> tsitsikamma).
  function brandOf(name) {
    const n = String(name || '').trim();
    const m = n.match(/\(([^)]+)\)\s*$/);
    return (m ? m[1] : n.split(/\s+/)[0]).toLowerCase();
  }

  // Size in ml for plain bottles ("500ml", "1L", "1.5L", "750ml Bottle"),
  // so a brand goes small to big.
  function sizeMl(fmt) {
    const m = String(fmt || '').match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
    if (!m) return 0;
    return parseFloat(m[1]) * (m[2].toLowerCase() === 'l' ? 1000 : 1);
  }

  const byText = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

  function shelfIndex(cat) {
    const i = SHELF_ORDER.indexOf(shelfOf(cat));
    return i === -1 ? SHELF_ORDER.length : i;
  }

  // Section, then brand (always together), then product name (numbers in
  // order: KWV 3, 5, 10, 12, 15), then pack (can, dumpy, NRB, quart), then
  // size small to big. A sold-out item drops to the end of its own brand.
  function compareShelf(a, b) {
    return (shelfIndex(a.category) - shelfIndex(b.category))
      || (mixerRank(a) - mixerRank(b))
      || (waterIceRank(a) - waterIceRank(b))
      || byText(brandOf(a.name), brandOf(b.name))
      || (((a.stock ?? 1) <= 0) - ((b.stock ?? 1) <= 0))
      || byText(a.name, b.name)
      || (packRank(a.bottleFormat) - packRank(b.bottleFormat))
      || (sizeMl(a.bottleFormat) - sizeMl(b.bottleFormat))
      || byText(a.bottleFormat, b.bottleFormat);
  }

  // Same order, but sold-out items are not moved to the end (admin stock list).
  function compareCatalogue(a, b) {
    return compareShelf({ ...a, stock: 1 }, { ...b, stock: 1 });
  }

  return { SHELF_ORDER, shelfOf, packRank, brandOf, sizeMl, compareShelf, compareCatalogue };
});
