require("dotenv").config();

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(express.static("public"));
app.use("/admin", express.static("admin"));
app.use(express.json());

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
// ADMIN_EMAILS allowlist (comma-separated, case-insensitive) is an admin.
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

async function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (process.env.ADMIN_API_TOKEN && token === process.env.ADMIN_API_TOKEN) {
    return next();
  }

  const user = await verifySupabaseToken(req);
  if (user && isAdminEmail(user.email)) {
    req.user = user;
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

// ── Cooler Box pricing (server-authoritative mirror of shop.html) ──────
// Categories the Cooler Box builder accepts — the target market's actual
// buying pattern (dumpies, spirits, mixers, ice, water) — see README.
const COOLER_ELIGIBLE = new Set([
  "BEER", "CIDER_RTD", "WHISKY", "GIN", "VODKA", "VODKA_PREMIUM",
  "TEQUILA", "TEQUILA_PREMIUM", "LIQUEUR", "MIXER", "WATER", "ICE",
]);

function coolerDiscountPct(coolerSubtotal) {
  if (coolerSubtotal >= 1000) return 0.15;
  if (coolerSubtotal >= 600) return 0.10;
  if (coolerSubtotal >= 300) return 0.05;
  return 0;
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

// 📦 CREATE ORDER (customer, auth-gated)
// Only skuId + quantity + purchaseType come from the client — every price
// is recomputed here from the current DB values. This closes the exploit
// where an editable price field on the client could set its own total.
app.post("/order", requireUser, async (req, res) => {
  try {
    const { address, items, customerName, customerPhone, paymentMethod, promoCode } = req.body;
    if (!address || typeof address !== "string" || address.trim().length < 5) {
      return res.status(400).json({ error: "Please enter a valid delivery address" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items are required" });
    }
    const digitsOnly = (customerPhone || "").replace(/\D/g, "");
    if (digitsOnly.length < 9 || digitsOnly.length > 12) {
      return res.status(400).json({ error: "Please enter a valid phone number" });
    }
    // Card isn't real yet (no gateway wired up) — reject it server-side too,
    // not just disable the radio client-side, so nothing but cod/eft can
    // ever land in the DB regardless of what a client sends.
    const ALLOWED_PAYMENT_METHODS = new Set(["cod", "eft"]);
    if (paymentMethod && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const skuIds = items.map((i) => i.skuId).filter(Boolean);
    const skus = await prisma.skuItem.findMany({ where: { id: { in: skuIds } } });
    const skuMap = new Map(skus.map((s) => [s.id, s]));

    let subtotal = 0;
    let coolerSubtotal = 0;
    const orderItems = [];

    for (const i of items) {
      const sku = skuMap.get(i.skuId);
      const quantity = parseInt(i.quantity, 10);
      if (!sku || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: `Invalid item: ${i.skuId}` });
      }
      const unitPrice = i.purchaseType === "case" ? sku.retailCaseZAR / sku.unitsPerCase : sku.retailSingleZAR;
      const itemTotal = unitPrice * quantity;
      subtotal += itemTotal;
      if (COOLER_ELIGIBLE.has(sku.category)) coolerSubtotal += itemTotal;

      orderItems.push({ skuId: sku.id, name: sku.name, price: unitPrice, quantity });
    }

    const coolerDiscount = coolerSubtotal * coolerDiscountPct(coolerSubtotal);

    // Promo discount applies to whatever's left after the Cooler Box
    // discount, same "stack on the discounted subtotal" order most retail
    // checkouts use. Re-validated here regardless of what the client
    // showed — the only place a code actually gets redeemed.
    let promo = null;
    let promoDiscount = 0;
    if (promoCode) {
      const result = await checkPromoCode(promoCode, subtotal - coolerDiscount);
      if (result.error) return res.status(400).json({ error: result.error });
      promo = result.promo;
      if (promo) promoDiscount = Math.round((subtotal - coolerDiscount) * (promo.discountPct / 100) * 100) / 100;
    }

    const delivery = subtotal > 200 ? 0 : 50;
    const total = Math.round((subtotal - coolerDiscount - promoDiscount + delivery) * 100) / 100;

    const code = "EKO-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // Increment the promo's usage count in the same transaction as the
    // order — avoids a race where two customers both slip in under a
    // maxUses cap between the earlier check and the write.
    const order = await prisma.$transaction(async (tx) => {
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
          userId: req.user.id,
          address,
          customerName,
          customerPhone,
          paymentMethod: paymentMethod || "cod",
          promoCode: promo ? promo.code : null,
          promoDiscount: promo ? promoDiscount : null,
          total,
          items: { create: orderItems },
        },
        include: { items: true },
      });
    });
    console.log("New order:", order.code);
    res.json({ message: "Order received", order });
  } catch (err) {
    if (err.message === "PROMO_RACE_LOST") {
      return res.status(400).json({ error: "That promo code just reached its usage limit — remove it and try again" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
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
app.get("/api/order/:code/track", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { code: req.params.code },
      select: {
        code: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        driverName: true,
        driverVehicle: true,
        rating: true,
        ratingComment: true,
        tavern: { select: { name: true, area: true } },
        items: { select: { name: true, quantity: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
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

// 🏪 ADMIN: ASSIGN TAVERN + DRIVER
app.patch("/order/:code/assign", requireAdmin, async (req, res) => {
  try {
    const { tavernId, driverName, driverPhone, driverVehicle } = req.body;
    const order = await prisma.order.update({
      where: { code: req.params.code },
      data: { tavernId, driverName, driverPhone, driverVehicle, status: "PENDING" },
      include: { tavern: true },
    });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
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
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
  }
});

// 🗑 ADMIN: DELETE ORDER
app.delete("/order/:code", requireAdmin, async (req, res) => {
  try {
    await prisma.order.delete({ where: { code: req.params.code } });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Order not found" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
