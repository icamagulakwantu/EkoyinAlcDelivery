// Closed-app job alerts for drivers + the admin driver picker.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createDriverPush, jobPayload } = require('../lib/driver-push.js');
const { createPusher } = require('../lib/push.js');

const quiet = { error() {} };
const taverns = [{ id: 't1', name: 'Near Tavern', area: 'Motherwell', latitude: -33.80, longitude: 25.60 }];
const board = (extra = {}) => ({ id: 'o1', code: 'EKO-1', status: 'PENDING', address: '12 Mali Street, Motherwell', customerName: 'Thabo', customerPhone: '0710000000', deliveryLat: -33.801, deliveryLng: 25.601, deliveryFee: 40, surgeFee: 0, priorityFee: 0, paymentMethod: 'card', total: 500, distanceKm: 1.5, driverPhone: null, driverName: null, items: [{ quantity: 2 }], createdAt: new Date(), ...extra });

function fakeDb({ drivers, subs, orders = [] }) {
  const rows = subs.map((s, i) => ({ id: 's' + i, p256dh: 'k', auth: 'a', lastSeenAt: new Date(), ...s }));
  return {
    rows,
    tavern: { findMany: async () => taverns },
    driver: { findMany: async ({ where }) => drivers.filter((d) => where.id.in.includes(d.id) && d.active === where.active) },
    order: {
      findMany: async ({ where }) => orders.filter((o) => where.driverPhone.in.includes(o.driverPhone) && where.status.in.includes(o.status)),
      findUnique: async () => board(),
    },
    pushSubscription: {
      findMany: async ({ where } = {}) => rows.filter((r) => !where || !where.adminEmail || !where.adminEmail.startsWith || r.adminEmail.startsWith(where.adminEmail.startsWith)),
      findUnique: async ({ where }) => rows.find((r) => r.endpoint === where.endpoint) || null,
      deleteMany: async ({ where }) => {
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i];
          const hit = (where.id && where.id.in && where.id.in.includes(r.id)) || (where.endpoint && r.endpoint === where.endpoint && (!where.adminEmail || r.adminEmail === where.adminEmail)) || (!where.id && !where.endpoint && where.adminEmail && r.adminEmail === where.adminEmail);
          if (hit) rows.splice(i, 1);
        }
      },
      upsert: async ({ where, create, update }) => {
        const r = rows.find((x) => x.endpoint === where.endpoint);
        if (r) { Object.assign(r, update); return r; }
        const n = { id: 's' + rows.length + 'n', ...create }; rows.push(n); return n;
      },
    },
  };
}

test('a new job buzzes active drivers who are free, with no address or customer in the alert', async () => {
  const sent = [];
  const db = fakeDb({
    drivers: [{ id: 'd1', phone: '27711111111', active: true }, { id: 'd2', phone: '27722222222', active: true }, { id: 'd3', phone: '27733333333', active: false }],
    subs: [{ endpoint: 'https://fcm.googleapis.com/a', adminEmail: 'driver:d1' }, { endpoint: 'https://fcm.googleapis.com/b', adminEmail: 'driver:d2' }, { endpoint: 'https://fcm.googleapis.com/c', adminEmail: 'driver:d3' }, { endpoint: 'https://fcm.googleapis.com/z', adminEmail: 'boss@ekoyini.co.za' }],
    orders: ['A', 'B', 'C'].map((c) => ({ code: c, driverPhone: '27722222222', status: 'PENDING' })), // d2 already has 3 jobs
  });
  const dp = createDriverPush({ prisma: db, push: { sendToSubscription: async (sub, payload) => { sent.push({ to: sub.endpoint, payload }); return 'ok'; } }, log: quiet });
  const r = await dp.notifyNewJob(board());
  assert.equal(r.sent, 1);
  assert.deepEqual(sent.map((s) => s.to), ['https://fcm.googleapis.com/a']);
  const text = JSON.stringify(sent[0].payload);
  assert.match(sent[0].payload.title, /Motherwell/);
  assert.ok(!text.includes('Mali') && !text.includes('Thabo') && !text.includes('071') && !text.includes('EKO-1'));
  assert.equal(sent[0].payload.url, '/driver.html');
});

test('no alert for orders that are taken, unpaid, or have no tavern to collect from', async () => {
  const sent = [];
  const db = fakeDb({ drivers: [{ id: 'd1', phone: '27711111111', active: true }], subs: [{ endpoint: 'https://fcm.googleapis.com/a', adminEmail: 'driver:d1' }] });
  const dp = createDriverPush({ prisma: db, push: { sendToSubscription: async () => { sent.push(1); return 'ok'; } }, log: quiet });
  await dp.notifyNewJob(board({ driverPhone: '27700000000' }));
  await dp.notifyNewJob(board({ status: 'PAYMENT_PENDING' }));
  await dp.notifyNewJob(board({ deliveryLat: null, deliveryLng: null }));
  assert.equal(sent.length, 0);
});

