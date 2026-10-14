require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
// Render terminates TLS in front of this app and forwards X-Forwarded-Proto
// — without trusting the proxy, req.protocol always reports "http", which
// would build broken (non-https) Yoco redirect URLs. It's also required
// for express-rate-limit to read the real client IP instead of Render's.
app.set("trust proxy", true);

// ── Rate limiting ───────────────────────────────────────────────────────────────
// Order codes unlock public tracking (including a driver's live location),
// promo codes are a 6-10 char guessable string, and order creation is the
// one place a bot could hammer stock/promo usage — all three need a cap
// per IP. Keyed on req.ip (trust proxy above makes that the real client IP
// behind Render, not Render's own).
//
// writeLimiter: order creation / checkout-session start. Generous enough
// for a real customer retrying a failed card, tight enough to stop a script.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a few minutes and try again" },
});
// trackLimiter: public order-code lookups. track.html polls every 30s per
// order, so this needs headroom for a customer with a couple of tabs open,
// while still blocking a script that enumerates codes.
const trackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookups — please wait a few minutes and try again" },
});
// promoLimiter: promo code guessing is the cheapest brute-force target on
// the whole site (short, human-readable codes) — keep this the tightest.
const promoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many promo code attempts — please wait a few minutes and try again" },
});
// locationLimiter: driver-track.html posts a location roughly every 10s —
// generous ceiling that still blocks abuse of the token-authorized endpoint.
const locationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many location updates — please wait a moment" },
});

const {
  createYocoCheckout,
  getYocoCheckout,
  checkoutLooksPaid,
  extractPaidAmountCents,
  extractCurrency,
  verifyYocoWebhookSignature,
  extractCheckoutId,
  isYocoConfigured,
} = require("./payments.js");
const { sendOrderConfirmationEmail, sendAdminOrderAlertEmail, sendPaymentFailureAlertEmail, sendPaymentConfirmedEmail } = require("./emails.js");

app.use(express.static("public"));
app.use("/admin", express.static("admin"));
// The verify callback stashes the raw bytes alongside normal JSON parsing —
// needed for the Yoco webhook route, which must HMAC-verify against the
// exact raw body, not a re-serialized version of the parsed object.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// ── Supabase Auth (customer login) ───────────────────────────────────────
// Verifies the bearer token against Supabase's own /auth/v1/user endpoint —
// no Supabase Admin SDK needed server-side, just the anon key.
async function verifySupabaseToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;

  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch (err) {
    console.error("Supabase token verification failed:", err);
    return null;
  }
}

async function requireUser(req, res, next) {
  const user = await verifySupabaseToken(req);
  if (!user) return res.status(401).json({ error: "Please log in to continue" });
  req.user = user;
  next();
}

// ── Admin auth ──────────────────────────────────────────────────────────────────
// A logged-in Supabase user whose email is in the ADMIN_EMAILS allowlist
// is always a SUPER_ADMIN (root bootstrap). The AdminUser table holds
// delegated admins with a role (SUPER_ADMIN or DISPATCHER). The shared
// ADMIN_API_TOKEN header still works for scripts/curl.
function isAdminEmail(email) {
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowlist.includes(email.toLowerCase());
}

async function resolveAdminRole(email) {
  if (isAdminEmail(email)) return "SUPER_ADMIN";
  const record = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  return record ? record.role : null;
}

async function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (process.env.ADMIN_API_TOKEN && token === process.env.ADMIN_API_TOKEN) {
    req.adminRole = "SUPER_ADMIN";
    return next();
  }

  const user = await verifySupabaseToken(req);
  const role = user ? await resolveAdminRole(user.email) : null;
  if (user && role) {
    req.user = user;
    req.adminRole = role;
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

function requireSuperAdmin(req, res, next) {
  if (req.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "This action requires a super-admin account" });
  }
  next();
}

// Record of who did what. Never blocks or fails the actual admin action.
async function logAdminAction(req, action, targetId, detail) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminEmail: req.user?.email || "api-token",
        action,
        targetId: targetId || null,
        detail: detail || null,
      },
    });
  } catch (err) {
    console.error("Failed to write admin audit log:", err);
  }
}

// ── Pricing — shared with the browser via public/pricing.js, so the cart,
// checkout and server can never disagree on discounts or the delivery fee.
const { COOLER_ELIGIBLE, coolerDiscountPct, MIN_ORDER_SUBTOTAL } = require("./public/pricing.js");
const { createQuoter } = require("./lib/delivery-quote.js");

// Works out the distance, surge, priority and service fees for an order.
const quoteDelivery = createQuoter(prisma);

// Shared total calculation (subtotal → minus Cooler Box and promo → plus the
// whole delivery quote: delivery + surge + priority + service fee).
function computeOrderTotal(subtotal, coolerDiscount, promoDiscount, deliveryTotal) {
  return Math.round((subtotal - coolerDiscount - promoDiscount + deliveryTotal) * 100) / 100;
}

function computePromoDiscount(subtotal, coolerDiscount, promo) {
  if (!promo) return 0;
  return Math.round((subtotal - coolerDiscount) * (promo.discountPct / 100) * 100) / 100;
}

// ── Delivery pin + landmark (all optional) ─────────────────────────
// The customer can drop a GPS pin at checkout and/or describe a landmark.
// Anything invalid is simply dropped (never blocks the order) — a pin
// outside South Africa's rough bounding box is almost certainly a desktop
// browser's IP-based guess, not where the customer actually is.
const SA_BOUNDS = { minLat: -35.5, maxLat: -21.5, minLng: 16, maxLng: 33.5 };

