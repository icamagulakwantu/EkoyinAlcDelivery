// Phone and computer alerts for the dispatch team (web push, 19 Nov 2026).
//
// Every admin who taps "Turn on order alerts" on a device (phone or
// computer) saves a push subscription. When an order arrives, or an order
// sits still too long, the server sends a notification to every saved
// device of every CURRENT admin. It rings even when the dashboard tab is
// closed or the phone is in another app. Email stays as the backup.
//
// Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (Render). Without them every
// function here quietly does nothing, so the app never breaks over alerts.
//
// Notifications show the area only, never the customer's name, phone or
// street address: they can appear on a lock screen.

const PAYMENT_LABELS = { card: "Paid by card", cod: "Cash on delivery", eft: "EFT" };

// Push services the browsers use. Subscriptions pointing anywhere else are
// refused so the server can never be made to call an arbitrary address.
const PUSH_HOST_SUFFIXES = [
  "googleapis.com", // Chrome, Edge, Opera, Samsung Internet (FCM)
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari and iPhone home-screen apps
  "notify.windows.com", // Edge on Windows (WNS)
];

function isPushEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 2000) return false;
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
}

// Driver phones share the PushSubscription table (no extra table needed): their
// "adminEmail" is "driver:<driver id>". Admin alerts must never go to, or clean up, them.
const DRIVER_KEY_PREFIX = "driver:";
const isDriverKey = (key) => typeof key === "string" && key.startsWith(DRIVER_KEY_PREFIX);
// Tavern portal phones (21 Nov 2026) are saved the same way, as "tavern:<tavern id>".
const TAVERN_KEY_PREFIX = "tavern:";
const isTavernKey = (key) => typeof key === "string" && key.startsWith(TAVERN_KEY_PREFIX);

// Customers who allowed order updates on their tracking page (22 Nov 2026): "customer:<order code>".
const CUSTOMER_KEY_PREFIX = "customer:";
const isCustomerKey = (key) => typeof key === "string" && key.startsWith(CUSTOMER_KEY_PREFIX);

function isConfigured(env = process.env) {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function areaOf(address) {
  const parts = String(address || "").split(",").map((p) => p.trim()).filter(Boolean);
  const last = (parts.length > 1 ? parts[parts.length - 1] : "").replace(/^\d+[a-z]?\s+/i, "").trim();
  return last || "area on the order";
}

const money = (n) => "R" + Number(n || 0).toFixed(2);

function newOrderPayload(order) {
  const pay = order.status === "PAYMENT_PENDING"
    ? "EFT, waiting for payment"
    : (PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || "");
  return {
    title: `New order ${order.code}`,
    body: [money(order.total), areaOf(order.address), pay].filter(Boolean).join(" · "),
    tag: "new-order",
    url: "/admin/admin.html",
    urgent: true,
  };
}

// items: [{ order, alert }] from routes/dispatch-alerts.js.
function dispatchPayload(items) {
  const reds = items.filter((x) => x.alert.level === "red").length;
  const lines = items.slice(0, 3).map((x) => `${x.order.code}: ${x.alert.text} (${x.alert.minutes} min)`);
  if (items.length > 3) lines.push(`+${items.length - 3} more`);
  return {
    title: `${reds ? "URGENT: " : ""}${items.length} order${items.length === 1 ? "" : "s"} need attention`,
    body: lines.join("\n"),
    tag: "dispatch-alert",
    url: "/admin/admin.html",
    urgent: reds > 0,
  };
}

// prisma: the app's client. webpush: the web-push module (injected so tests
// can fake it). isAdmin(email): true while that person is still an admin.
function createPusher({ prisma, webpush, isAdmin, env = process.env, log = console }) {
  let ready = false;

  function init() {
    if (ready) return true;
    if (!isConfigured(env)) return false;
    webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:support@ekoyini.co.za", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    ready = true;
    return true;
  }

  // Returns "ok", "gone" (the device unsubscribed: delete it) or "failed".
  async function sendOne(sub, payload) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 3600, urgency: "high", timeout: 10000 }
      );
      return "ok";
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) return "gone";
      log.error("[push] send failed:", err && (err.statusCode || err.message));
      return "failed";
    }
  }

  async function dropSubs(ids) {
    if (!ids.length) return;
    await prisma.pushSubscription.deleteMany({ where: { id: { in: ids } } });
  }

  // Every saved device of every current admin. Devices of people who are no
  // longer admins are removed.
  async function sendToAdmins(payload) {
    if (!init()) return { sent: 0, removed: 0, skipped: true };
    const subs = (await prisma.pushSubscription.findMany()).filter((x) => !isDriverKey(x.adminEmail) && !isTavernKey(x.adminEmail) && !isCustomerKey(x.adminEmail));
    const verdict = new Map();
    for (const email of new Set(subs.map((s) => s.adminEmail))) {
      verdict.set(email, await isAdmin(email));
    }
    const stale = subs.filter((s) => !verdict.get(s.adminEmail)).map((s) => s.id);
    const live = subs.filter((s) => verdict.get(s.adminEmail));
    const results = await Promise.all(live.map((s) => sendOne(s, payload)));
    const gone = live.filter((_, i) => results[i] === "gone").map((s) => s.id);
    await dropSubs([...stale, ...gone]);
    return { sent: results.filter((r) => r === "ok").length, removed: stale.length + gone.length };
  }

  // One device only (the "alerts are on" confirmation).
  async function sendToSubscription(sub, payload) {
    if (!init()) return "skipped";
    const r = await sendOne(sub, payload);
    if (r === "gone" && sub.id) await dropSubs([sub.id]);
    return r;
  }

  async function notifyNewOrder(order) {
    try { return await sendToAdmins(newOrderPayload(order)); } catch (err) { log.error("[push] new order alert failed:", err); return null; }
  }
  async function notifyDispatchAlerts(items) {
    if (!items || !items.length) return null;
    try { return await sendToAdmins(dispatchPayload(items)); } catch (err) { log.error("[push] dispatch alert failed:", err); return null; }
  }

  return { isEnabled: () => isConfigured(env), sendToAdmins, sendToSubscription, notifyNewOrder, notifyDispatchAlerts };
}

module.exports = { CUSTOMER_KEY_PREFIX, isCustomerKey, DRIVER_KEY_PREFIX, isDriverKey, TAVERN_KEY_PREFIX, isTavernKey, createPusher, isPushEndpoint, isConfigured, newOrderPayload, dispatchPayload, areaOf, PUSH_HOST_SUFFIXES };