test('a failing push can never throw into order creation', async () => {
  const db = fakeDb({ drivers: [], subs: [] });
  db.tavern.findMany = async () => { throw new Error('db down'); };
  const dp = createDriverPush({ prisma: db, push: { sendToSubscription: async () => 'ok' }, log: quiet });
  assert.deepEqual(await dp.notifyNewJob(board()), { sent: 0 });
});

test('admin alerts never go to driver phones and never delete them', async () => {
  const delivered = [];
  const db = fakeDb({ drivers: [], subs: [{ endpoint: 'https://fcm.googleapis.com/a', adminEmail: 'driver:d1' }, { endpoint: 'https://fcm.googleapis.com/b', adminEmail: 'boss@ekoyini.co.za' }] });
  const webpush = { setVapidDetails() {}, sendNotification: async (sub) => { delivered.push(sub.endpoint); } };
  const pusher = createPusher({ prisma: db, webpush, isAdmin: async (e) => e === 'boss@ekoyini.co.za', env: { VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'k' }, log: quiet });
  await pusher.sendToAdmins({ title: 't', body: 'b' });
  assert.deepEqual(delivered, ['https://fcm.googleapis.com/b']);
  assert.equal(db.rows.length, 2, 'the driver phone is still saved');
});

test('driver push routes: save, refuse an admin phone, sign out and pause remove phones', async () => {
  const db = fakeDb({ drivers: [], subs: [{ endpoint: 'https://fcm.googleapis.com/admin', adminEmail: 'boss@ekoyini.co.za' }] });
  const drivers = [{ id: 'd1', phone: '27711111111', name: 'Sipho', active: true, sessionHash: null, sessionExpiresAt: null }];
  const D = require('../lib/driver-app.js');
  const token = D.newSessionToken();
  drivers[0].sessionHash = D.hashToken(token);
  drivers[0].sessionExpiresAt = new Date(Date.now() + 3600e3);
  db.driver = {
    findFirst: async ({ where }) => drivers.find((d) => d.sessionHash === where.sessionHash) || null,
    findUnique: async ({ where }) => drivers.find((d) => d.id === where.id) || null,
    update: async ({ where, data }) => { const d = drivers.find((x) => x.id === where.id); Object.assign(d, data); return d; },
  };
  const app = express(); app.use(express.json());
  const pass = (req, res, next) => next();
  require('../routes/drivers.js')(app, { prisma: db, requireAdmin: pass, writeLimiter: pass, logAdminAction: async () => {}, push: null });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => { const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json().catch(() => ({})) }; };
  try {
    const keys = { p256dh: 'abc', auth: 'def' };
    assert.equal((await call('POST', '/api/driver/push/subscribe', { endpoint: 'https://evil.example.com/x', keys })).status, 400);
    assert.equal((await call('POST', '/api/driver/push/subscribe', { endpoint: 'https://fcm.googleapis.com/admin', keys })).status, 409, 'an admin phone is not taken over');
    assert.equal((await call('POST', '/api/driver/push/subscribe', { endpoint: 'https://fcm.googleapis.com/mine', keys })).status, 200);
    assert.ok(db.rows.some((r) => r.endpoint === 'https://fcm.googleapis.com/mine' && r.adminEmail === 'driver:d1'));
    await call('POST', '/api/driver/push/unsubscribe', { endpoint: 'https://fcm.googleapis.com/mine' });
    assert.ok(!db.rows.some((r) => r.adminEmail === 'driver:d1'));
    await call('POST', '/api/driver/push/subscribe', { endpoint: 'https://fcm.googleapis.com/mine', keys });
    await call('POST', '/api/driver/logout');
    assert.ok(!db.rows.some((r) => r.adminEmail === 'driver:d1'), 'a signed-out phone stops buzzing');
    assert.ok(db.rows.some((r) => r.adminEmail === 'boss@ekoyini.co.za'), 'admin phones are untouched');
  } finally { server.close(); }
});

test('payload is short and carries money, distance and items only', () => {
  const p = jobPayload({ area: 'Zwide', earn: 55, distanceKm: 4.2, items: 1, cash: 380 });
  assert.equal(p.title, 'New job in Zwide');
  assert.equal(p.body, 'R55 · 4.2 km · 1 item · cash on delivery');
});

test('the driver picker and the alert switch are wired in', () => {
  const html = fs.readFileSync(path.join(__dirname, '../admin/admin.html'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '../admin/admin-api.js'), 'utf8');
  assert.ok(html.includes('id="driverPick"') && api.includes('function pickDriver') && api.includes("adminFetch('/admin/drivers')"));
  const page = fs.readFileSync(path.join(__dirname, '../public/driver.html'), 'utf8');
  assert.ok(page.includes('/api/driver/push/subscribe') && page.includes('Turn on job alerts'));
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.equal((server.match(/driverPush\.notifyNewJob\(/g) || []).length, 3, 'card, cash/EFT order, and EFT confirmation');
});