function parseDeliveryLocation({ landmark, deliveryLat, deliveryLng }) {
  const cleanLandmark = typeof landmark === "string" ? landmark.trim().slice(0, 200) || null : null;
  const lat = parseFloat(deliveryLat);
  const lng = parseFloat(deliveryLng);
  const pinOk = Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= SA_BOUNDS.minLat && lat <= SA_BOUNDS.maxLat
    && lng >= SA_BOUNDS.minLng && lng <= SA_BOUNDS.maxLng;
  return {
    landmark: cleanLandmark,
    deliveryLat: pinOk ? Math.round(lat * 1e6) / 1e6 : null,
    deliveryLng: pinOk ? Math.round(lng * 1e6) / 1e6 : null,
  };
}

// 🩺 HEALTH — DB connectivity check, hit this first when debugging
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Database unreachable" });
  }
});

// Only customer-facing fields. The supplier price sheet columns
// (listPriceZAR, supplierCase*/supplierPallet*, palletPackQty,
// supplierPortfolio) are cost data and must never leave the server —
// before this, anyone could read Ekoyini's margins from the browser.
const PUBLIC_PRODUCT_FIELDS = {
  id: true,
  name: true,
  category: true,
  productType: true,
  bottleFormat: true,
  unitsPerCase: true,
  packSize: true,
  retailSingleZAR: true,
  retailCaseDiscountPct: true,
  retailCaseZAR: true,
  imageUrl: true,
  brandTags: true,
  stock: true,
};

