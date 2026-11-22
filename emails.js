// ═══════════════════════════════════════════════
// EKOYINI — Transactional email via Resend
// No-ops silently (logs, doesn't throw) when RESEND_API_KEY isn't set, so
// this is safe to wire into the order flow immediately — email just stays
// off until the key is added in Render, nothing else changes.
// Uses Resend's plain REST API directly (no SDK dependency to install).
// ═══════════════════════════════════════════════

const { buildReceipt, renderReceiptHtml } = require("./public/receipt.js");
const { getEftDetails, spaced } = require("./lib/eft-details.js");

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

// The receipt for an order, with every fee and every time stamp (founder, 22 Nov 2026). Sent when the order is
// placed (order time) and again when the driver confirms delivery (delivery time).
// Banking details for an EFT order that is waiting for payment (22 Nov 2026); empty for every other order.
function eftEmailBlock(order) {
  if (!order || order.paymentMethod !== "eft" || order.status !== "PAYMENT_PENDING") return "";
  const b = getEftDetails();
  if (!b) return `<p style="font-size:14px;color:#555;line-height:1.5;"><strong>Next: pay by EFT.</strong> Our team will WhatsApp you the banking details. Use <strong>${escapeHtml(order.code)}</strong> as the payment reference.</p>`;
  const r = (label, value) => `<tr><td style="padding:6px 0;color:#888;font-size:12px;">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:14px;">${escapeHtml(value)}</td></tr>`;
  return `<div style="border:2px solid #17140e;border-radius:10px;padding:14px;margin:0 0 16px;">
    <div style="font-weight:800;margin-bottom:6px;">Pay by EFT, then we start packing</div>
    <table style="width:100%;border-collapse:collapse;">
      ${r("Amount", "R" + Number(order.total || 0).toFixed(2))}
      ${r("Bank", b.bankName)}
      ${r("Account name", b.accountName)}
      ${r("Account number", spaced(b.accountNumber))}
      ${r("Branch code", b.branchCode)}
      ${r("Account type", b.accountType)}
      ${r("Reference (important)", order.code)}
    </table>
    <div style="font-size:12px;color:#666;margin-top:8px;line-height:1.4;">Use the reference exactly so we can match your payment. Only pay into the account in this email or on your order page. We never change banking details by WhatsApp or phone.</div>
  </div>`;
}

async function sendOrderConfirmationEmail(order, customerEmail) {
  if (!customerEmail) return;
  const code = escapeHtml(order.code);
  const waitingForEft = order.paymentMethod === "eft" && order.status === "PAYMENT_PENDING";
  const receipt = buildReceipt(order);
  const link = `${APP_BASE_URL.replace(/\/$/, "")}/receipt.html?code=${encodeURIComponent(order.code)}`;
  const html = wrapper(`
    <h1 style="font-size:18px;color:#222;margin:0 0 8px;">${waitingForEft ? "Order received, waiting for your EFT" : "Order confirmed"}</h1>
    <p style="font-size:14px;color:#555;line-height:1.5;">Thanks${order.customerName ? `, ${escapeHtml(order.customerName)}` : ""}! ${waitingForEft ? "We have saved your order and reserved your drinks. Once your payment shows in our account we pack it and match a driver." : "Your order is in — a driver will be matched within 5–10 minutes."} Keep this receipt: it shows what you ordered and when.</p>
    ${eftEmailBlock(order)}
    ${order.deliveryPin ? `<div style="border:2px dashed ${BRAND.terra};border-radius:8px;padding:12px;margin:0 0 16px;text-align:center;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your delivery PIN</div>
      <div style="font-family:monospace;font-size:26px;font-weight:700;letter-spacing:6px;">${escapeHtml(order.deliveryPin)}</div>
      <div style="font-size:12px;color:#666;">Give it to the driver only when you have your drinks in hand.</div>
    </div>` : ""}
    ${renderReceiptHtml(receipt, { link })}
    <p style="font-size:12px;color:#888;margin-top:20px;">Track this order any time at ${APP_BASE_URL}/track.html with code ${code}.</p>
  `);
  await sendEmail({ to: customerEmail, subject: waitingForEft ? `Pay by EFT to start your order — ${order.code}` : `Order confirmed — ${order.code}`, html });
}

// The final receipt, sent the moment the driver confirms delivery: proof of the order, the order time and the
// delivery time. `order` must include items (and the tavern, for the outlet name).
async function sendDeliveryReceiptEmail(order) {
  if (!order || !order.customerEmail) return;
  const receipt = buildReceipt(order);
  const link = `${APP_BASE_URL.replace(/\/$/, "")}/receipt.html?code=${encodeURIComponent(order.code)}`;
  const html = wrapper(`
    <h1 style="font-size:18px;color:#222;margin:0 0 8px;">Your order was delivered</h1>
    <p style="font-size:14px;color:#555;line-height:1.5;">Thanks${order.customerName ? `, ${escapeHtml(order.customerName)}` : ""}! Here is your final receipt with the order time and the delivery time. Please keep it as proof of your order.</p>
    ${renderReceiptHtml(receipt, { link })}
  `);
  await sendEmail({ to: order.customerEmail, subject: `Your Ekoyini receipt — ${order.code} (delivered ${receipt.deliveredAt})`, html });
}

