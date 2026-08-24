require("dotenv").config();

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(express.static("public"));
app.use(express.json());

// ── Simple admin auth stopgap ──────────────────────────────
// TODO Track B step 3: replace with real Supabase Auth session checks.
// Until then, admin routes require a shared token set in ADMIN_API_TOKEN.
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

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

// 📦 CREATE ORDER (customer, auth-gated)
// Only skuId + quantity + purchaseType come from the client — every price
// is recomputed here from the current DB values. This closes the exploit
// where an editable price field on the client could set its own total.
app.post("/order", requireUser, async (req, res) => {
  try {
    const { address, items, customerName, customerPhone, paymentMethod } = req.body;
    if (!address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "address and items are required" });
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
    const delivery = subtotal > 200 ? 0 : 50;
    const total = Math.round((subtotal - coolerDiscount + delivery) * 100) / 100;

    const code = "EKO-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const order = await prisma.order.create({
      data: {
        code,
        userId: req.user.id,
        address,
        customerName,
        customerPhone,
        paymentMethod: paymentMethod || "cod",
        total,
        items: { create: orderItems },
      },
      include: { items: true },
    });
    console.log("New order:", order.code);
    res.json({ message: "Order received", order });
  } catch (err) {
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
