// Pay one existing order by card with a QR code (Yoco).
//   GET  /pay/:code           what the QR opens: starts a Yoco checkout for the
//                             order's exact total, then sends the customer there
//   GET  /pay/:code/qr.png    the QR image for that link (admin dashboard, print)
//   POST /api/order/:code/pay-check   after paying, confirms with Yoco right away
//                             so the order does not wait for the webhook
// See lib/order-payment.js for what counts as payable.
const QRCode = require("qrcode");
const { payableReason, amountCentsFor, orderPaymentPayload, ORDER_CODE_RE } = require("../lib/order-payment.js");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function messagePage(title, text, base) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)} — Ekoyini</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf6ee;font-family:system-ui,-apple-system,sans-serif;color:#17140e;padding:24px}main{max-width:380px;background:#fff;border-radius:20px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(23,20,14,.1)}h1{font-size:22px;margin:0 0 10px}p{line-height:1.5;margin:0 0 18px}a{display:inline-block;background:#17140e;color:#faf6ee;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(text)}</p><a href="${esc(base)}/track.html">Track an order</a></main></body></html>`;
}

module.exports = function mountPayQr(app, { prisma, writeLimiter, trackLimiter, completePaidCheckout, appBaseUrl, yoco }) {
  app.get("/pay/:code", writeLimiter, async (req, res) => {
    const base = appBaseUrl(req);
    res.set("Cache-Control", "no-store");
    const code = String(req.params.code || "").toUpperCase();
    if (!ORDER_CODE_RE.test(code)) return res.status(404).send(messagePage("Order not found", "Check the code and try again.", base));
    try {
      const order = await prisma.order.findUnique({ where: { code } });
      if (!order) return res.status(404).send(messagePage("Order not found", "Check the code and try again.", base));
      const why = payableReason(order);
      if (why) return res.status(409).send(messagePage("Nothing to pay", why, base));
      if (!yoco.isConfigured()) return res.status(503).send(messagePage("Card payment is not available", "Please pay the driver or ask us on WhatsApp.", base));

      const pending = await prisma.pendingCheckout.create({
        data: {
          userId: order.userId || "qr-payment",
          yocoCheckoutId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          amountCents: amountCentsFor(order),
          payload: orderPaymentPayload(order),
        },
      });
      let checkout;
      try {
        checkout = await yoco.createCheckout({
          amountCents: pending.amountCents,
          currency: "ZAR",
          successUrl: `${base}/track.html?code=${code}&paid=1`,
          cancelUrl: `${base}/track.html?code=${code}`,
          failureUrl: `${base}/track.html?code=${code}&paymentFailed=1`,
          metadata: { pendingCheckoutId: pending.id, orderCode: code },
        });
      } catch (err) {
        await prisma.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});
        throw err;
      }
      await prisma.pendingCheckout.update({ where: { id: pending.id }, data: { yocoCheckoutId: checkout.id } });
      res.redirect(302, checkout.redirectUrl);
    } catch (err) {
      console.error("[pay-qr] Failed to start payment:", err);
      res.status(500).send(messagePage("Something went wrong", "We could not start the payment. Please try again.", base));
    }
  });

  app.get("/pay/:code/qr.png", trackLimiter, async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    if (!ORDER_CODE_RE.test(code)) return res.status(404).end();
    try {
      const png = await QRCode.toBuffer(`${appBaseUrl(req)}/pay/${code}`, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 600, color: { dark: "#17140e", light: "#ffffff" } });
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      res.send(png);
    } catch (err) {
      console.error("[pay-qr] QR failed:", err);
      res.status(500).end();
    }
  });

  // The customer is back from Yoco: settle any unsettled payment for this
  // order now instead of waiting for the webhook.
  app.post("/api/order/:code/pay-check", trackLimiter, async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    if (!ORDER_CODE_RE.test(code)) return res.status(404).json({ error: "Order not found" });
    try {
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const waiting = await prisma.pendingCheckout.findMany({
        where: { status: "PENDING", createdAt: { gt: since }, payload: { contains: `"orderCode":"${code}"` } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      let paid = false;
      for (const pending of waiting) {
        if ((await completePaidCheckout(pending, "pay-check")) === "COMPLETED") { paid = true; break; }
      }
      res.json({ paid });
    } catch (err) {
      console.error("[pay-qr] pay-check failed:", err);
      res.status(500).json({ error: "Could not check the payment" });
    }
  });
};
