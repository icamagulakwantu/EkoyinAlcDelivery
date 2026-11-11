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

  // Cooler Box discount (founder decision, 11 Nov 2026, later): a flat 2.5%
  // once the eligible subtotal reaches R2000 (was 2.5% / 3.5% from R4000,
  // before that 5% / 8%). One tier: the "top" tier equals the first.
  // Rule: a discount is never more than half of our markup (5% / 7%), and
  // it is the ONLY discount (the case discount was removed, 11 Nov 2026).
  // It is only available until 20:00 South African time and comes back at
  // 04:00, when the late-night window ends.
  const COOLER_MIN_SUBTOTAL = 2000;
  const COOLER_DISCOUNT_PCT = 0.025;
  const COOLER_TOP_SUBTOTAL = 2000; // single tier (equal to COOLER_MIN_SUBTOTAL)
  const COOLER_TOP_DISCOUNT_PCT = 0.025;
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
    if (coolerSubtotal >= COOLER_TOP_SUBTOTAL) return COOLER_TOP_DISCOUNT_PCT;
    return coolerSubtotal >= COOLER_MIN_SUBTOTAL ? COOLER_DISCOUNT_PCT : 0;
  }

  // Orders below this (pre-discount) subtotal don't qualify for delivery.
  const MIN_ORDER_SUBTOTAL = 300;

  // ── Delivery quote ─────────────────────────────────────────────
  // The delivery fee is built from these parts, all calculated on the server
  // at order time (the browser only previews them):
  //   1. Distance fee  — base R40 for the first 3 km, then R6 a km
  //                      (straight-line distance x ROUTING_BUFFER), like
  //                      Uber Eats / Mr D / Bolt Food: base + per km
  //   2. Load fee      — heavy orders: R1.50 a kg above 20 kg (cases of
  //                      quarts are hard work for the driver). Shown as part
  //                      of the delivery line. 100% to the driver.
  //   3. Surge fee     — time of day (South African time), 100% to the driver
  //   4. Priority fee  — optional "Super Priority" the customer adds
  //   5. Care & Handling fee — 3% of items, min R10, max R40
  //
  // There is no free delivery: every order pays the distance fee.

  // Care & Handling fee (formerly "service fee"), framed as customer
  // protection: order checks so the right products arrive sealed and correct.
  // Founder decision 10 Nov 2026: "let's not charge too much on care and
  // handling". Now 3% of the items, at least R10 and never more than R40
  // (was 5%, R15–R75). Heavy orders pay for the driver's work through the
  // load fee instead. One rate, no jumps between bands.
  const CARE_FEE_PCT = 0.03;
  const CARE_FEE_MIN = 10;
  const CARE_FEE_MAX = 40;
  // Kept for any older code that still reads the band list.
  const CARE_FEE_BANDS = [{ upTo: Infinity, pct: CARE_FEE_PCT, min: CARE_FEE_MIN, max: CARE_FEE_MAX }];
  const SERVICE_FEE_BANDS = CARE_FEE_BANDS;

  // Straight-line distance is multiplied by this to account for real roads.
  const ROUTING_BUFFER = 1.2;

  // Distance (founder, 10 Nov 2026: "use similar delivery apps metrics"):
  // a base fee that covers the first few km, then a per-km rate. No jumps.
  const BASE_DELIVERY_FEE = 40; // covers the first BASE_DELIVERY_KM (also the floor)
  const BASE_DELIVERY_KM = 3;
  const PER_KM_FEE = 6; // per km beyond BASE_DELIVERY_KM
  const DELIVERY_FEE = BASE_DELIVERY_FEE; // kept for older callers

  // Load (founder, 10 Nov 2026): "those were cases 750ml of beer which is
  // heavy load for the driver". A normal cooler box (a few six-packs, a
  // bottle, mixers, ice) is under 20 kg and pays nothing extra.
  const LOAD_FREE_KG = 20;
  const LOAD_FEE_PER_KG = 1.5;

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
    if (distanceKm == null || !(distanceKm > BASE_DELIVERY_KM)) return BASE_DELIVERY_FEE;
    return round2(BASE_DELIVERY_FEE + PER_KM_FEE * (distanceKm - BASE_DELIVERY_KM));
  }

  // ── Load (weight) ──────────────────────────────────────────────
  // Rough shipping weight of one shop item (a single bottle, or a whole
  // six-pack when packSize is 6), worked out from its pack label:
  // liquid ~1 kg a litre, glass ~0.5 kg per 750 ml, a can ~15 g.
  function packVolumeLitres(bottleFormat) {
    const f = String(bottleFormat || '');
    const kg = f.match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (kg) return { kg: Number(kg[1]) };
    const ml = f.match(/(\d+(?:\.\d+)?)\s*ml/i);
    if (ml) return { litres: Number(ml[1]) / 1000 };
    const l = f.match(/(\d+(?:\.\d+)?)\s*(?:L\b|Litre|Liter)/i);
    if (l) return { litres: Number(l[1]) };
    return { litres: 0.75 };
  }
  function itemWeightKg(bottleFormat, packSize, category) {
    const size = Number.isInteger(packSize) && packSize > 0 ? packSize : 1;
    const f = String(bottleFormat || '');
    const v = packVolumeLitres(f);
    if (v.kg != null) return round2(v.kg * size); // ice
    const cat = String(category || '').toUpperCase();
    let container;
    if (/^Can/i.test(f)) container = 0.015;
    else if (/Box|Co-Pack/i.test(f)) container = 0.15;
    else if ((cat === 'WATER' || cat === 'MIXER' || cat === 'ENERGY_DRINK') && !/Bottle|Jar|Jug/i.test(f)) container = 0.04; // plastic
    else container = 0.5 * (v.litres / 0.75); // glass
    return round2((v.litres + container) * size);
  }
  // items: [{ bottleFormat, packSize, category, quantity }]
  function orderWeightKg(items) {
    return round2((items || []).reduce((sum, it) => sum + itemWeightKg(it.bottleFormat, it.packSize, it.category) * (Number(it.quantity) || 0), 0));
  }
  function loadFeeFor(weightKg) {
    const kg = Number(weightKg);
    if (!Number.isFinite(kg) || kg <= LOAD_FREE_KG) return 0;
    // Whole rands, so a few grams over never shows as "R0.38".
    return Math.round((kg - LOAD_FREE_KG) * LOAD_FEE_PER_KG);
  }

  // Which surge window (if any) is active at this moment, on SA time.
  function surgeWindow(now) {
    const saHour = saHourOf(now);
    if (saHour >= LATE_NIGHT_START_HOUR || saHour < LATE_NIGHT_END_HOUR) {
      return { key: 'LATE_NIGHT', fee: LATE_NIGHT_SURGE_FEE };
    }
    if (saHour >= PEAK_START_HOUR) return { key: 'PEAK', fee: PEAK_SURGE_FEE };
    return { key: null, fee: 0 };
  }

  // Care & Handling fee for an order, by its pre-discount subtotal.
  // Returns a rand amount (percentage of subtotal, rounded to cents).
  function careFeeFor(subtotal) {
    const value = Number(subtotal);
    const amount = Number.isFinite(value) ? value : 0;
    if (amount <= 0) return 0;
    return round2(Math.min(CARE_FEE_MAX, Math.max(CARE_FEE_MIN, amount * CARE_FEE_PCT)));
  }
  // Alias so existing callers keep working during the rename.
  function serviceFeeFor(subtotal) {
    return careFeeFor(subtotal);
  }

  function buildDeliveryQuote({ subtotal, distanceKm, priorityFee, now, surgesEnabled, weightKg }) {
    const km = Number.isFinite(distanceKm) ? distanceKm : null;
    const surge = surgesEnabled === false ? { key: null, fee: 0 } : surgeWindow(now || new Date());
    const priority = PRIORITY_OPTIONS.includes(priorityFee) ? priorityFee : 0;
    const distanceFee = distanceDeliveryFee(km);
    const kg = Number.isFinite(Number(weightKg)) ? round2(Number(weightKg)) : 0;
    const loadFee = loadFeeFor(kg);
    // The load fee rides inside deliveryFee (one "Delivery" line, saved in
    // Order.deliveryFee, 100% to the driver); the parts are returned too so
    // pages can explain it.
    const deliveryFee = round2(distanceFee + loadFee);
    const careFee = careFeeFor(subtotal);
    return {
      distanceKm: km,
      distanceFee,
      weightKg: kg,
      loadFee,
      deliveryFee,
      surgeKey: surge.key,
      surgeFee: surge.fee,
      priorityFee: priority,
      serviceFee: careFee,   // legacy key
      careFee,               // preferred key
      total: round2(deliveryFee + surge.fee + priority + careFee),
    };
  }

  // ── Safety Seal (optional add-on, spirits only) ─────────────────
  // One set of tamper-evident stickers per order. Only offered (and only
  // ever charged) when the order contains at least one spirit.
  const SAFETY_SEAL_FEE = 10;
  const SPIRIT_CATEGORIES = new Set([
    'BRANDY', 'WHISKY', 'COGNAC', 'GIN', 'VODKA', 'VODKA_PREMIUM',
    'TEQUILA', 'TEQUILA_PREMIUM', 'LIQUEUR', 'RUM',
  ]);
  function hasSpirits(categories) {
    return Array.from(categories || []).some((c) => SPIRIT_CATEGORIES.has(String(c || '').toUpperCase()));
  }
  function safetySealFeeFor(wanted, categories) {
    return wanted === true && hasSpirits(categories) ? SAFETY_SEAL_FEE : 0;
  }

  // ── Returnable bottles & crates (founder, 10 Nov 2026) ───────────
  // SAB-style returnable quarts carry a bottle deposit. The ride-along
  // driver makes a single trip and cannot take empties back, so every
  // returnable quart is charged: R2 a bottle + R28 a crate per full crate of
  // 12 ("In a crate", R52), or R3 a bottle loose ("No crate", and for the
  // bottles that don't fill a crate). Cans, dumpies, NRBs and spirits are
  // non-returnable and never charged. Amstel, Corona, Heineken, Sol, Stella
  // and Hunter's quarts are not returnable here (founder).
  const RETURNABLE_QUART_BRANDS = /^(Carling Black Label|Castle Lager|Castle Lite|Castle Milk Stout|Hansa Pilsener|Lion Lager|Windhoek|Flying Fish|Redd's|Strongbow)/;
  const CRATE_SIZE = 12;
  const BOTTLE_DEPOSIT_IN_CRATE = 2;
  const CRATE_FEE = 28;
  const BOTTLE_DEPOSIT_LOOSE = 3;
  function isReturnableQuart(name, bottleFormat) {
    return /^Quart/i.test(String(bottleFormat || '')) && RETURNABLE_QUART_BRANDS.test(String(name || ''));
  }
  // bottles: number of returnable quarts; crate: true = deliver full dozens in crates.
  function bottleDepositFor(bottles, crate) {
    const n = Math.max(0, Math.floor(Number(bottles) || 0));
    if (n === 0) return { bottles: 0, crates: 0, loose: 0, fee: 0 };
    const crates = crate === false ? 0 : Math.floor(n / CRATE_SIZE);
    const loose = n - crates * CRATE_SIZE;
    const fee = round2(crates * (CRATE_SIZE * BOTTLE_DEPOSIT_IN_CRATE + CRATE_FEE) + loose * BOTTLE_DEPOSIT_LOOSE);
    return { bottles: n, crates, loose, fee };
  }

  // ── One order total, used by the cart, checkout and server ─────────
  // lines: [{ category, total }] (line totals already priced).
  // promoPct: 0-100. deliveryTotal: the whole delivery quote total
  // (delivery + surge + priority + care fee). Order of operations:
  //   subtotal -> minus Cooler Box -> minus promo (on what is left)
  //   -> plus delivery quote -> plus Safety Seal -> plus bottles & crates.
  // bottleDeposit: rand amount from bottleDepositFor() (never discounted).
  function priceOrder({ lines, promoPct, deliveryTotal, safetySeal, now, bottleDeposit }) {
    let subtotal = 0;
    let coolerSubtotal = 0;
    const categories = [];
    (lines || []).forEach((l) => {
      const t = Number(l.total) || 0;
      subtotal += t;
      if (COOLER_ELIGIBLE.has(l.category)) coolerSubtotal += t;
      categories.push(l.category);
    });
    subtotal = round2(subtotal);
    coolerSubtotal = round2(coolerSubtotal);
    const coolerPct = coolerDiscountPct(coolerSubtotal, now);
    const coolerDiscount = round2(coolerSubtotal * coolerPct);
    const pct = Number(promoPct) > 0 ? Number(promoPct) : 0;
    const promoDiscount = round2((subtotal - coolerDiscount) * (pct / 100));
    const delivery = roundCurrency(deliveryTotal);
    const safetySealFee = safetySealFeeFor(safetySeal, categories);
    const bottleDepositFee = roundCurrency(bottleDeposit);
    const total = round2(subtotal - coolerDiscount - promoDiscount + delivery + safetySealFee + bottleDepositFee);
    return { subtotal, coolerSubtotal, coolerPct, coolerDiscount, promoDiscount, delivery, safetySealFee, bottleDepositFee, total };
  }

  // What the shopper still needs for the next Cooler Box tier, for nudges.
  // Returns null when the top tier is already reached or the window is shut.
  function coolerNudge(coolerSubtotal, now) {
    if (!coolerDiscountAvailable(now)) return null;
    if (coolerSubtotal < COOLER_MIN_SUBTOTAL) {
      return { needed: round2(COOLER_MIN_SUBTOTAL - coolerSubtotal), pct: COOLER_DISCOUNT_PCT, progress: coolerSubtotal / COOLER_MIN_SUBTOTAL };
    }
    if (coolerSubtotal < COOLER_TOP_SUBTOTAL) {
      return { needed: round2(COOLER_TOP_SUBTOTAL - coolerSubtotal), pct: COOLER_TOP_DISCOUNT_PCT, progress: coolerSubtotal / COOLER_TOP_SUBTOTAL, current: COOLER_DISCOUNT_PCT };
    }
    return null;
  }

  // Base delivery fee, ignoring distance. Used by the cart for a rough
  // estimate only (delivery is never free); checkout shows the real quote.
  function deliveryFee() {
    return BASE_DELIVERY_FEE;
  }

  // ── No GPS pin (founder, 11 Nov 2026) ──────────────────────────
  // A customer who can't or won't share their location can still order:
  // they pay the base delivery fee and must give a landmark so the driver
  // can find them; the dispatcher confirms the distance by phone.
  // Returns an error message, or null when the order may go ahead.
  const MIN_LANDMARK_LENGTH = 3;
  function noPinProblem({ needsPin, hasPin, landmark }) {
    if (!needsPin || hasPin) return null;
    if (String(landmark || '').trim().length >= MIN_LANDMARK_LENGTH) return null;
    return 'Pin your location, or add a landmark so the driver can find you';
  }

  // 0.025 -> "2.5%", 0.035 -> "3.5%", 0.05 -> "5%" (no float noise).
  function pctLabel(fraction) {
    const n = Math.round(Number(fraction || 0) * 1000) / 10;
    return `${n}%`;
  }

  return {
    pctLabel,
    MIN_LANDMARK_LENGTH,
    noPinProblem,
    MIN_ORDER_SUBTOTAL,
    COOLER_ELIGIBLE,
    COOLER_MIN_SUBTOTAL,
    COOLER_DISCOUNT_PCT,
    COOLER_TOP_SUBTOTAL,
    COOLER_TOP_DISCOUNT_PCT,
    CRATE_SIZE,
    BOTTLE_DEPOSIT_IN_CRATE,
    CRATE_FEE,
    BOTTLE_DEPOSIT_LOOSE,
    isReturnableQuart,
    bottleDepositFor,
    LOAD_FREE_KG,
    LOAD_FEE_PER_KG,
    BASE_DELIVERY_KM,
    PER_KM_FEE,
    itemWeightKg,
    orderWeightKg,
    loadFeeFor,
    COOLER_CUTOFF_HOUR,
    coolerDiscountPct,
    coolerDiscountAvailable,
    CARE_FEE_BANDS,
    CARE_FEE_PCT,
    CARE_FEE_MIN,
    CARE_FEE_MAX,
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
    careFeeFor,
    serviceFeeFor,
    buildDeliveryQuote,
    SAFETY_SEAL_FEE,
    SPIRIT_CATEGORIES,
    hasSpirits,
    safetySealFeeFor,
    priceOrder,
    coolerNudge,
    BASE_DELIVERY_FEE,
  };
});
