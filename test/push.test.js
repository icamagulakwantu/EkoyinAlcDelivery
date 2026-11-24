// Closed-app order alerts (web push): who gets them, what they show, and
// that they can never break or leak anything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPusher, isPushEndpoint, newOrderPayload, dispatchPayload } = require('../lib/push.js');

const quiet = { error() {} };
const env = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' };

function fakeDb(subs) {
  const rows = subs.map((s, i) => ({ id: 's' + i, p256dh: 'k', auth: 'a', ...s }));
  return {
    rows,
    pushSubscription: {
      findMany: async () => rows.slice(),
      deleteMany: async ({ where }) => {
        for (const id of where.id.in) { const i = rows.findIndex((r) => r.id === id); if (i >= 0) rows.splice(i, 1); }
      },
    },
  };
}

function fakeWebpush(failures = {}) {
  const sent = [];
  return {
    sent,
    setVapidDetails() {},
    async sendNotification(sub, body) {
      sent.push({ endpoint: sub.endpoint, body: JSON.parse(body) });
      const code = failures[sub.endpoint];
      if (code) { const e = new Error('push failed'); e.statusCode = code; throw e; }
    },
  };
}

const order = {
  code: 'EKO-ABC12345', total: 438.53, status: 'PAYMENT_PENDING', paymentMethod: 'eft',
  address: '4 Blo Road, Motherwell NU10', customerName: 'Sipho Dlamini', customerPhone: '+27810000000',
};

test('new-order alert shows code, total, area and payment, and nothing private', () => {
  const p = newOrderPayload(order);
  assert.equal(p.title, 'New order EKO-ABC12345');
  assert.equal(p.body, 'R438.53 · Motherwell NU10 · EFT, waiting for payment');
  const all = JSON.stringify(p);
  for (const secret of ['Sipho', 'Dlamini', '27810000000', 'Blo Road']) assert.ok(!all.includes(secret), secret + ' must not be in a lock-screen alert');
});

test('card and cash orders say how they are paid', () => {
  assert.match(newOrderPayload({ ...order, status: 'PENDING', paymentMethod: 'card' }).body, /Paid by card/);
  assert.match(newOrderPayload({ ...order, status: 'PENDING', paymentMethod: 'cod' }).body, /Cash on delivery/);
});

test('delay alerts are urgent only when something is red', () => {
  const amber = { order: { code: 'EKO-1' }, alert: { level: 'amber', text: 'Paid but no driver assigned', minutes: 12 } };
  const red = { order: { code: 'EKO-2' }, alert: { level: 'red', text: 'Out for delivery too long', minutes: 95 } };
  assert.equal(dispatchPayload([amber]).urgent, false);
  assert.equal(dispatchPayload([amber, red]).urgent, true);
  assert.match(dispatchPayload([amber, red]).title, /^URGENT: 2 orders need attention$/);
  assert.match(dispatchPayload([amber]).body, /EKO-1: Paid but no driver assigned \(12 min\)/);
});

test('without VAPID keys nothing is sent and nothing breaks', async () => {
  const wp = fakeWebpush();
  const pusher = createPusher({ prisma: fakeDb([{ endpoint: 'https://fcm.googleapis.com/x', adminEmail: 'a@x.co.za' }]), webpush: wp, isAdmin: async () => true, env: {}, log: quiet });
  assert.equal(pusher.isEnabled(), false);
  const r = await pusher.notifyNewOrder(order);
  assert.equal(r.skipped, true);
  assert.equal(wp.sent.length, 0);
});

test('every device of every current admin is alerted; removed admins and dead devices are dropped', async () => {
  const db = fakeDb([
    { endpoint: 'https://fcm.googleapis.com/phone', adminEmail: 'boss@x.co.za' },
    { endpoint: 'https://fcm.googleapis.com/laptop', adminEmail: 'boss@x.co.za' },
    { endpoint: 'https://web.push.apple.com/iphone', adminEmail: 'dispatch@x.co.za' },
    { endpoint: 'https://fcm.googleapis.com/ex-admin', adminEmail: 'left@x.co.za' },
    { endpoint: 'https://fcm.googleapis.com/dead', adminEmail: 'boss@x.co.za' },
  ]);
  const wp = fakeWebpush({ 'https://fcm.googleapis.com/dead': 410 });
  const pusher = createPusher({ prisma: db, webpush: wp, isAdmin: async (e) => e !== 'left@x.co.za', env, log: quiet });
  const r = await pusher.notifyNewOrder(order);
  assert.deepEqual(wp.sent.map((s) => s.endpoint).sort(), [
    'https://fcm.googleapis.com/dead', 'https://fcm.googleapis.com/laptop', 'https://fcm.googleapis.com/phone', 'https://web.push.apple.com/iphone',
  ]);
  assert.equal(r.sent, 3);
  assert.equal(r.removed, 2);
  assert.deepEqual(db.rows.map((s) => s.endpoint).sort(), [
    'https://fcm.googleapis.com/laptop', 'https://fcm.googleapis.com/phone', 'https://web.push.apple.com/iphone',
  ]);
});

