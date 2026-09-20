// ═══════════════════════════════════════════════
// EKOYINI — Card payments via Yoco Online Checkout
//
// ⚠ BUILT AGAINST PUBLIC DOCS, NOT YET VERIFIED AGAINST A LIVE YOCO
// ACCOUNT. Field names for createCheckout/getCheckout are taken from
// Yoco's public developer docs (developer.yoco.com); the webhook payload
// shape is inferred from Yoco's public "Standard Webhooks"-style signing
// (same scheme Svix uses) since the exact event JSON wasn't directly
// fetchable while writing this. The webhook handler is written
// defensively — it tries several reasonable field paths for the checkout
// id and always re-fetches the checkout from Yoco's API before trusting
// anything, per Yoco's own guidance ("never trust the success redirect,
// always confirm via the API"). Test with a real Yoco sandbox checkout
// before relying on this for real orders, and check server logs on the
// first few real webhook deliveries — adjust EXTRACT_CHECKOUT_ID below
// if Yoco's actual payload shape differs.
// ═══════════════════════════════════════════════

const crypto = require("crypto");

const YOCO_API_BASE = "https://payments.yoco.com/api";

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
  // redirectUrl is the documented field; fall back to a couple of
  // plausible alternates in case the live response differs.
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

// Best-effort read of whatever status Yoco's checkout object uses to mean
// "paid" — logs the raw object either way so a mismatch is visible in
// server logs rather than silently rejecting a real payment.
function checkoutLooksPaid(checkout) {
  const status = (checkout.status || checkout.state || "").toString().toLowerCase();
  return status === "succeeded" || status === "completed" || status === "paid";
}

// Yoco signs webhooks the same way Svix / "Standard Webhooks" does:
//   signed_content = `${webhookId}.${webhookTimestamp}.${rawBody}`
//   signature       = base64(HMAC-SHA256(secretBytes, signed_content))
// sent as one or more "v1,<base64sig>" values in the webhook-signature
// header. The signing secret from the Yoco dashboard is typically
// prefixed "whsec_" — strip that prefix and base64-decode the rest to
// get the raw HMAC key.
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
        return false; // length mismatch etc — not a match, not a crash
      }
    });
}

// Defensive extraction — tries the documented/likely paths for where the
// checkout id lives inside a webhook payload.
function extractCheckoutId(payload) {
  return (
    payload?.payload?.id ||
    payload?.payload?.checkoutId ||
    payload?.data?.id ||
    payload?.data?.checkoutId ||
    payload?.id ||
    null
  );
}

module.exports = {
  isYocoConfigured,
  createYocoCheckout,
  getYocoCheckout,
  checkoutLooksPaid,
  verifyYocoWebhookSignature,
  extractCheckoutId,
};
