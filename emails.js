// ═══════════════════════════════════════════════
// EKOYINI — Transactional email via Resend
// No-ops silently (logs, doesn't throw) when RESEND_API_KEY isn't set, so
// this is safe to wire into the order flow immediately — email just stays
// off until the key is added in Render, nothing else changes.
// Uses Resend's plain REST API directly (no SDK dependency to install).
// ═══════════════════════════════════════════════

const RESEND_API_URL = "https://api.resend.com/emails";

// Resend's own testing address — works with zero setup (no domain
// verification needed) the moment RESEND_API_KEY is added. Swap
// RESEND_FROM_EMAIL to a verified "orders@yourdomain.com" once you've
// added and verified a domain in the Resend dashboard.
const DEFAULT_FROM = "Ekoyini <onboarding@resend.dev>";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://ekoyini.co.za";

// Every customer-typed value (name, address, phone) and anything else not
// written by us goes through this before landing in email HTML. Without it
// a customer could put markup/links into their "address" and have it
// rendered inside an email that looks like it came from Ekoyini.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend API error ${res.status}:`, body);
    }
  } catch (err) {
    // Email is a courtesy, not a business rule — never let a network hiccup
    // here break an order that has otherwise succeeded.
    console.error("[email] Failed to send:", err);
  }
}

const BRAND = { gold: "#7a5c00", terra: "#cc3700", ivory: "#faf6ee" };

// The one official Ekoyini contact number.
const OFFICIAL_WHATSAPP_NUMBER = "064 004 5465";

function wrapper(bodyHtml) {
  return `
    <div style="background:${BRAND.ivory};padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e8dcc0;">
        <div style="font-family:Georgia,serif;font-weight:700;font-size:20px;color:${BRAND.gold};margin-bottom:20px;">Ekoyini</div>
        ${bodyHtml}
        <p style="font-size:11px;color:#aaa;margin-top:20px;border-top:1px solid #f0ebe0;padding-top:12px;">Questions? WhatsApp us on ${OFFICIAL_WHATSAPP_NUMBER}.</p>
      </div>
    </div>`;
}

async function sendOrderConfirmationEmail(order, customerEmail) {
  if (!customerEmail) return;
  const code = escapeHtml(order.code);
  const itemsHtml = order.items
    .map((i) => `<tr><td style="padding:4px 0;">${escapeHtml(i.name)} × ${Number(i.quantity)}</td><td style="padding:4px 0;text-align:right;">R${(i.price * i.quantity).toFixed(2)}</td></tr>`)
    .join("");
  const html = wrapper(`
    <h1 style="font-size:18px;color:#222;margin:0 0 8px;">Order confirmed</h1>
    <p style="font-size:14px;color:#555;line-height:1.5;">Thanks${order.customerName ? `, ${escapeHtml(order.customerName)}` : ""}! Your order is in — a driver will be matched within 5–10 minutes.</p>
    <div style="background:#f7f4ec;border-radius:8px;padding:14px;margin:16px 0;text-align:center;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Order Code</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:${BRAND.terra};">${code}</div>
    </div>
    <table style="width:100%;font-size:13px;color:#333;border-collapse:collapse;">${itemsHtml}</table>
    <div style="border-top:1px solid #e8dcc0;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;font-weight:700;font-size:14px;">
      <span>Total</span><span>R${order.total.toFixed(2)}</span>
    </div>
    <p style="font-size:12px;color:#888;margin-top:20px;">Delivering to: ${escapeHtml(order.address)}</p>
    <p style="font-size:12px;color:#888;">Track this order any time at ${APP_BASE_URL}/track.html with code ${code}.</p>
  `);
  await sendEmail({ to: customerEmail, subject: `Order confirmed — ${order.code}`, html });
}

function adminEmailList() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

async function sendAdminOrderAlertEmail(order) {
  const adminEmails = adminEmailList();
  if (adminEmails.length === 0) return;
  const html = wrapper(`
    <h1 style="font-size:16px;color:#222;margin:0 0 8px;">New order — ${escapeHtml(order.code)}</h1>
    <p style="font-size:13px;color:#555;">${escapeHtml(order.customerName || "N/A")} · ${escapeHtml(order.customerPhone || "N/A")}</p>
    <p style="font-size:13px;color:#555;">${escapeHtml(order.address)}</p>
    <p style="font-size:13px;color:#555;">Total: <strong>R${order.total.toFixed(2)}</strong> · Payment: <strong>${escapeHtml((order.paymentMethod || "cod").toUpperCase())}</strong></p>
    <p style="font-size:12px;color:#888;margin-top:16px;">Assign it from the admin dashboard.</p>
  `);
  await sendEmail({ to: adminEmails, subject: `New order ${order.code} — R${order.total.toFixed(2)}`, html });
}

async function sendPaymentConfirmedEmail(order, customerEmail) {
  if (!customerEmail) return;
  const code = escapeHtml(order.code);
  const html = wrapper(`
    <h1 style="font-size:18px;color:#222;margin:0 0 8px;">Payment received — packing your order</h1>
    <p style="font-size:14px;color:#555;line-height:1.5;">Thanks${order.customerName ? `, ${escapeHtml(order.customerName)}` : ""}! We've confirmed your EFT payment for order <strong>${code}</strong> — it's being packed now, and a driver will collect it soon.</p>
    <div style="background:#f7f4ec;border-radius:8px;padding:14px;margin:16px 0;text-align:center;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Order Code</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:${BRAND.terra};">${code}</div>
    </div>
    <p style="font-size:12px;color:#888;">Track this order any time at ${APP_BASE_URL}/track.html with code ${code}.</p>
  `);
  await sendEmail({ to: customerEmail, subject: `Payment received — ${order.code} is being packed`, html });
}

async function sendPaymentFailureAlertEmail(pendingCheckout, reason) {
  const adminEmails = adminEmailList();
  if (adminEmails.length === 0) return;
  const html = wrapper(`
    <h1 style="font-size:16px;color:#c00;margin:0 0 8px;">Paid checkout failed to become an order</h1>
    <p style="font-size:13px;color:#555;">Yoco checkout <strong>${escapeHtml(pendingCheckout.yocoCheckoutId)}</strong> was paid (R${(pendingCheckout.amountCents / 100).toFixed(2)} expected) but the order could not be created:</p>
    <p style="font-size:13px;color:#c00;font-weight:700;">${escapeHtml(reason)}</p>
    <p style="font-size:12px;color:#888;margin-top:16px;">Check the Yoco dashboard, then refund or manually create the order and contact the customer.</p>
  `);
  await sendEmail({ to: adminEmails, subject: `⚠ Payment needs attention — ${pendingCheckout.yocoCheckoutId}`, html });
}

module.exports = {
  sendEmail,
  escapeHtml,
  sendOrderConfirmationEmail,
  sendAdminOrderAlertEmail,
  sendPaymentFailureAlertEmail,
  sendPaymentConfirmedEmail,
};