// 🛒 CATALOG
app.get("/api/products", async (req, res) => {
  try {
    const { category } = req.query;
    const products = await prisma.skuItem.findMany({
      where: category ? { category } : undefined,
      select: PUBLIC_PRODUCT_FIELDS,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// 🏪 TAVERNS — public store list for the homepage. Never the phone number.
app.get("/api/taverns", async (req, res) => {
  try {
    const taverns = await prisma.tavern.findMany({
      select: { id: true, name: true, area: true },
      orderBy: { name: "asc" },
    });
    res.json(taverns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stores" });
  }
});

// 📊 STATS — real, computed trust-signal numbers for the homepage.
app.get("/api/stats", async (req, res) => {
  try {
    const [products, taverns, areas] = await Promise.all([
      prisma.skuItem.count(),
      prisma.tavern.count(),
      prisma.tavern.findMany({ distinct: ["area"], select: { area: true } }),
    ]);
    res.json({ products, taverns, areas: areas.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// 🏪 ADMIN: full tavern records (includes phone)
app.get("/admin/taverns", requireAdmin, async (req, res) => {
  const taverns = await prisma.tavern.findMany({ orderBy: { name: "asc" } });
  res.json(taverns);
});

// 🖼️ ADMIN: one-off image enrichment job (Open Food Facts, no API key).
let enrichStatus = { running: false, checked: 0, updated: 0, total: 0 };

app.post("/admin/enrich-images", requireAdmin, async (req, res) => {
  if (enrichStatus.running) {
    return res.status(409).json({ error: "Enrichment already running", status: enrichStatus });
  }

  const skus = await prisma.skuItem.findMany();
  const names = [...new Set(skus.map((s) => s.name))];
  enrichStatus = { running: true, checked: 0, updated: 0, total: names.length };
  res.json({ message: `Started — enriching ${names.length} distinct product names.`, status: enrichStatus });

  (async () => {
    for (const name of names) {
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          name
        )}&search_simple=1&action=process&json=1&page_size=1`;
        const r = await fetch(url);
        const data = await r.json();
        const product = data.products?.[0];
        const image = product?.image_front_url || product?.image_url;
        if (image) {
          await prisma.skuItem.updateMany({ where: { name }, data: { imageUrl: image } });
          enrichStatus.updated++;
          console.log(`[enrich] ✓ ${name}`);
        } else {
          console.log(`[enrich] — no match for ${name}`);
        }
      } catch (err) {
        console.error(`[enrich] error for ${name}:`, err.message);
      }
      enrichStatus.checked++;
      await new Promise((r) => setTimeout(r, 300));
    }
    enrichStatus.running = false;
    console.log(`[enrich] Done — updated ${enrichStatus.updated}/${names.length} distinct product names.`);
  })();
});

app.get("/admin/enrich-images/status", requireAdmin, (req, res) => {
  res.json(enrichStatus);
});

// 🏷️ PROMO CODES — shared validation. subtotal here is pre-delivery, pre-discount.
async function checkPromoCode(code, subtotal) {
  if (!code) return { promo: null };
  const promo = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo || !promo.active) return { error: "Promo code not found" };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { error: "This promo code has expired" };
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { error: "This promo code has reached its usage limit" };
  }
  if (promo.minSubtotal != null && subtotal < promo.minSubtotal) {
    return { error: `Add R${(promo.minSubtotal - subtotal).toFixed(2)} more to use this code` };
  }
  return { promo };
}

// Public preview — validates a code against a subtotal without redeeming it.
app.post("/api/promo/validate", promoLimiter, async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const parsedSubtotal = parseFloat(subtotal);
    if (!code || !Number.isFinite(parsedSubtotal)) {
      return res.status(400).json({ valid: false, error: "code and subtotal are required" });
    }
    const { promo, error } = await checkPromoCode(code, parsedSubtotal);
    if (error) return res.json({ valid: false, error });
    res.json({ valid: true, code: promo.code, discountPct: promo.discountPct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, error: "Failed to validate promo code" });
  }
});

// ── Cash-on-delivery eligibility ──────────────────────────────────────
// Enforced server-side:
//   1. Track record — a minimum number of orders actually DELIVERED to
//      this account (and optionally a minimum account age). The old rule
//      (3+ months AND 30+ orders) meant no customer could use COD for the
//      first months after launch. Delivered orders are a much better trust
//      signal than placed orders, so the bar can be far lower.
//      Both thresholds can be tuned on Render without a code change:
//        COD_MIN_DELIVERED_ORDERS (default 2)
//        COD_MIN_ACCOUNT_AGE_MONTHS (default 0)
//   2. This order's amount — must clear R300 and is always capped at
//      R1500 so a driver is never holding more cash than that.
//   3. Pattern deviation — flagged (not blocked) for the admin to glance
//      at before dispatch.
function intFromEnv(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

const COD_MIN_ACCOUNT_AGE_MONTHS = intFromEnv("COD_MIN_ACCOUNT_AGE_MONTHS", 0);
const COD_MIN_DELIVERED_ORDERS = intFromEnv("COD_MIN_DELIVERED_ORDERS", 2);
const COD_MIN_ORDER_TOTAL = 300;
const COD_MAX_ORDER_TOTAL = 1500;

function monthsSince(dateStr) {
  const then = new Date(dateStr);
  if (isNaN(then.getTime())) return 0;
  const now = new Date();
  let months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (now.getDate() < then.getDate()) months -= 1;
  return Math.max(0, months);
}

// Orders placed but never confirmed (stuck at PAYMENT_PENDING) don't count.
async function countConfirmedOrders(userId) {
  return prisma.order.count({ where: { userId, status: { not: "PAYMENT_PENDING" } } });
}

async function countDeliveredOrders(userId) {
  return prisma.order.count({ where: { userId, status: "DELIVERED" } });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function codTrackRecordMessage(accountAgeMonths, deliveredOrderCount) {
  const needs = [`${plural(COD_MIN_DELIVERED_ORDERS, "delivered order")}`];
  if (COD_MIN_ACCOUNT_AGE_MONTHS > 0) needs.unshift(`an account ${COD_MIN_ACCOUNT_AGE_MONTHS}+ months old`);
  const have = [`${plural(deliveredOrderCount, "delivered order")}`];
  if (COD_MIN_ACCOUNT_AGE_MONTHS > 0) have.unshift(plural(accountAgeMonths, "month"));
  return `Cash on delivery unlocks after ${needs.join(" and ")} (you're at ${have.join(", ")}). Please pay by card or EFT for now.`;
}

async function assessCodEligibility({ userId, userCreatedAt, orderTotal, skuIds }) {
  if (orderTotal > COD_MAX_ORDER_TOTAL) {
    return {
      eligible: false,
      error: `Cash on delivery isn't available for orders over R${COD_MAX_ORDER_TOTAL} — for our drivers' safety. Please pay by card or EFT, or reduce your order.`,
    };
  }
  if (orderTotal <= COD_MIN_ORDER_TOTAL) {
    return { eligible: false, error: `Cash on delivery requires an order over R${COD_MIN_ORDER_TOTAL}.` };
  }

  const accountAgeMonths = monthsSince(userCreatedAt);
  const [deliveredOrderCount, priorOrderCount] = await Promise.all([
    countDeliveredOrders(userId),
    countConfirmedOrders(userId),
  ]);

  if (accountAgeMonths < COD_MIN_ACCOUNT_AGE_MONTHS || deliveredOrderCount < COD_MIN_DELIVERED_ORDERS) {
    return { eligible: false, error: codTrackRecordMessage(accountAgeMonths, deliveredOrderCount) };
  }

  // Pattern check — only meaningful once there's real history to compare.
  let flagged = false;
  let flagReason = null;
  if (priorOrderCount >= 5 && skuIds.length > 0) {
    const [priorOrders, priorLineItems] = await Promise.all([
      prisma.order.findMany({ where: { userId, status: { not: "PAYMENT_PENDING" } }, select: { total: true } }),
      prisma.orderItem.findMany({
        where: { order: { userId, status: { not: "PAYMENT_PENDING" } } },
        select: { skuId: true },
        distinct: ["skuId"],
      }),
    ]);
    const avgTotal = priorOrders.reduce((sum, o) => sum + o.total, 0) / priorOrders.length;
    const familiarSkuIds = new Set(priorLineItems.map((i) => i.skuId).filter(Boolean));
    const newSkuCount = skuIds.filter((id) => !familiarSkuIds.has(id)).length;
    const mostlyUnfamiliar = newSkuCount / skuIds.length >= 0.5;
    const isSpike = orderTotal > Math.max(avgTotal * 3, 800);
    if (isSpike && mostlyUnfamiliar) {
      flagged = true;
      flagReason = `R${orderTotal.toFixed(0)} order is a sharp jump from this customer's usual ~R${avgTotal.toFixed(0)} average, mostly in products they haven't bought before — worth a quick check before dispatch.`;
    }
  }

  return { eligible: true, flagged, flagReason };
}

// Mirrors the total calc inside createOrderTransaction without writing
// anything — needed to check a COD order's amount before it's created.
async function estimateOrderTotal({ subtotal, coolerDiscount, quote }, promoCode) {
  let promo = null;
  if (promoCode) {
    const result = await checkPromoCode(promoCode, subtotal - coolerDiscount);
    promo = result.promo || null;
  }
  return computeOrderTotal(subtotal, coolerDiscount, computePromoDiscount(subtotal, coolerDiscount, promo), quote.total);
}

// ── Order pricing + validation — shared by COD/EFT and the card path.
// Pure computation only; no DB writes.
// `location` and `priorityFee` feed the delivery quote (distance, surge,
// priority, service fee), which is always calculated here on the server.
async function validateAndPriceOrder({ address, items, customerPhone, paymentMethod, allowedPaymentMethods, location, priorityFee }) {
  if (!address || typeof address !== "string" || address.trim().length < 5) {
    return { error: "Please enter a valid delivery address" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "items are required" };
  }
  const digitsOnly = (customerPhone || "").replace(/\D/g, "");
  if (digitsOnly.length < 9 || digitsOnly.length > 12) {
    return { error: "Please enter a valid phone number" };
  }
  if (paymentMethod && !allowedPaymentMethods.has(paymentMethod)) {
    return { error: "Invalid payment method" };
  }

  const skuIds = items.map((i) => i.skuId).filter(Boolean);
  const skus = await prisma.skuItem.findMany({ where: { id: { in: skuIds } } });
  const skuMap = new Map(skus.map((s) => [s.id, s]));

  let subtotal = 0;
  let coolerSubtotal = 0;
  const orderItems = [];
  const stockNeeded = []; // units are individual bottles (six-packs for dumpies/cans), not cases

  for (const i of items) {
    const sku = skuMap.get(i.skuId);
    const rawQuantity = parseInt(i.quantity, 10);
    if (!sku || !Number.isInteger(rawQuantity) || rawQuantity <= 0) {
      return { error: `Invalid item: ${i.skuId}` };
    }
    // Case mode is bought in whole cases — round up server-side too.
    const quantity = i.purchaseType === "case"
      ? Math.ceil(rawQuantity / sku.unitsPerCase) * sku.unitsPerCase
      : rawQuantity;
    const unitPrice = i.purchaseType === "case" ? sku.retailCaseZAR / sku.unitsPerCase : sku.retailSingleZAR;
    // Products added with a photo but no price yet carry a price of 0 —
    // they're shown as "Price coming soon" and must never be orderable.
    if (!(unitPrice > 0)) {
      return { error: `${sku.name} isn't priced yet and can't be ordered — please remove it from your cart` };
    }
    const itemTotal = unitPrice * quantity;
    subtotal += itemTotal;
    if (COOLER_ELIGIBLE.has(sku.category)) coolerSubtotal += itemTotal;

    orderItems.push({ skuId: sku.id, name: sku.name, price: unitPrice, quantity });
    stockNeeded.push({ skuId: sku.id, name: sku.name, units: quantity });
  }

  // Orders below the minimum don't qualify for delivery. Compared on the
  // pre-discount subtotal, same as the cart and checkout pages.
  if (subtotal < MIN_ORDER_SUBTOTAL) {
    return { error: `Orders under R${MIN_ORDER_SUBTOTAL} don't qualify for delivery — please add R${(MIN_ORDER_SUBTOTAL - subtotal).toFixed(2)} more to your cart` };
  }

  // Delivery quote: distance from the nearest tavern with a saved location,
  // plus surge, priority and service fees.
  const pin = parseDeliveryLocation(location || {});
  const delivery = await quoteDelivery({
    subtotal,
    deliveryLat: pin.deliveryLat,
    deliveryLng: pin.deliveryLng,
    priorityFee,
  });
  if (delivery.error) return { error: delivery.error };
  if (delivery.needsPin) {
    return { error: "Please pin your delivery location so we can work out your delivery fee" };
  }

  const coolerDiscount = coolerSubtotal * coolerDiscountPct(coolerSubtotal);
  return { orderItems, stockNeeded, subtotal, coolerDiscount, quote: delivery.quote };
}

// Atomic write: stock decrement, promo redemption, and the Order row.
// Order codes authorize public tracking (and, via driverShareToken, a
// driver's live location) — the old `Math.random().toString(36).slice(2,8)`
// gave ~36 bits of entropy with no collision check and a predictable
// alphabet. This uses crypto.randomBytes for a cryptographically random
// 8-char code (~41 bits per char over a 32-symbol alphabet, no ambiguous
// 0/O/1/I), and retries on the rare unique-constraint collision instead of
// assuming one can never happen.
const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
function generateOrderCode() {
  const bytes = crypto.randomBytes(8);
  let code = "EKO-";
  for (let i = 0; i < 8; i++) {
    code += ORDER_CODE_ALPHABET[bytes[i] % ORDER_CODE_ALPHABET.length];
  }
  return code;
}

async function createOrderTransaction({ userId, address, customerName, customerPhone, customerEmail, paymentMethod, promoCode, status, priced, codFlagged, codFlagReason, location }) {
  const { orderItems, stockNeeded, subtotal, coolerDiscount, quote } = priced;
  const { landmark, deliveryLat, deliveryLng } = parseDeliveryLocation(location || {});

  let promo = null;
  if (promoCode) {
    const result = await checkPromoCode(promoCode, subtotal - coolerDiscount);
    if (result.error) {
      const err = new Error("PROMO_INVALID");
      err.detail = result.error;
      throw err;
    }
    promo = result.promo;
  }
  const promoDiscount = computePromoDiscount(subtotal, coolerDiscount, promo);
  const total = computeOrderTotal(subtotal, coolerDiscount, promoDiscount, quote.total);

  return prisma.$transaction(async (tx) => {
    for (const need of stockNeeded) {
      const { count } = await tx.skuItem.updateMany({
        where: { id: need.skuId, stock: { gte: need.units } },
        data: { stock: { decrement: need.units } },
      });
      if (count === 0) {
        const err = new Error("OUT_OF_STOCK");
        err.productName = need.name;
        throw err;
      }
    }
    if (promo) {
      const { count } = await tx.promoCode.updateMany({
        where: {
          id: promo.id,
          OR: [{ maxUses: null }, { usedCount: { lt: promo.maxUses } }],
        },
        data: { usedCount: { increment: 1 } },
      });
      if (count === 0) throw new Error("PROMO_RACE_LOST");
    }

    // Collision odds are astronomically low (32^8 space), but retry a few
    // times on the unique-constraint error rather than assuming it's
    // impossible — cheaper than being wrong.
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await tx.order.create({
          data: {
            code: generateOrderCode(),
            userId,
            address,
            landmark,
            deliveryLat,
            deliveryLng,
            customerName,
            customerPhone,
            customerEmail,
            paymentMethod: paymentMethod || "cod",
            promoCode: promo ? promo.code : null,
            promoDiscount: promo ? promoDiscount : null,
            distanceKm: quote.distanceKm,
            deliveryFee: quote.deliveryFee,
            surgeFee: quote.surgeFee,
            priorityFee: quote.priorityFee,
            serviceFee: quote.serviceFee,
            total,
            status: status || undefined, // undefined = schema default (PAYMENT_PENDING)
            codFlagged: !!codFlagged,
            codFlagReason: codFlagReason || null,
            items: { create: orderItems },
          },
          include: { items: true },
        });
      } catch (err) {
        if (err.code === "P2002" && attempt < 4) {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  });
}

const DIRECT_PAYMENT_METHODS = new Set(["cod", "eft"]);

// 📦 CREATE ORDER (customer, auth-gated) — COD/EFT only.
app.post("/order", writeLimiter, requireUser, async (req, res) => {
  try {
    const { address, items, customerName, customerPhone, paymentMethod, promoCode, landmark, deliveryLat, deliveryLng, priorityFee } = req.body;
    const priced = await validateAndPriceOrder({
      address,
      items,
      customerPhone,
      paymentMethod,
      allowedPaymentMethods: DIRECT_PAYMENT_METHODS,
      location: { landmark, deliveryLat, deliveryLng },
      priorityFee,
    });
    if (priced.error) return res.status(400).json({ error: priced.error });

    let codFlagged = false;
    let codFlagReason = null;
    if (paymentMethod === "cod") {
      const estimatedTotal = await estimateOrderTotal(priced, promoCode);
      const cod = await assessCodEligibility({
        userId: req.user.id,
        userCreatedAt: req.user.created_at,
        orderTotal: estimatedTotal,
        skuIds: priced.orderItems.map((i) => i.skuId).filter(Boolean),
      });
      if (!cod.eligible) return res.status(400).json({ error: cod.error });
      codFlagged = cod.flagged;
      codFlagReason = cod.flagReason;
    }

    const order = await createOrderTransaction({
      userId: req.user.id,
      address,
      customerName,
      customerPhone,
      customerEmail: req.user.email,
      paymentMethod,
      promoCode,
      priced,
      codFlagged,
      codFlagReason,
      location: { landmark, deliveryLat, deliveryLng },
      // EFT waits for an admin to confirm the transfer; COD goes straight to packing.
      status: paymentMethod === "eft" ? "PAYMENT_PENDING" : "PENDING",
    });
    console.log("New order:", order.code);
    sendOrderConfirmationEmail(order, req.user.email).catch((e) => console.error("[email] confirmation failed:", e));
    sendAdminOrderAlertEmail(order).catch((e) => console.error("[email] admin alert failed:", e));
    res.json({ message: "Order received", order });
  } catch (err) {
    if (err.message === "PROMO_INVALID") return res.status(400).json({ error: err.detail });
    if (err.message === "PROMO_RACE_LOST") {
      return res.status(400).json({ error: "That promo code just reached its usage limit — remove it and try again" });
    }
    if (err.message === "OUT_OF_STOCK") {
      return res.status(400).json({ error: `${err.productName} just sold out — remove it from your cart and try again` });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// 💳 PAYMENT CONFIG — lets checkout.html know whether to enable card.
app.get("/api/payment-config", (req, res) => {
  res.json({ cardEnabled: isYocoConfigured() });
});

// 🚚 COD ELIGIBILITY (track record only) — preview for checkout.html.
// The real gate is still POST /order's own server-side check.
app.get("/api/cod-eligibility", requireUser, async (req, res) => {
  try {
    const accountAgeMonths = monthsSince(req.user.created_at);
    const deliveredOrderCount = await countDeliveredOrders(req.user.id);
    const trackRecordOk = accountAgeMonths >= COD_MIN_ACCOUNT_AGE_MONTHS && deliveredOrderCount >= COD_MIN_DELIVERED_ORDERS;
    res.json({
      trackRecordOk,
      trackRecordMessage: trackRecordOk ? null : codTrackRecordMessage(accountAgeMonths, deliveredOrderCount),
      accountAgeMonths,
      deliveredOrderCount,
      minAccountAgeMonths: COD_MIN_ACCOUNT_AGE_MONTHS,
      minDeliveredOrders: COD_MIN_DELIVERED_ORDERS,
      minOrderTotal: COD_MIN_ORDER_TOTAL,
      maxOrderTotal: COD_MAX_ORDER_TOTAL,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check COD eligibility" });
  }
});

function appBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

// 💳 CARD CHECKOUT — start a Yoco hosted checkout. The Order is only
// created once POST /webhooks/yoco confirms payment.
app.post("/order/checkout-session", writeLimiter, requireUser, async (req, res) => {
  if (!isYocoConfigured()) return res.status(400).json({ error: "Card payment isn't available yet" });
  try {
    const { address, items, customerName, customerPhone, promoCode, landmark, deliveryLat, deliveryLng, priorityFee } = req.body;
    const priced = await validateAndPriceOrder({
      address,
      items,
      customerPhone,
      paymentMethod: "card",
      allowedPaymentMethods: new Set(["card"]),
      location: { landmark, deliveryLat, deliveryLng },
      priorityFee,
    });
    if (priced.error) return res.status(400).json({ error: priced.error });

    let promo = null;
    if (promoCode) {
      const result = await checkPromoCode(promoCode, priced.subtotal - priced.coolerDiscount);
      if (result.error) return res.status(400).json({ error: result.error });
      promo = result.promo;
    }
    const promoDiscount = computePromoDiscount(priced.subtotal, priced.coolerDiscount, promo);
    const total = computeOrderTotal(priced.subtotal, priced.coolerDiscount, promoDiscount, priced.quote.total);
    const amountCents = Math.round(total * 100);
    const location = parseDeliveryLocation({ landmark, deliveryLat, deliveryLng });

    const base = appBaseUrl(req);
    const pending = await prisma.pendingCheckout.create({
      data: {
        userId: req.user.id,
        yocoCheckoutId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amountCents,
        payload: JSON.stringify({ address, items, customerName, customerPhone, promoCode: promoCode || null, customerEmail: req.user.email, priorityFee: priced.quote.priorityFee, ...location }),
      },
    });

    let checkout;
    try {
      checkout = await createYocoCheckout({
        amountCents,
        currency: "ZAR",
        successUrl: `${base}/order-confirmation.html?pending=${pending.id}`,
        cancelUrl: `${base}/checkout.html`,
        failureUrl: `${base}/checkout.html?paymentFailed=1`,
        metadata: { pendingCheckoutId: pending.id, userId: req.user.id },
      });
    } catch (err) {
      await prisma.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});
      throw err;
    }

    await prisma.pendingCheckout.update({ where: { id: pending.id }, data: { yocoCheckoutId: checkout.id } });
    res.json({ redirectUrl: checkout.redirectUrl });
  } catch (err) {
    console.error("[yoco] Failed to start checkout:", err);
    res.status(500).json({ error: "Failed to start card checkout" });
  }
});

// Polled by order-confirmation.html while waiting for the webhook.
app.get("/api/checkout-session/:id/status", requireUser, async (req, res) => {
  try {
    const pending = await prisma.pendingCheckout.findUnique({ where: { id: req.params.id } });
    if (!pending || pending.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
    res.json({ status: pending.status, orderCode: pending.orderCode || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check status" });
  }
});

// Marks a paid checkout as needing a human (refund or manual order) and
// emails the admins. Used for both amount mismatches and order failures.
async function flagPaidCheckoutForReview(pending, reason) {
  await prisma.pendingCheckout.update({
    where: { id: pending.id },
    data: { status: "FAILED_NEEDS_REFUND", failureReason: reason },
  }).catch((e) => console.error("[yoco webhook] Failed to flag checkout:", e));
  sendPaymentFailureAlertEmail(pending, reason).catch((e) => console.error("[email] failure alert failed:", e));
}

// 🪝 YOCO WEBHOOK — verifies the signature, re-fetches the checkout from
// Yoco, checks the amount actually paid matches what we quoted, then runs
// the same order-creation transaction COD/EFT uses.
app.post("/webhooks/yoco", async (req, res) => {
  const signatureValid = verifyYocoWebhookSignature(req.headers, req.rawBody);
  if (!signatureValid) {
    console.error("[yoco webhook] Invalid or unverifiable signature — rejecting");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const checkoutId = extractCheckoutId(req.body);
  if (!checkoutId) {
    console.error("[yoco webhook] Could not find a checkout id in payload:", JSON.stringify(req.body));
    return res.status(400).json({ error: "No checkout id in payload" });
  }

  // Ack fast — the work below is idempotent (guarded by PendingCheckout.status).
  res.json({ received: true });

  try {
    const pending = await prisma.pendingCheckout.findUnique({ where: { yocoCheckoutId: checkoutId } });
    if (!pending) {
      console.error("[yoco webhook] No PendingCheckout for Yoco checkout:", checkoutId);
      return;
    }
    if (pending.status !== "PENDING") return; // already handled

    const checkout = await getYocoCheckout(checkoutId);
    if (!checkoutLooksPaid(checkout)) {
      console.log(`[yoco webhook] Checkout ${checkoutId} not in a paid state yet:`, checkout.status || checkout.state);
      return;
    }

    // The amount Yoco actually charged must match what we quoted, in ZAR.
    // If it can't be read at all, a human checks it — never assume it's fine.
    const paidCents = extractPaidAmountCents(checkout);
    const currency = extractCurrency(checkout);
    if (paidCents !== pending.amountCents || (currency && currency !== "ZAR")) {
      const reason = paidCents == null
        ? `Could not read the paid amount from Yoco (expected R${(pending.amountCents / 100).toFixed(2)}). Check the Yoco dashboard before dispatching.`
        : `Paid R${(paidCents / 100).toFixed(2)} ${currency || ""} but the order total was R${(pending.amountCents / 100).toFixed(2)} ZAR.`;
      console.error(`[yoco webhook] Amount check failed for ${checkoutId}: ${reason}`, checkout);
      await flagPaidCheckoutForReview(pending, reason);
      return;
    }

    const payload = JSON.parse(pending.payload);
    const priced = await validateAndPriceOrder({
      address: payload.address,
      items: payload.items,
      customerPhone: payload.customerPhone,
      paymentMethod: "card",
      allowedPaymentMethods: new Set(["card"]),
      location: { landmark: payload.landmark, deliveryLat: payload.deliveryLat, deliveryLng: payload.deliveryLng },
      priorityFee: payload.priorityFee,
    });
    if (priced.error) throw new Error(priced.error);

    const order = await createOrderTransaction({
      userId: pending.userId,
      address: payload.address,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      paymentMethod: "card",
      promoCode: payload.promoCode,
      status: "PENDING",
      priced,
      location: { landmark: payload.landmark, deliveryLat: payload.deliveryLat, deliveryLng: payload.deliveryLng },
    });

    await prisma.pendingCheckout.update({
      where: { id: pending.id },
      data: { status: "COMPLETED", orderCode: order.code, completedAt: new Date() },
    });
    console.log(`[yoco webhook] Order ${order.code} created from checkout ${checkoutId}`);

    // Prices (or the surge window) can change between quoting and payment —
    // the customer has still paid the quoted amount, so keep the order but
    // tell the admins.
    if (Math.round(order.total * 100) !== pending.amountCents) {
      console.warn(`[yoco webhook] Order ${order.code} total R${order.total} differs from paid R${pending.amountCents / 100}`);
    }

    sendOrderConfirmationEmail(order, payload.customerEmail).catch((e) => console.error("[email] confirmation failed:", e));
    sendAdminOrderAlertEmail(order).catch((e) => console.error("[email] admin alert failed:", e));
  } catch (err) {
    console.error("[yoco webhook] Failed to create order after payment:", err);
    const pending = await prisma.pendingCheckout.findUnique({ where: { yocoCheckoutId: checkoutId } }).catch(() => null);
    if (pending) await flagPaidCheckoutForReview(pending, err.message);
  }
});

// 📜 CUSTOMER: MY ORDERS — orders the customer has removed from their own
// list (hiddenByCustomer) are skipped here only. Admin /orders still sees all.
app.get("/api/my-orders", requireUser, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id, hiddenByCustomer: false },
      include: { items: true, tavern: { select: { name: true, area: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

// 📍 PUBLIC ORDER TRACKING — no login required, just the order code
const LOCATION_STALE_AFTER_MS = 3 * 60 * 1000;

app.get("/api/order/:code/track", trackLimiter, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { code: req.params.code },
      select: {
        code: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        driverName: true,
        driverVehicle: true,
        driverLat: true,
        driverLng: true,
        driverLocationAt: true,
        rating: true,
        ratingComment: true,
        tavern: { select: { name: true, area: true } },
        items: { select: { name: true, quantity: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const isFresh = order.driverLocationAt && Date.now() - new Date(order.driverLocationAt).getTime() < LOCATION_STALE_AFTER_MS;
    if (!isFresh) {
      order.driverLat = null;
      order.driverLng = null;
      order.driverLocationAt = null;
    }
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to look up order" });
  }
});

// ⭐ CUSTOMER: RATE A DELIVERED ORDER
app.post("/order/:code/rate", requireUser, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const parsedRating = parseInt(rating, 10);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Rating must be a whole number from 1 to 5" });
    }

    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.id) return res.status(403).json({ error: "This isn't your order" });
    if (order.status !== "DELIVERED") return res.status(400).json({ error: "You can only rate a delivered order" });
    if (order.rating != null) return res.status(400).json({ error: "You've already rated this order" });

    const updated = await prisma.order.update({
      where: { code: req.params.code },
      data: {
        rating: parsedRating,
        ratingComment: typeof comment === "string" ? comment.trim().slice(0, 500) || null : null,
      },
      select: { code: true, rating: true, ratingComment: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save rating" });
  }
});

// 📊 ADMIN: VIEW ORDERS
app.get("/orders", requireAdmin, async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { items: true, tavern: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

// 🏪 ADMIN: ASSIGN TAVERN + DRIVER — never promotes status on its own.
app.patch("/order/:code/assign", requireAdmin, async (req, res) => {
  try {
    const { tavernId, driverName, driverPhone, driverVehicle } = req.body;
    const driverShareToken = crypto.randomBytes(16).toString("hex");
    const order = await prisma.order.update({
      where: { code: req.params.code },
      data: { tavernId, driverName, driverPhone, driverVehicle, driverShareToken },
      include: { tavern: true },
    });
    await logAdminAction(req, "ASSIGN_ORDER", order.code, `tavern=${order.tavern?.name || tavernId}, driver=${driverName}`);
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
  }
});

// 💰 ADMIN: CONFIRM PAYMENT RECEIVED — EFT-only.
app.patch("/order/:code/confirm-payment", requireAdmin, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.paymentMethod !== "eft") {
      return res.status(400).json({ error: "Only EFT orders need a manual payment confirmation" });
    }
    if (order.status !== "PAYMENT_PENDING") {
      return res.status(400).json({ error: `Order is already ${order.status.toLowerCase()}` });
    }
    const updated = await prisma.order.update({
      where: { code: req.params.code },
      data: { status: "PENDING" },
    });
    await logAdminAction(req, "CONFIRM_PAYMENT", order.code, `EFT payment confirmed by ${req.user?.email || "api-token"}`);
    sendPaymentConfirmedEmail(updated, updated.customerEmail).catch((e) => console.error("[email] payment-confirmed failed:", e));
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

// 📍 DRIVER: SHARE LIVE LOCATION — authorized by the per-order driverShareToken.
app.post("/order/:code/location", locationLimiter, async (req, res) => {
  try {
    const { token, lat, lng } = req.body;
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order || !order.driverShareToken || order.driverShareToken !== token) {
      return res.status(403).json({ error: "Invalid or expired share link" });
    }
    if (order.status !== "DISPATCHED") {
      return res.status(400).json({ error: "This order isn't out for delivery" });
    }
    await prisma.order.update({
      where: { code: req.params.code },
      data: { driverLat: parsedLat, driverLng: parsedLng, driverLocationAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// 🚚 DRIVER: CONFIRM PICKUP
app.post("/order/:code/confirm-pickup", async (req, res) => {
  try {
    const { token } = req.body;
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order || !order.driverShareToken || order.driverShareToken !== token) {
      return res.status(403).json({ error: "Invalid or expired share link" });
    }
    if (order.status !== "PENDING") {
      return res.status(400).json({ error: "This order isn't ready for pickup yet" });
    }
    const updated = await prisma.order.update({
      where: { code: req.params.code },
      data: { status: "DISPATCHED" },
    });
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to confirm pickup" });
  }
});

// 🏁 DRIVER: CONFIRM DELIVERED
app.post("/order/:code/confirm-delivered", async (req, res) => {
  try {
    const { token } = req.body;
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order || !order.driverShareToken || order.driverShareToken !== token) {
      return res.status(403).json({ error: "Invalid or expired share link" });
    }
    if (order.status !== "DISPATCHED") {
      return res.status(400).json({ error: "This order isn't out for delivery" });
    }
    const updated = await prisma.order.update({
      where: { code: req.params.code },
      data: { status: "DELIVERED" },
    });
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to confirm delivery" });
  }
});

// ✅ ADMIN: UPDATE STATUS (dispatch / deliver). Cancellation has its own
// endpoint below (restores stock atomically) — not reachable through this
// generic status setter, and only a fixed, valid set of statuses is
// accepted, never an arbitrary client-supplied string.
const ADMIN_SETTABLE_STATUSES = new Set(["PAYMENT_PENDING", "PENDING", "DISPATCHED", "DELIVERED"]);

app.patch("/order/:code/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!ADMIN_SETTABLE_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const order = await prisma.order.update({
      where: { code: req.params.code },
      data: { status },
    });
    await logAdminAction(req, "UPDATE_STATUS", order.code, `status=${status}`);
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
  }
});

// ── Order cancellation — shared by the customer-facing and admin routes.
// Restores every line item's stock atomically in the same transaction that
// sets status to CANCELLED, so a cancelled order never leaves stock
// permanently (and silently) locked up.
async function cancelOrderTransaction(code, reason) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { code }, include: { items: true } });
    if (!order) {
      const err = new Error("ORDER_NOT_FOUND");
      throw err;
    }
    if (order.status === "CANCELLED") {
      const err = new Error("ALREADY_CANCELLED");
      throw err;
    }
    if (order.status === "DELIVERED") {
      const err = new Error("ALREADY_DELIVERED");
      throw err;
    }
    for (const item of order.items) {
      if (!item.skuId) continue;
      await tx.skuItem.update({
        where: { id: item.skuId },
        data: { stock: { increment: item.quantity } },
      });
    }
    return tx.order.update({
      where: { code },
      data: { status: "CANCELLED", cancelReason: reason || null },
    });
  });
}

function cancelErrorResponse(err, res) {
  if (err.message === "ORDER_NOT_FOUND") return res.status(404).json({ error: "Order not found" });
  if (err.message === "ALREADY_CANCELLED") return res.status(400).json({ error: "This order is already cancelled" });
  if (err.message === "ALREADY_DELIVERED") return res.status(400).json({ error: "A delivered order can't be cancelled" });
  console.error(err);
  return res.status(500).json({ error: "Failed to cancel order" });
}

// 🙅 CUSTOMER: CANCEL OWN ORDER — only while it hasn't been dispatched yet.
// Once a driver has picked it up, cancelling needs a human (admin), since
// stock, the driver, and the tavern are already in motion.
app.post("/order/:code/cancel", writeLimiter, requireUser, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.id) return res.status(403).json({ error: "This isn't your order" });
    if (order.status === "DISPATCHED") {
      return res.status(400).json({ error: "This order is already out for delivery — contact us to cancel it" });
    }
    const updated = await cancelOrderTransaction(req.params.code, "Cancelled by customer");
    res.json({ ok: true, order: updated });
  } catch (err) {
    cancelErrorResponse(err, res);
  }
});

// 🙈 CUSTOMER: REMOVE A FINISHED ORDER FROM THEIR OWN LIST — a soft hide, not
// a delete. Only cancelled or delivered orders qualify (nothing in motion can
// disappear). The row, its items, stock history and the admin view are all
// untouched; only /api/my-orders skips it.
const CUSTOMER_REMOVABLE_STATUSES = new Set(["CANCELLED", "DELIVERED"]);

app.post("/order/:code/hide", requireUser, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.id) return res.status(403).json({ error: "This isn't your order" });
    if (!CUSTOMER_REMOVABLE_STATUSES.has(order.status)) {
      return res.status(400).json({ error: "Only cancelled or delivered orders can be removed" });
    }
    await prisma.order.update({
      where: { code: req.params.code },
      data: { hiddenByCustomer: true },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove order" });
  }
});

// 🙅 ADMIN: CANCEL ANY ORDER — at any stage, with an optional reason.
app.post("/order/:code/admin-cancel", requireAdmin, async (req, res) => {
  try {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : null;
    const updated = await cancelOrderTransaction(req.params.code, reason || "Cancelled by admin");
    await logAdminAction(req, "CANCEL_ORDER", req.params.code, reason || "Cancelled by admin");
    res.json({ ok: true, order: updated });
  } catch (err) {
    cancelErrorResponse(err, res);
  }
});

// 🗑 ADMIN: DELETE ORDER — purges history only. If the order is still
// active (not CANCELLED/DELIVERED), require it to be cancelled first so
// stock is always restored through cancelOrderTransaction rather than
// silently lost by deleting an order that still held reserved stock.
app.delete("/order/:code", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "CANCELLED" && order.status !== "DELIVERED") {
      return res.status(400).json({ error: "Cancel this order before deleting it, so its stock is restored" });
    }
    await prisma.order.delete({ where: { code: req.params.code } });
    await logAdminAction(req, "DELETE_ORDER", req.params.code);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
  }
});

// 👤 ADMIN: WHO AM I
app.get("/admin/me", requireAdmin, (req, res) => {
  res.json({ email: req.user?.email || null, role: req.adminRole });
});

// 📦 ADMIN: INVENTORY
app.get("/admin/products", requireAdmin, async (req, res) => {
  try {
    const products = await prisma.skuItem.findMany({
      select: { id: true, name: true, category: true, bottleFormat: true, stock: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.patch("/admin/products/:id/stock", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const stock = parseInt(req.body.stock, 10);
    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: "Stock must be a non-negative whole number" });
    }
    const product = await prisma.skuItem.update({
      where: { id: req.params.id },
      data: { stock },
      select: { id: true, name: true, stock: true },
    });
    await logAdminAction(req, "UPDATE_STOCK", product.name, `stock=${stock}`);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Product not found" });
  }
});

// 👥 ADMIN: MANAGE ADMINS — super-admin only.
app.get("/admin/admins", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
    const bootstrapped = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    res.json({ admins, bootstrapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load admins" });
  }
});

app.post("/admin/admins", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const role = req.body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "DISPATCHER";
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (isAdminEmail(email)) {
      return res.status(400).json({ error: "This email is already a super-admin via ADMIN_EMAILS" });
    }
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { role },
      create: { email, role },
    });
    await logAdminAction(req, "ADD_ADMIN", email, `role=${role}`);
    res.json(admin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add admin" });
  }
});

app.delete("/admin/admins/:id", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const removed = await prisma.adminUser.delete({ where: { id: req.params.id } });
    await logAdminAction(req, "REMOVE_ADMIN", removed.email);
    res.json({ message: "Removed" });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Admin not found" });
  }
});

// 📜 ADMIN: AUDIT LOG — super-admin only, newest 200 rows.
app.get("/admin/audit-log", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

// Feature routes that live in their own files (driver reports, delivery fees, ...).
require("./routes/index.js")(app, { prisma, requireUser, requireAdmin, requireSuperAdmin, writeLimiter, trackLimiter, logAdminAction, quoteDelivery });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
