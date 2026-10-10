require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
// Render terminates TLS in front of this app and forwards X-Forwarded-Proto
// — without trusting the proxy, req.protocol always reports "http", which
// would build broken (non-https) Yoco redirect URLs.
app.set("trust proxy", true);

const { createYocoCheckout, getYocoCheckout, checkoutLooksPaid, verifyYocoWebhookSignature, extractCheckoutId, isYocoConfigured } = require("./payments.js");
const { sendOrderConfirmationEmail, sendAdminOrderAlertEmail, sendPaymentFailureAlertEmail, sendPaymentConfirmedEmail } = require("./emails.js");

app.use(express.static("public"));
app.use("/admin", express.static("admin"));
// The verify callback stashes the raw bytes alongside normal JSON parsing —
// needed for the Yoco webhook route, which must HMAC-verify against the
// exact raw body, not a re-serialized version of the parsed object.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// ── Supabase Auth (customer login) ─────────────────────────
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

// ── Admin auth ──────────────────────────────────────────────
// Real per-user auth: a logged-in Supabase user whose email is in the
// ADMIN_EMAILS allowlist (comma-separated, case-insensitive) is always a
// SUPER_ADMIN — that's the root bootstrap path, since you need at least
// one admin able to grant anyone else access before a role table means
// anything. Beyond that, the AdminUser table holds delegated admins with
// an actual role (SUPER_ADMIN or DISPATCHER), managed via /admin/admins.
// The shared ADMIN_API_TOKEN header still works too — kept for scripts/
// curl (e.g. the /admin/enrich-images trigger) and as a bootstrap path
// before any admin account is set up. Once every admin has a real
// account, drop ADMIN_API_TOKEN from the environment to retire it.
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

// Layer on top of requireAdmin (run after it) — gates the actions that
// shouldn't be available to every dispatcher: deleting orders, managing
// inventory, and managing other admins' access.
function requireSuperAdmin(req, res, next) {
  if (req.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "This action requires a super-admin account" });
  }
  next();
}

// Fire-and-forget-but-awaited record of who did what. Never blocks or
// fails the actual admin action — a logging failure shouldn't stop an
// order from being dispatched — so errors here are swallowed, just logged
// to the console for visibility.
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

// ── Cooler Box pricing — shared with the browser via public/pricing.js,
// see that file for why. This used to be copy-pasted here separately.
const { COOLER_ELIGIBLE, coolerDiscountPct } = require("./public/pricing.js");

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

