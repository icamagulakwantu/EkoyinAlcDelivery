// ═══════════════════════════════════════════════
// EKOYINI — Card payments via Yoco Online Checkout
//
// Checked against Yoco's developer docs (Nov 2026): POST /api/checkouts, the
// payment.succeeded event (checkout id in payload.metadata.checkoutId) and
// Standard Webhooks signing. The webhook still re-fetches the checkout from
// Yoco's API before trusting anything. Do one small real payment after
// switching to live keys and check the server logs.
// ═══════════════════════════════════════════════

const crypto = require("crypto");

// Overridable only for local testing against a stand-in; production uses Yoco.
const YOCO_API_BASE = process.env.YOCO_API_BASE || "https://payments.yoco.com/api";

function isYocoConfigured() {
  return !!process.env.YOCO_SECRET_KEY;
}

async function createYocoCheckout({ amountCents, currency, successUrl, cancelUrl, failureUrl, metadata }) {
  const res = await fetch(`${YOCO_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: currency || "ZAR",
      successUrl,
      cancelUrl,
      failureUrl,
      metadata,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[yoco] createCheckout failed:", res.status, data);
    throw new Error(data?.message || "Failed to start card checkout");
  }
  const redirectUrl = data.redirectUrl || data.redirect_url || data.paymentUrl;
  if (!data.id || !redirectUrl) {
    console.error("[yoco] createCheckout returned unexpected shape:", data);
    throw new Error("Unexpected response from Yoco");
  }
  return { id: data.id, redirectUrl };
}

// Re-fetches a checkout's current status directly from Yoco — the only
// thing this integration actually trusts for "was this paid".
async function getYocoCheckout(checkoutId) {
  const res = await fetch(`${YOCO_API_BASE}/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[yoco] getCheckout failed:", res.status, data);
    throw new Error("Failed to look up checkout status");
  }
  return data;
}

function checkoutLooksPaid(checkout) {
  const status = (checkout.status || checkout.state || "").toString().toLowerCase();
  return status === "succeeded" || status === "completed" || status === "paid";
}

// Reads the amount Yoco says was actually charged, in cents. Returns null
// if the field can't be found — the webhook treats that as "needs a human
// to check", never as "looks fine", so an unexpected response shape can't
// silently let a wrong amount through.
function extractPaidAmountCents(checkout) {
  const raw = checkout?.amount ?? checkout?.totalAmount ?? checkout?.amountInCents;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function extractCurrency(checkout) {
  const c = checkout?.currency;
  return typeof c === "string" ? c.toUpperCase() : null;
}

// Yoco signs webhooks the same way Svix / "Standard Webhooks" does:
//   signed_content = `${webhookId}.${webhookTimestamp}.${rawBody}`
//   signature       = base64(HMAC-SHA256(secretBytes, signed_content))
function verifyYocoWebhookSignature(headers, rawBody) {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret) return false;

  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];
  if (!id || !timestamp || !signatureHeader) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  return signatureHeader
    .split(" ")
    .map((v) => v.split(",")[1])
    .filter(Boolean)
    .some((sig) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false;
      }
    });
}

// Yoco's Checkout API sends { id, type, createdDate, payload }. payload.id is
// the PAYMENT id (p_...), not the checkout id: the checkout id is in
// payload.metadata.checkoutId. Reading payload.id would never match one of our
// PendingCheckout rows, so a customer could pay and no order would be created.
function extractCheckoutId(event) {
  return event?.payload?.metadata?.checkoutId || null;
}

// Only payment.succeeded creates an order. This webhook also receives
// payment.failed, refund.* and every other payment on the Yoco account.
function isPaymentSucceededEvent(event) {
  return event?.type === "payment.succeeded";
}

// "live" or "test", from the secret key in use, so a test-mode event can never
// create an order on a live key (or the other way round).
function yocoKeyMode() {
  const key = process.env.YOCO_SECRET_KEY || "";
  if (key.startsWith("sk_live")) return "live";
  if (key.startsWith("sk_test")) return "test";
  return null;
}

module.exports = {
  isYocoConfigured,
  createYocoCheckout,
  getYocoCheckout,
  checkoutLooksPaid,
  extractPaidAmountCents,
  extractCurrency,
  verifyYocoWebhookSignature,
  extractCheckoutId,
  isPaymentSucceededEvent,
  yocoKeyMode,
};