function adminEmailList() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// Who hears about new orders: ORDER_ALERT_EMAILS (the dispatch team, any
// number of people, no admin rights needed), else the ADMIN_EMAILS list.
function orderAlertEmailList() {
  const team = (process.env.ORDER_ALERT_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  return team.length ? team : adminEmailList();
}

const PAYMENT_LABELS = { card: "Paid by card", cod: "Cash on delivery", eft: "EFT" };

async function sendAdminOrderAlertEmail(order) {
  const adminEmails = orderAlertEmailList();
  if (adminEmails.length === 0) return;
  const parts = String(order.address || "").split(",").map((p) => p.trim()).filter(Boolean);
  const area = (parts.length > 1 ? parts[parts.length - 1] : "").replace(/^\d+[a-z]?\s+/i, "").trim();
  const payment = order.status === "PAYMENT_PENDING" ? "EFT, waiting for payment" : (PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod);
  const dashboard = `${(process.env.APP_BASE_URL || "https://www.ekoyini.co.za").replace(/\/$/, "")}/admin/admin.html`;
  const html = wrapper(`
    <h1 style="font-size:16px;color:#222;margin:0 0 8px;">New order — ${escapeHtml(order.code)}</h1>
    <p style="font-size:13px;color:#555;">${escapeHtml(order.customerName || "N/A")} · ${escapeHtml(order.customerPhone || "N/A")}</p>
    <p style="font-size:13px;color:#555;">${escapeHtml(order.address)}</p>
    <p style="font-size:13px;color:#555;">Total: <strong>R${order.total.toFixed(2)}</strong> · <strong>${escapeHtml(payment)}</strong></p>
    <p style="font-size:13px;color:#555;">${(order.items || []).map((i) => `${escapeHtml(i.name)} × ${Number(i.quantity)}`).join("<br>")}</p>
    <p style="margin:18px 0 6px;"><a href="${dashboard}" style="background:#ff4500;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;font-size:13px;">Open the dashboard</a></p>
    <p style="font-size:12px;color:#888;margin-top:12px;">Post it to the drivers group, then assign the driver who accepts.</p>
  `);
  await sendEmail({ to: adminEmails, subject: `New order ${order.code}: R${order.total.toFixed(2)}, ${area || "see address"}, ${payment}`, html });
}

async function sendPaymentConfirmedEmail(order, customerEmail, { method = "eft" } = {}) {
  if (!customerEmail) return;
  const how = method === "card" ? "card payment" : "EFT payment";
  const code = escapeHtml(order.code);
  const html = wrapper(`
    <h1 style="font-size:18px;color:#222;margin:0 0 8px;">Payment received — packing your order</h1>
    <p style="font-size:14px;color:#555;line-height:1.5;">Thanks${order.customerName ? `, ${escapeHtml(order.customerName)}` : ""}! We've confirmed your ${how} for order <strong>${code}</strong> — it's being packed now, and a driver will collect it soon.</p>
    <div style="background:#f7f4ec;border-radius:8px;padding:14px;margin:16px 0;text-align:center;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Order Code</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:${BRAND.terra};">${code}</div>
    </div>
    <p style="font-size:12px;color:#888;">Track this order any time at ${APP_BASE_URL}/track.html with code ${code}.</p>
  `);
  await sendEmail({ to: customerEmail, subject: `Payment received — ${order.code} is being packed`, html });
}

// Sent automatically when the driver collects the order: the live tracking link, no driver tap needed.
async function sendOutForDeliveryEmail(order) {
  if (!order || !order.customerEmail) return;
  const code = escapeHtml(order.code);
  const link = `${APP_BASE_URL.replace(/\/$/, "")}/track.html?code=${encodeURIComponent(order.code)}`;
  const driver = order.driverName ? escapeHtml(String(order.driverName).trim().split(/\s+/)[0]) : "Your driver";
  const html = wrapper(`
    <h1 style="font-size:18px;color:#222;margin:0 0 8px;">Your order is on its way</h1>
    <p style="font-size:14px;color:#555;line-height:1.5;">${driver} has collected order <strong>${code}</strong> and is heading to you. Follow the driver live on the map:</p>
    <p style="text-align:center;margin:18px 0;"><a href="${link}" style="display:inline-block;background:#17140e;color:#faf6ee;padding:13px 22px;border-radius:999px;font-weight:700;text-decoration:none;">Follow my order live</a></p>
    <p style="font-size:13px;color:#555;line-height:1.5;">Please have your ID ready (18+) and your 4-digit delivery PIN. It is in your order confirmation email and on your tracking page. Give the PIN to the driver only at your gate.</p>
  `);
  await sendEmail({ to: order.customerEmail, subject: `Your Ekoyini order ${order.code} is on its way`, html });
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

// 12:00 daily payout summary (founder, 11 Nov 2026). p = lib/payouts.js result.
async function sendPayoutSummaryEmail(day, p) {
  const to = orderAlertEmailList();
  if (!to.length) return;
  const R = (n) => `R${Number(n || 0).toFixed(2)}`;
  const row = (name, phone, amount, note) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ebe0">${escapeHtml(name)}<br><span style="color:#999;font-size:12px">${escapeHtml(phone || '')}${note ? ' · ' + escapeHtml(note) : ''}</span></td><td style="padding:6px 0;border-bottom:1px solid #f0ebe0;text-align:right;font-weight:700">${R(amount)}</td></tr>`;
  const drivers = p.drivers.map((d) => row(d.name, d.phone, d.owed, d.owed < 0 ? `owes Ekoyini (holds ${R(d.cashCollected)} cash)` : `${d.orders.length} deliveries`)).join('');
  const taverns = p.taverns.map((t) => row(t.name, t.phone, t.owed, `${t.orders.length} orders`)).join('');
  const html = wrapper(`
    <h2 style="font-size:18px;margin:0 0 6px">Payouts for ${escapeHtml(day)}</h2>
    <p style="color:#666;font-size:14px;margin:0 0 16px">${p.totals.orders} delivered orders · sales ${R(p.totals.sales)} · Ekoyini keeps ${R(p.totals.ekoyini)} after Yoco fees.</p>
    <h3 style="font-size:15px;margin:16px 0 4px">Drivers (pay today)</h3>
    <table style="width:100%;font-size:14px;border-collapse:collapse">${drivers || '<tr><td style="color:#999">No driver payouts</td></tr>'}</table>
    <h3 style="font-size:15px;margin:16px 0 4px">Taverns (pay today)</h3>
    <table style="width:100%;font-size:14px;border-collapse:collapse">${taverns || '<tr><td style="color:#999">No tavern payouts</td></tr>'}</table>
    ${p.unassigned.length ? `<p style="color:#b45309;font-size:13px">Orders with no tavern or driver recorded: ${escapeHtml(p.unassigned.join(', '))}</p>` : ''}
    <p style="font-size:13px;margin-top:16px">Pay from your banking app, then tap <b>Mark as paid</b> in Admin → Payouts.</p>`);
  await sendEmail({ to, subject: `Ekoyini payouts for ${day}: drivers ${R(p.totals.toDrivers)}, taverns ${R(p.totals.toTaverns)}`, html });
}

// Delay alerts (18 Nov 2026). items: [{ order, alert }] from routes/dispatch-alerts.js.
async function sendDispatchAlertEmail(items) {
  const to = orderAlertEmailList();
  if (!to.length || !items.length) return;
  const reds = items.filter((x) => x.alert.level === "red").length;
  const rows = items.map(({ order, alert }) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0ebe0"><b>${escapeHtml(order.code)}</b><br><span style="color:#999;font-size:12px">${escapeHtml(order.tavern?.name || "no tavern")} · ${escapeHtml(order.driverName || "no driver")}</span></td>
      <td style="padding:6px 0;border-bottom:1px solid #f0ebe0;color:${alert.level === "red" ? "#b91c1c" : "#b45309"};font-weight:700">${escapeHtml(alert.text)}<br><span style="font-weight:400;font-size:12px">${alert.minutes} min</span></td>
    </tr>`).join("");
  const html = wrapper(`
    <h2 style="font-size:18px;margin:0 0 6px">${reds ? "Urgent: " : ""}${items.length} order${items.length === 1 ? "" : "s"} need attention</h2>
    <table style="width:100%;font-size:14px;border-collapse:collapse">${rows}</table>
    <p style="font-size:13px;margin-top:14px">Open Admin to act: assign a driver, call the tavern or call the driver.</p>`);
  await sendEmail({ to, subject: `${reds ? "URGENT " : ""}Ekoyini: ${items.length} order${items.length === 1 ? "" : "s"} delayed (${items.map((x) => x.order.code).join(", ")})`, html });
}

module.exports = {
  sendDispatchAlertEmail,
  sendPayoutSummaryEmail,
  sendEmail,
  escapeHtml,
  sendOrderConfirmationEmail,
  sendDeliveryReceiptEmail,
  sendOutForDeliveryEmail,
  sendAdminOrderAlertEmail,
  sendPaymentFailureAlertEmail,
  sendPaymentConfirmedEmail,
};
