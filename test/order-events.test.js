// The closed loop between customer, dispatcher, tavern and driver (22 Nov 2026): who hears about each step.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createOrderEvents } = require('../lib/order-events.js');
const { createCustomerPush, customerPayload } = require('../lib/customer-push.js');
const { createPusher } = require('../lib/push.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const order = { code: 'EKO-AB12CD34', status: 'PENDING', driverName: 'Sipho Dlamini', driverPhone: '27712345678', customerEmail: 'c@x.co.za', tavernId: 't1', tavern: { name: 'KwaSiba' } };

function hub() {
  const calls = [];
  const rec = (who) => async (...a) => { calls.push([who, ...a.map((x) => (x && x.code) || x)]); };
  const e = createOrderEvents({
    prisma: { order: { findUnique: async () => order } },
    push: { sendToAdmins: async (p) => { calls.push(['admins', p.title]); } },
    driverPush: { notifyAssigned: rec('driver:assigned'), notifyReady: rec('driver:ready'), notifyCancelled: rec('driver:cancelled') },
    tavernPush: { notifyCancelled: rec('tavern:cancelled') },
    customerPush: { notify: async (o, ev) => { calls.push(['customer', ev]); } },
    sendOutForDeliveryEmail: async (o) => { calls.push(['email', o.code]); },
    log: { error() {} },
  });
  return { e, calls, who: () => calls.map((c) => c.join(':')) };
}

test('each step of an order tells the right people', async () => {
  const h = hub();
  await h.e.fire('DRIVER_TOOK', order.code);
  await h.e.fire('ASSIGNED_BY_ADMIN', order.code);
  await h.e.fire('READY', order.code);
  await h.e.fire('PICKED_UP', order.code);
  await h.e.fire('DELIVERED', order.code);
  assert.deepEqual(h.calls.map((c) => c[0] + ':' + (c[1] || '')), [
    'customer:ASSIGNED',
    'customer:ASSIGNED', 'driver:assigned:EKO-AB12CD34',
    'driver:ready:EKO-AB12CD34', 'customer:READY',
    'customer:PICKED_UP', 'admins:Out for delivery: EKO-AB12CD34', 'email:EKO-AB12CD34',
    'customer:DELIVERED',
  ]);
});

test('a cancellation stops the driver, the tavern and the customer; dispatch hears when the customer cancelled', async () => {
  const byCustomer = hub();
  await byCustomer.e.fire('CANCELLED', order.code, { by: 'customer' });
  const names = byCustomer.calls.map((c) => c[0]);
  for (const n of ['driver:cancelled', 'tavern:cancelled', 'customer', 'admins']) assert.ok(names.includes(n), n);
  const byAdmin = hub();
  await byAdmin.e.fire('CANCELLED', order.code, { by: 'admin' });
  assert.ok(!byAdmin.calls.some((c) => c[0] === 'admins'), 'dispatch already knows when it cancelled the order itself');
});

test('a failing alert or a missing order never throws', async () => {
  const e = createOrderEvents({ prisma: { order: { findUnique: async () => { throw new Error('db down'); } } }, log: { error() {} } });
  await e.fire('PICKED_UP', 'EKO-X');
  const e2 = createOrderEvents({ prisma: { order: { findUnique: async () => null } }, log: { error() {} } });
  await e2.fire('PICKED_UP', 'EKO-X');
});

test('customer notifications carry no PIN or address and link to the right tracking page', () => {
  for (const ev of ['ASSIGNED', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED']) {
    const p = customerPayload(ev, { ...order, deliveryPin: '4821', address: '12 Mdoda St, Motherwell' });
    assert.equal(p.url, '/track.html?code=EKO-AB12CD34');
    assert.ok(!/4821|Mdoda|Motherwell/.test(JSON.stringify(p)), ev);
  }
  assert.equal(customerPayload('PICKED_UP', order).urgent, true);
  assert.equal(customerPayload('NOPE', order), null);
});

test('a customer is told once per step, and their phone is forgotten when the order is finished', async () => {
  const rows = [{ id: 's1', adminEmail: 'customer:EKO-AB12CD34', endpoint: 'e', p256dh: 'k', auth: 'a' }];
  const sent = [];
  const cp = createCustomerPush({
    prisma: { pushSubscription: { findMany: async ({ where }) => rows.filter((r) => r.adminEmail === where.adminEmail), deleteMany: async ({ where }) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].adminEmail === where.adminEmail) rows.splice(i, 1); } } },
    push: { sendToSubscription: async (s, p) => { sent.push(p.title); return 'ok'; } },
  });
  assert.equal((await cp.notify(order, 'PICKED_UP')).sent, 1);
  assert.equal(rows.length, 1);
  await cp.notify(order, 'DELIVERED');
  assert.equal(rows.length, 0, 'removed after delivery');
  assert.equal((await cp.notify(order, 'READY')).sent, 0);
});

