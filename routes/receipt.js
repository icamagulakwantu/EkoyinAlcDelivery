// Receipts (founder, 22 Nov 2026). A customer can open and print the receipt for their own order: what they bought,
// every fee, the time they ordered and the time the driver delivered it. Only the customer who placed the order.
const { buildReceipt } = require("../public/receipt.js");

module.exports = function mountReceipt(app, { prisma, requireUser }) {
  app.get("/api/order/:code/receipt", requireUser, async (req, res) => {
    try {
      const order = await prisma.order.findUnique({ where: { code: req.params.code }, include: { items: true, tavern: true } });
      if (!order || order.userId !== req.user.id) return res.status(404).json({ error: "Order not found" });
      res.set("Cache-Control", "no-store").json({ receipt: buildReceipt(order) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your receipt" });
    }
  });
};