// 🛒 CATALOG — replaces the hardcoded CATALOG object in shop.html
app.get("/api/products", async (req, res) => {
  try {
    const { category } = req.query;
    const products = await prisma.skuItem.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// 🏪 TAVERNS — public store list for the homepage. Deliberately narrow:
// only what's safe to show a customer, never the tavern's phone number.
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

// 📊 STATS — real, computed trust-signal numbers for the homepage (product
// count, verified tavern count, distinct townships served). Never hardcode
// these in the frontend — they drift the moment the catalog or tavern list
// changes, and a stale trust number is worse than no trust number.
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

// 🏪 ADMIN: full tavern records (includes phone) for the assign-order
// dropdown + WhatsApp dispatch messages.
app.get("/admin/taverns", requireAdmin, async (req, res) => {
  const taverns = await prisma.tavern.findMany({ orderBy: { name: "asc" } });
  res.json(taverns);
});

// 🖼️ ADMIN: one-off image enrichment job (real product photos via Open
// Food Facts, free, no API key). Render has real outbound internet access
// unlike some sandboxed dev environments, so this runs server-side here
// rather than as a local script. Long-running (~300ms/product, polite to
// the free API) — responds immediately and processes in the background.
// Products with no confident match keep their category placeholder image.
// Trigger once with: curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" https://<host>/admin/enrich-images
// Progress logs to the Render console; check /admin/enrich-images/status for a live count.
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

// 🏷️ PROMO CODES — shared validation, used by both the preview endpoint
// (cart/checkout, no side effects) and order creation (the only place a
// code is actually redeemed). subtotal here is pre-delivery, pre-discount.
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
app.post("/api/promo/validate", async (req, res) => {
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

// ── Cash-on-delivery eligibility ─────────────────────────────
// Real cash changing hands at the door is the riskiest payment path we
// offer — both a fraud surface (no chargeback-style recourse) and, at
// the high end, a driver-safety issue. Enforced here, server-side, not
// just hinted at in the checkout UI:
//   1. Track record — account older than 3 months AND at least 30 prior
//      orders placed, both required. Either alone isn't enough: a brand
//      new account with 30 orders in a week has no real track record,
//      and a 3-year-old account that's only ordered twice doesn't either.
//   2. This order's amount — needs to clear R300 (stricter than the
//      R200 free-delivery threshold elsewhere in the app) and is always
//      capped at R1500, regardless of how established the account is —
//      purely so a driver is never holding more cash than that.
//   3. Pattern deviation — flagged, not blocked, when an order swings
//      far outside what this customer has actually bought before (e.g.
//      someone who's only ever bought Hennessy VS suddenly ordering
//      several brands/categories they've never touched, for several
//      times their usual spend). Surfaces on the admin dashboard for a
//      human to glance at before dispatch — a deviation isn't proof of
//      fraud on its own, so it never auto-rejects.
const COD_MIN_ACCOUNT_AGE_MONTHS = 3;
const COD_MIN_PRIOR_ORDERS = 30;
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

// Orders placed but never actually confirmed (abandoned card checkouts
// stuck at PAYMENT_PENDING) don't count as "using the account."
async function countConfirmedOrders(userId) {
  return prisma.order.count({ where: { userId, status: { not: "PAYMENT_PENDING" } } });
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
  const priorOrderCount = await countConfirmedOrders(userId);

  if (accountAgeMonths < COD_MIN_ACCOUNT_AGE_MONTHS || priorOrderCount < COD_MIN_PRIOR_ORDERS) {
    return {
      eligible: false,
      error: `Cash on delivery unlocks once your account is ${COD_MIN_ACCOUNT_AGE_MONTHS}+ months old and you've placed ${COD_MIN_PRIOR_ORDERS}+ orders (you're at ${accountAgeMonths} month${accountAgeMonths === 1 ? "" : "s"}, ${priorOrderCount} order${priorOrderCount === 1 ? "" : "s"}). Please pay by card or EFT for now.`,
      accountAgeMonths,
      priorOrderCount,
    };
  }

  // Pattern check — only meaningful once there's real history to compare
  // against; skip it for accounts that just barely cleared the 30-order
  // gate with too little signal to call anything "unusual" yet.
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

  return { eligible: true, flagged, flagReason, accountAgeMonths, priorOrderCount };
}

// Mirrors the total calc inside createOrderTransaction (subtotal minus
// Cooler Box and promo discounts, plus delivery) without writing
// anything — needed to check a COD order's amount before the order (and
// the real promo redemption) is actually created.
async function estimateOrderTotal({ subtotal, coolerDiscount }, promoCode) {
  let promoDiscount = 0;
  if (promoCode) {
    const { promo } = await checkPromoCode(promoCode, subtotal - coolerDiscount);
    if (promo) promoDiscount = Math.round((subtotal - coolerDiscount) * (promo.discountPct / 100) * 100) / 100;
  }
  const delivery = subtotal > 200 ? 0 : 50;
  return Math.round((subtotal - coolerDiscount - promoDiscount + delivery) * 100) / 100;
}

// ── Order pricing + validation — shared by the immediate COD/EFT path
// (POST /order below) and the card path, where the same logic runs again
// inside the webhook handler once Yoco confirms payment, not at checkout-
// session creation time. Pure computation only; no DB writes.
async function validateAndPriceOrder({ address, items, customerPhone, paymentMethod, allowedPaymentMethods }) {
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
  const stockNeeded = []; // { skuId, name, units } — units are individual bottles, not cases

  for (const i of items) {
    const sku = skuMap.get(i.skuId);
    const rawQuantity = parseInt(i.quantity, 10);
    if (!sku || !Number.isInteger(rawQuantity) || rawQuantity <= 0) {
      return { error: `Invalid item: ${i.skuId}` };
    }
    // Case mode is bought in whole cases — quantity is always a bottle
    // count (same field as single mode), so round it up to the nearest
    // full case server-side too, matching cart.html/checkout.html, rather
    // than trusting the client sent an exact multiple.
    const quantity = i.purchaseType === "case"
      ? Math.ceil(rawQuantity / sku.unitsPerCase) * sku.unitsPerCase
      : rawQuantity;
    const unitPrice = i.purchaseType === "case" ? sku.retailCaseZAR / sku.unitsPerCase : sku.retailSingleZAR;
    const itemTotal = unitPrice * quantity;
    subtotal += itemTotal;
    if (COOLER_ELIGIBLE.has(sku.category)) coolerSubtotal += itemTotal;

    orderItems.push({ skuId: sku.id, name: sku.name, price: unitPrice, quantity });
    // quantity is already a bottle count in both modes (case mode was
    // just rounded up to a case multiple above) — no further scaling.
    stockNeeded.push({ skuId: sku.id, name: sku.name, units: quantity });
  }

  const coolerDiscount = coolerSubtotal * coolerDiscountPct(coolerSubtotal);
  return { orderItems, stockNeeded, subtotal, coolerDiscount };
}

// Runs the actual atomic write: stock decrement, promo redemption, and the
// Order row itself, all in one transaction. Called directly for COD/EFT
// (payment happens at the door / independently), and from the Yoco
// webhook handler for card (only after Yoco confirms payment succeeded).
async function createOrderTransaction({ userId, address, customerName, customerPhone, customerEmail, paymentMethod, promoCode, status, priced, codFlagged, codFlagReason }) {
  const { orderItems, stockNeeded, subtotal, coolerDiscount } = priced;

  let promo = null;
  let promoDiscount = 0;
  if (promoCode) {
    const result = await checkPromoCode(promoCode, subtotal - coolerDiscount);
    if (result.error) {
      const err = new Error("PROMO_INVALID");
      err.detail = result.error;
      throw err;
    }
    promo = result.promo;
    if (promo) promoDiscount = Math.round((subtotal - coolerDiscount) * (promo.discountPct / 100) * 100) / 100;
  }

  const delivery = subtotal > 200 ? 0 : 50;
  const total = Math.round((subtotal - coolerDiscount - promoDiscount + delivery) * 100) / 100;
  const code = "EKO-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  // Decrement stock and increment the promo's usage count in the same
  // transaction as the order write — avoids two races: two customers
  // both slipping in under a promo's maxUses cap, or both buying the
  // last few units of something between the check and the write.
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
    return tx.order.create({
      data: {
        code,
        userId,
        address,
        customerName,
        customerPhone,
        customerEmail,
        paymentMethod: paymentMethod || "cod",
        promoCode: promo ? promo.code : null,
        promoDiscount: promo ? promoDiscount : null,
        total,
        status: status || undefined, // undefined = schema default (PAYMENT_PENDING)
        codFlagged: !!codFlagged,
        codFlagReason: codFlagReason || null,
        items: { create: orderItems },
      },
      include: { items: true },
    });
  });
}

const DIRECT_PAYMENT_METHODS = new Set(["cod", "eft"]);

// 📦 CREATE ORDER (customer, auth-gated) — COD/EFT only. Card goes through
// POST /order/checkout-session + the Yoco webhook instead, since payment
// isn't confirmed yet at the moment this would otherwise be called.
// Only skuId + quantity + purchaseType come from the client — every price
// is recomputed here from the current DB values. This closes the exploit
// where an editable price field on the client could set its own total.
app.post("/order", requireUser, async (req, res) => {
  try {
    const { address, items, customerName, customerPhone, paymentMethod, promoCode } = req.body;
    const priced = await validateAndPriceOrder({ address, items, customerPhone, paymentMethod, allowedPaymentMethods: DIRECT_PAYMENT_METHODS });
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
      // EFT needs an admin to actually confirm the bank transfer landed —
      // that's the only payment method that waits at PAYMENT_PENDING now.
      // COD is paid at the door (nothing to confirm upfront) and card is
      // already confirmed by the time the Yoco webhook creates the order,
      // so both go straight to PENDING (packed/ready for pickup).
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

// 💳 PAYMENT CONFIG — lets checkout.html know whether to enable the card
// radio at all. Stays off (disabled, as it's always been) until
// YOCO_SECRET_KEY is actually set in the environment.
app.get("/api/payment-config", (req, res) => {
  res.json({ cardEnabled: isYocoConfigured() });
});

// 🚚 COD ELIGIBILITY (track record only) — lets checkout.html show/hide the
// Pay on Delivery option with a real reason before the customer even tries
// to submit. Doesn't know the current order's amount (checkout.html already
// has the cart total client-side to check that half against
// COD_MIN_ORDER_TOTAL/COD_MAX_ORDER_TOTAL) — this only covers the part that
// needs a DB lookup: account age and order-count history. The actual gate
// is still POST /order's own server-side check; this is a preview.
app.get("/api/cod-eligibility", requireUser, async (req, res) => {
  try {
    const accountAgeMonths = monthsSince(req.user.created_at);
    const priorOrderCount = await countConfirmedOrders(req.user.id);
    const trackRecordOk = accountAgeMonths >= COD_MIN_ACCOUNT_AGE_MONTHS && priorOrderCount >= COD_MIN_PRIOR_ORDERS;
    res.json({
      trackRecordOk,
      accountAgeMonths,
      priorOrderCount,
      minAccountAgeMonths: COD_MIN_ACCOUNT_AGE_MONTHS,
      minPriorOrders: COD_MIN_PRIOR_ORDERS,
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

// 💳 CARD CHECKOUT — start a Yoco hosted checkout. Doesn't create an Order
// or touch stock/promo yet; that only happens once POST /webhooks/yoco
// confirms the payment actually succeeded. Stores the validated order
// payload in PendingCheckout so the webhook has everything it needs to
// finish the job without trusting anything the client sends at that point.
app.post("/order/checkout-session", requireUser, async (req, res) => {
  if (!isYocoConfigured()) return res.status(400).json({ error: "Card payment isn't available yet" });
  try {
    const { address, items, customerName, customerPhone, promoCode } = req.body;
    const priced = await validateAndPriceOrder({
      address,
      items,
      customerPhone,
      paymentMethod: "card",
      allowedPaymentMethods: new Set(["card"]),
    });
    if (priced.error) return res.status(400).json({ error: priced.error });

    // Non-mutating promo preview — the real redemption (usedCount
    // increment) only happens inside createOrderTransaction, after payment
    // is confirmed. This is just to quote Yoco the correct final amount.
    let promoDiscount = 0;
    if (promoCode) {
      const result = await checkPromoCode(promoCode, priced.subtotal - priced.coolerDiscount);
      if (result.error) return res.status(400).json({ error: result.error });
      if (result.promo) promoDiscount = Math.round((priced.subtotal - priced.coolerDiscount) * (result.promo.discountPct / 100) * 100) / 100;
    }
    const delivery = priced.subtotal > 200 ? 0 : 50;
    const total = Math.round((priced.subtotal - priced.coolerDiscount - promoDiscount + delivery) * 100) / 100;
    const amountCents = Math.round(total * 100);

    const base = appBaseUrl(req);
    // The PendingCheckout id isn't known until after we've created it, but
    // Yoco needs redirect URLs up front — create the DB row first with a
    // placeholder Yoco id, then update it once Yoco responds. (Two round
    // trips, but this only runs once per checkout attempt, not per order.)
    const pending = await prisma.pendingCheckout.create({
      data: {
        userId: req.user.id,
        yocoCheckoutId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amountCents,
        // customerEmail is captured here (from the verified session) rather
        // than looked up later — the webhook handler has no user session to
        // work from, and fetching it via Supabase's admin API would need a
        // service-role key this app doesn't otherwise need or have.
        payload: JSON.stringify({ address, items, customerName, customerPhone, promoCode: promoCode || null, customerEmail: req.user.email }),
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

// Polled by order-confirmation.html while it's waiting for the webhook to
// land — Yoco's redirect can beat the webhook there by a second or two.
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

// 🪝 YOCO WEBHOOK — the only thing this integration actually trusts for
// "was this paid". Verifies the signature, re-fetches the checkout from
// Yoco directly (never trusts the webhook payload's own claim of success),
// then runs the same order-creation transaction COD/EFT uses.
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

  // Deliberately not filtering on req.body.type (e.g. "payment.succeeded")
  // here — the real gate is checkoutLooksPaid() below, which is based on
  // a fresh re-fetch from Yoco's own API, not on what this payload claims.
  // A webhook for any other event type on a real checkout just resolves to
  // "not paid yet" and returns harmlessly, so skipping the type check
  // doesn't weaken anything and keeps this working even if the exact
  // event-type string turns out to differ from what's assumed here.

  // Always ack fast — Yoco retries on non-2xx, and the actual work below
  // is idempotent (guarded by PendingCheckout.status), so double delivery
  // is safe either way.
  res.json({ received: true });

  try {
    const pending = await prisma.pendingCheckout.findUnique({ where: { yocoCheckoutId: checkoutId } });
    if (!pending) {
      console.error("[yoco webhook] No PendingCheckout for Yoco checkout:", checkoutId);
      return;
    }
    if (pending.status !== "PENDING") return; // already handled — idempotent no-op

    const checkout = await getYocoCheckout(checkoutId);
    if (!checkoutLooksPaid(checkout)) {
      console.log(`[yoco webhook] Checkout ${checkoutId} not in a paid state yet:`, checkout.status || checkout.state);
      return;
    }

    const payload = JSON.parse(pending.payload);
    const priced = await validateAndPriceOrder({
      address: payload.address,
      items: payload.items,
      customerPhone: payload.customerPhone,
      paymentMethod: "card",
      allowedPaymentMethods: new Set(["card"]),
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
      status: "PENDING", // card is pre-paid — skip PAYMENT_PENDING, ready to dispatch
      priced,
    });

    await prisma.pendingCheckout.update({
      where: { id: pending.id },
      data: { status: "COMPLETED", orderCode: order.code, completedAt: new Date() },
    });
    console.log(`[yoco webhook] Order ${order.code} created from checkout ${checkoutId}`);

    sendOrderConfirmationEmail(order, payload.customerEmail).catch((e) => console.error("[email] confirmation failed:", e));
    sendAdminOrderAlertEmail(order).catch((e) => console.error("[email] admin alert failed:", e));
  } catch (err) {
    // The customer has already paid at this point — this is the one
    // failure mode that needs a human, not just a log line.
    console.error("[yoco webhook] Failed to create order after payment:", err);
    const pending = await prisma.pendingCheckout.findUnique({ where: { yocoCheckoutId: checkoutId } }).catch(() => null);
    if (pending) {
      await prisma.pendingCheckout.update({
        where: { id: pending.id },
        data: { status: "FAILED_NEEDS_REFUND", failureReason: err.message },
      }).catch(() => {});
      sendPaymentFailureAlertEmail(pending, err.message).catch((e) => console.error("[email] failure alert failed:", e));
    }
  }
});

// 📜 CUSTOMER: MY ORDERS
app.get("/api/my-orders", requireUser, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
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
const LOCATION_STALE_AFTER_MS = 3 * 60 * 1000; // a driver ping older than this isn't "live" anymore

app.get("/api/order/:code/track", async (req, res) => {
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

    // Don't show a stale dot as if it were live — if the driver's phone
    // lost signal or they closed the tab, say so isn't shown at all rather
    // than silently misleading the customer about where the driver is.
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

// ⭐ CUSTOMER: RATE A DELIVERED ORDER — auth-gated so only the order's own
// owner can rate it, one rating per order, only once it's actually DELIVERED.
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

// 🏪 ADMIN: ASSIGN TAVERN + DRIVER — can happen before an EFT order's
// payment is actually confirmed (the tavern can be lined up in parallel),
// so this never promotes status on its own. Only CONFIRM PAYMENT (below)
// moves an order out of PAYMENT_PENDING now.
app.patch("/order/:code/assign", requireAdmin, async (req, res) => {
  try {
    const { tavernId, driverName, driverPhone, driverVehicle } = req.body;
    // A fresh share token per assignment — no driver account exists, so
    // this random token in a URL is what authorizes driver-track.html to
    // post location updates for this specific order (same trust model the
    // order tracking code itself already uses).
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

// 💰 ADMIN: CONFIRM PAYMENT RECEIVED — EFT-only. COD is paid at the door
// and card is confirmed automatically by the Yoco webhook, so those never
// sit at PAYMENT_PENDING; EFT is the one method where a human has to check
// the bank statement before the order can move. This is the single alert
// the customer actually asked for: "payment received, order being packed."
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

// 📍 DRIVER: SHARE LIVE LOCATION — public (no login; drivers aren't real
// accounts here), authorized only by the per-order driverShareToken.
// Only accepted while the order is actually DISPATCHED — no reason for a
// stale token to keep updating a delivered/undispatched order.
app.post("/order/:code/location", async (req, res) => {
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

// 🚚 DRIVER: CONFIRM PICKUP — same token-authed, no-login pattern as
// /location above. Lets the driver move the order to DISPATCHED themselves
// from driver-track.html the moment they actually have it, instead of the
// admin having to relay that over WhatsApp and click it manually.
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

// 🏁 DRIVER: CONFIRM DELIVERED — same pattern again.
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

// ✅ ADMIN: UPDATE STATUS (dispatch / deliver)
app.patch("/order/:code/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
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

// 🗑 ADMIN: DELETE ORDER
app.delete("/order/:code", requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await prisma.order.delete({ where: { code: req.params.code } });
    await logAdminAction(req, "DELETE_ORDER", req.params.code);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
  }
});

// 👤 ADMIN: WHO AM I — lets the dashboard know its own role so it can
// show/hide super-admin-only UI (Inventory edits, Delete, Manage Admins)
// without guessing or trying an action just to see if it 403s.
app.get("/admin/me", requireAdmin, (req, res) => {
  res.json({ email: req.user?.email || null, role: req.adminRole });
});

// 📦 ADMIN: INVENTORY — list every product with its current stock count.
// Any admin can view; only super-admins can change it (see PATCH below).
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

// 👥 ADMIN: MANAGE ADMINS — super-admin only. ADMIN_EMAILS-bootstrapped
// accounts don't live in this table and can't be removed from here (that's
// an env var change on Render); this only manages delegated AdminUser rows.
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

// 📜 ADMIN: AUDIT LOG — super-admin only. Read-only, newest first, capped
// at 200 rows (this is a dashboard list, not a reporting tool).
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