test('a temporary push-service error keeps the device and never throws', async () => {
  const db = fakeDb([{ endpoint: 'https://fcm.googleapis.com/phone', adminEmail: 'boss@x.co.za' }]);
  const pusher = createPusher({ prisma: db, webpush: fakeWebpush({ 'https://fcm.googleapis.com/phone': 500 }), isAdmin: async () => true, env, log: quiet });
  const r = await pusher.notifyNewOrder(order);
  assert.equal(r.sent, 0);
  assert.equal(db.rows.length, 1);
});

test('a crash while sending is swallowed so the order itself is never affected', async () => {
  const db = { pushSubscription: { findMany: async () => { throw new Error('database down'); } } };
  const pusher = createPusher({ prisma: db, webpush: fakeWebpush(), isAdmin: async () => true, env, log: quiet });
  assert.equal(await pusher.notifyNewOrder(order), null);
});

test('only real browser push services are accepted as device addresses', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) assert.equal(isPushEndpoint(ok), true, ok);
  for (const bad of [
    'http://fcm.googleapis.com/x', // not https
    'https://evil.example.com/x',
    'https://fcm.googleapis.com.evil.com/x', // look-alike host
    'https://user:pw@fcm.googleapis.com/x',
    'https://localhost/x',
    'https://169.254.169.254/latest',
    'not a url', '', null, undefined, 42,
  ]) assert.equal(isPushEndpoint(bad), false, String(bad));
});

test('the service worker rings for pushes and opens the dashboard on tap', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.match(sw, /ekoyini-shell-v56/);
});

// ── who has alerts on, and the test ring (22 Nov 2026) ──
const express = require('express');

async function pushApp({ rows, role = 'SUPER_ADMIN', enabled = true }) {
  const sentTo = [];
  const app = express(); app.use(express.json());
  require('../routes/push.js')(app, {
    prisma: { pushSubscription: { findMany: async () => rows } },
    requireAdmin: (q, s, n) => n(),
    requireSuperAdmin: (q, s, n) => (role === 'SUPER_ADMIN' ? n() : s.status(403).json({ error: 'no' })),
    writeLimiter: (q, s, n) => n(),
    logAdminAction: async () => {},
    push: { isEnabled: () => enabled, sendToAdmins: async (p) => { sentTo.push(p); return { sent: 3 }; } },
  });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const call = async (m, u) => { const res = await fetch(`http://127.0.0.1:${server.address().port}${u}`, { method: m, headers: { 'Content-Type': 'application/json' }, body: m === 'GET' ? undefined : '{}' }); return { status: res.status, body: await res.json() }; };
  return { call, sentTo, close: () => server.close() };
}

test('super-admin sees how many devices ring per person, never drivers or taverns', async () => {
  const t = await pushApp({ rows: [{ adminEmail: 'a@x.co.za' }, { adminEmail: 'a@x.co.za' }, { adminEmail: 'b@x.co.za' }, { adminEmail: 'driver:d1' }, { adminEmail: 'tavern:t1' }] });
  try {
    const r = await t.call('GET', '/admin/push/devices');
    assert.deepEqual(r.body.counts, { 'a@x.co.za': 2, 'b@x.co.za': 1 });
  } finally { t.close(); }
  const d = await pushApp({ rows: [], role: 'DISPATCHER' });
  try { assert.equal((await d.call('GET', '/admin/push/devices')).status, 403); } finally { d.close(); }
});

test('the test ring is urgent, goes to all dispatch devices, and is super-admin only', async () => {
  const t = await pushApp({ rows: [] });
  try {
    const r = await t.call('POST', '/admin/push/test');
    assert.equal(r.body.sent, 3);
    assert.equal(t.sentTo[0].urgent, true);
    assert.match(t.sentTo[0].title, /TEST/);
  } finally { t.close(); }
  const off = await pushApp({ rows: [], enabled: false });
  try { assert.equal((await off.call('POST', '/admin/push/test')).status, 400); } finally { off.close(); }
  const d = await pushApp({ rows: [], role: 'DISPATCHER' });
  try { assert.equal((await d.call('POST', '/admin/push/test')).status, 403); assert.equal(d.sentTo.length, 0); } finally { d.close(); }
});

test('urgent pushes vibrate for longer and the sound is never muted by the app', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  assert.match(sw, /silent: false/);
  assert.match(sw, /data\.urgent \? \[500/);
});