test('customer phones are never sent dispatch alerts', async () => {
  const rows = [
    { id: 'a', adminEmail: 'admin@x.co.za', endpoint: 'ea', p256dh: 'k', auth: 'a' },
    { id: 'c', adminEmail: 'customer:EKO-AB12CD34', endpoint: 'ec', p256dh: 'k', auth: 'a' },
  ];
  const sentTo = [];
  const pusher = createPusher({
    prisma: { pushSubscription: { findMany: async () => rows, deleteMany: async () => {} } },
    webpush: { setVapidDetails() {}, sendNotification: async (sub) => { sentTo.push(sub.endpoint); } },
    isAdmin: async () => true, env: { VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q' }, log: { error() {} },
  });
  await pusher.sendToAdmins({ title: 't' });
  assert.deepEqual(sentTo, ['ea']);
});

async function subApp({ existing = null, status = 'PENDING' } = {}) {
  const store = new Map(); if (existing) store.set(existing.endpoint, existing);
  const sentTitles = [];
  const prisma = {
    order: { findUnique: async ({ where }) => (where.code === 'EKO-AB12CD34' ? { code: where.code, status } : null) },
    pushSubscription: {
      findUnique: async ({ where }) => store.get(where.endpoint) || null,
      upsert: async ({ where, create, update }) => { const row = { id: 'n' + store.size, ...(store.get(where.endpoint) || create), ...update }; store.set(where.endpoint, row); return row; },
      findMany: async ({ where }) => [...store.values()].filter((r) => r.adminEmail === where.adminEmail),
      deleteMany: async () => {},
    },
  };
  const app = express(); app.use(express.json());
  require('../routes/customer-push.js')(app, { prisma, trackLimiter: (q, s, n) => n(), push: { isEnabled: () => true, sendToSubscription: async (s, p) => { sentTitles.push(p.title); return 'ok'; } } });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const post = async (code, body) => { const res = await fetch(`http://127.0.0.1:${server.address().port}/api/order/${code}/push-subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: res.status, body: await res.json() }; };
  return { post, store, sentTitles, close: () => server.close() };
}
const goodSub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'k', auth: 'a' } };

test('route: a customer saves their phone for their own order and gets a confirmation', async () => {
  const t = await subApp();
  try {
    const r = await t.post('EKO-AB12CD34', goodSub);
    assert.equal(r.status, 200); assert.equal(r.body.confirmed, true);
    assert.equal(t.store.get(goodSub.endpoint).adminEmail, 'customer:EKO-AB12CD34');
    assert.equal((await t.post('EKO-NOPE', goodSub)).status, 404);
    assert.equal((await t.post('EKO-AB12CD34', { endpoint: 'https://evil.example.com/x', keys: { p256dh: 'k', auth: 'a' } })).status, 400);
  } finally { t.close(); }
});

test('route: a phone that already rings for dispatch is never taken over, and finished orders save nothing', async () => {
  const shared = await subApp({ existing: { ...goodSub, adminEmail: 'admin@x.co.za', p256dh: 'k', auth: 'a' } });
  try {
    const r = await shared.post('EKO-AB12CD34', goodSub);
    assert.equal(r.body.shared, true);
    assert.equal(shared.store.get(goodSub.endpoint).adminEmail, 'admin@x.co.za');
  } finally { shared.close(); }
  const done = await subApp({ status: 'DELIVERED' });
  try { assert.equal((await done.post('EKO-AB12CD34', goodSub)).body.finished, true); assert.equal(done.store.size, 0); } finally { done.close(); }
});

test('the server fires the events at every transition and the tracking page offers updates', () => {
  const server = read('server.js');
  for (const e of ['"PICKED_UP"', '"DELIVERED"', '"ASSIGNED_BY_ADMIN"']) assert.ok(server.includes(`orderEvents.fire(${e}`) || server.includes(e), e);
  assert.equal((server.match(/orderEvents\.fire\("CANCELLED"/g) || []).length, 2, 'customer and admin cancel');
  assert.match(read('routes/drivers.js'), /orderEvents\.fire\("DRIVER_TOOK"/);
  assert.match(read('routes/tavern-portal.js'), /orderEvents\.fire\("READY"/);
  assert.match(read('public/track.html'), /EkoyiniOrderUpdates\.mount/);
  assert.match(read('public/sw.js'), /\/order-updates\.js/);
});
