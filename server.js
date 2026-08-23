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

// 🏪 TAVERNS — for the admin assign-order dropdown
app.get("/api/taverns", requireAdmin, async (req, res) => {
  const taverns = await prisma.tavern.findMany();
  res.json(taverns);
});

// 📦 CREATE ORDER
app.post("/order", async (req, res) => {
  try {
    const { address, items, total } = req.body;
    if (!address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "address and items are required" });
    }
    const code = "EKO-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const order = await prisma.order.create({
      data: {
        code,
        address,
        total,
        items: {
          create: items.map((i) => ({
            skuId: i.skuId ?? undefined,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        },
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
