// Tavern portal: sign-in, orders to pack, ready button, sold-out items steering the board,
// money, alerts and the admin switch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const T = require('../lib/tavern-portal.js');
const D = require('../lib/driver-app.js');
const { createTavernPush } = require('../lib/tavern-push.js');
const { createPusher } = require('../lib/push.js');
const { saDay } = require('../lib/payouts.js');

const taverns = [
  { id: 't1', name: 'Near Tavern', area: 'Motherwell', phone: '27711111111', latitude: -33.80, longitude: 25.60 },
  { id: 't2', name: 'Far Tavern', area: 'Kwazakhele', phone: '27722222222', latitude: -33.90, longitude: 25.50 },
];
const order = (extra = {}) => ({ id: 'o1', code: 'EKO-AAA', status: 'PENDING', address: '12 Mali Street, Motherwell', customerName: 'Thabo', customerPhone: '0710000000', deliveryLat: -33.801, deliveryLng: 25.601, deliveryFee: 40, surgeFee: 0, priorityFee: 0, paymentMethod: 'card', total: 500, driverPhone: null, driverName: null, tavernId: null, items: [{ name: 'Castle Lite', quantity: 2, skuId: 'sku-castle' }], createdAt: new Date(), paidAt: new Date(), ...extra });

// ── pure logic ──────────────────────────────────────────────────────────
test('a tavern that is sold out of an item is skipped; the next nearest one gets the order', () => {
  const blocked = T.blockedMap([{ tavernId: 't1', skuId: 'sku-castle' }]);
  assert.equal(D.nearestTavern(order(), taverns).id, 't1');
  assert.equal(D.nearestTavern(order(), taverns, blocked).id, 't2');
  assert.equal(D.nearestTavern(order({ items: [{ skuId: 'other', quantity: 1 }] }), taverns, blocked).id, 't1', 'other items are unaffected');
  const both = T.blockedMap([{ tavernId: 't1', skuId: 'sku-castle' }, { tavernId: 't2', skuId: 'sku-castle' }]);
  assert.equal(D.nearestTavern(order(), taverns, both), null, 'nobody can supply it: dispatch decides');
  assert.equal(D.boardView(order(), taverns, new Date(), both).canTake, false);
  assert.equal(D.nearestTavern(order({ tavernId: 't1' }), taverns, blocked).id, 't1', 'an order already assigned stays put');
});

test('what a tavern sees: items and the collection PIN, never the customer, address or total', () => {
  const o = order({ tavernId: 't1', driverName: 'Sipho', driverVehicle: 'Polo', collectionPin: '4821', assignedAt: new Date(Date.now() - 4 * 60000) });
  const v = T.packView(o);
  const json = JSON.stringify(v);
  assert.equal(v.collectionPin, '4821');
  assert.equal(v.driver.name, 'Sipho');
  assert.equal(v.itemCount, 2);
  assert.ok(!json.includes('Thabo') && !json.includes('Mali') && !json.includes('071') && !json.includes('500'));
  assert.equal(T.packView({ ...o, status: 'DISPATCHED' }).collectionPin, null, 'once collected the PIN is gone');

  const inc = T.incomingView(order());
  const incJson = JSON.stringify(inc);
  assert.equal(inc.area, 'Motherwell');
  assert.ok(!incJson.includes('EKO-AAA') && !incJson.includes('Thabo') && !incJson.includes('Mali'), 'no code, so it cannot be tracked');
});

test('stock search matches every word, in name or pack', () => {
  const sku = { name: 'Heineken', bottleFormat: 'Dumpy (330ml)' };
  assert.equal(T.matchesQuery(sku, 'heine dumpy'), true);
  assert.equal(T.matchesQuery(sku, 'heine can'), false);
  assert.equal(T.matchesQuery(sku, ''), true);
});

test('lock-screen alerts carry no customer details or PIN', () => {
  const a = T.assignedPayload({ code: 'EKO-1', driverName: 'Sipho', collectionPin: '4821', customerName: 'Thabo' }, 3);
  const i = T.incomingPayload(T.incomingView(order()));
  for (const p of [a, i]) {
    const s = JSON.stringify(p);
    assert.ok(!s.includes('4821') && !s.includes('Thabo') && !s.includes('Mali'));
    assert.equal(p.url, '/tavern.html');
  }
});

test('push goes only to the right tavern, and only when its portal is on', async () => {
  const sent = [];
  const rows = [
    { id: 's1', endpoint: 'e1', p256dh: 'k', auth: 'a', adminEmail: 'tavern:t1' },
    { id: 's2', endpoint: 'e2', p256dh: 'k', auth: 'a', adminEmail: 'tavern:t2' },
    { id: 's3', endpoint: 'e3', p256dh: 'k', auth: 'a', adminEmail: 'boss@example.com' },
  ];
  const access = { t1: { active: true }, t2: { active: false } };
  const prisma = {
    tavernAccess: { findUnique: async ({ where }) => access[where.tavernId] || null },
    pushSubscription: { findMany: async ({ where }) => rows.filter((r) => r.adminEmail === where.adminEmail) },
    orderItem: { findMany: async () => [{ quantity: 2 }] },
  };
  const push = { sendToSubscription: async (s, p) => { sent.push([s.endpoint, p]); return 'ok'; } };
  const tp = createTavernPush({ prisma, push, log: { error() {} } });
  assert.equal((await tp.notifyAssigned({ id: 'o1', code: 'EKO-1', tavernId: 't1', driverName: 'Sipho' })).sent, 1);
  assert.equal((await tp.notifyAssigned({ id: 'o1', code: 'EKO-1', tavernId: 't2' })).sent, 0, 'paused portal gets nothing');
  assert.deepEqual(sent.map((s) => s[0]), ['e1']);
});

test('admin order alerts never go to tavern phones', async () => {
  const calls = [];
  const rows = [
    { id: 'a', endpoint: 'ea', p256dh: 'k', auth: 'a', adminEmail: 'boss@example.com' },
    { id: 'b', endpoint: 'eb', p256dh: 'k', auth: 'a', adminEmail: 'tavern:t1' },
    { id: 'c', endpoint: 'ec', p256dh: 'k', auth: 'a', adminEmail: 'driver:d1' },
  ];
  const prisma = { pushSubscription: { findMany: async () => rows.slice(), deleteMany: async () => ({}) } };
  const webpush = { setVapidDetails() {}, sendNotification: async (s) => { calls.push(s.endpoint); } };
  const pusher = createPusher({ prisma, webpush, isAdmin: async () => true, env: { VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y' }, log: { error() {} } });
  await pusher.sendToAdmins({ title: 't' });
  assert.deepEqual(calls, ['ea']);
});

// ── routes with an in-memory database ───────────────────────────────────
function makeApp() {
  const db = {
    taverns: taverns.map((t) => ({ ...t })), access: [], soldOut: [], orders: [], payouts: [], audit: [], pushes: [],
    skus: [
      { id: 'sku-castle', name: 'Castle Lite', bottleFormat: 'Can (440ml)', category: 'BEER' },
      { id: 'sku-heineken', name: 'Heineken', bottleFormat: 'Dumpy (330ml)', category: 'BEER' },
    ],
  };
  const match = (row, where = {}) => Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return v.some((w) => match(row, w));
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && ('gte' in v || 'lt' in v)) return row[k] != null && (!v.gte || new Date(row[k]) >= v.gte) && (!v.lt || new Date(row[k]) < v.lt);
    return (row[k] ?? null) === v;
  });
  const withTavern = (o) => ({ ...o, tavern: db.taverns.find((t) => t.id === o.tavernId) || null, items: o.items.map((i) => ({ ...i, sku: db.skus.find((s) => s.id === i.skuId) || null })) });
  const prisma = {
    tavern: {
      findMany: async ({ where } = {}) => db.taverns.filter((t) => !where || !where.phone || where.phone.in.includes(t.phone)),
      findUnique: async ({ where }) => db.taverns.find((t) => t.id === where.id) || null,
    },
    tavernAccess: {
      findMany: async ({ where } = {}) => db.access.filter((a) => !where || ((!where.tavernId || where.tavernId.in.includes(a.tavernId)) && (where.active == null || a.active === where.active))),
      findUnique: async ({ where }) => db.access.find((a) => a.tavernId === where.tavernId) || null,
      findFirst: async ({ where }) => db.access.find((a) => a.sessionHash === where.sessionHash) || null,
      create: async ({ data }) => { const a = { id: 'a' + (db.access.length + 1), active: true, failedLogins: 0, lockedUntil: null, sessionHash: null, sessionExpiresAt: null, lastLoginAt: null, createdAt: new Date(), ...data }; db.access.push(a); return a; },
      update: async ({ where, data }) => { const a = db.access.find((x) => x.id === where.id); Object.assign(a, data); return a; },
    },
    tavernSoldOut: {
      findMany: async ({ where } = {}) => db.soldOut.filter((s) => !where || s.tavernId === where.tavernId),
      count: async ({ where }) => db.soldOut.filter((s) => s.tavernId === where.tavernId).length,
      upsert: async ({ where, create }) => { const k = where.tavernId_skuId; if (!db.soldOut.find((s) => s.tavernId === k.tavernId && s.skuId === k.skuId)) db.soldOut.push({ ...create }); return create; },
      deleteMany: async ({ where }) => { const before = db.soldOut.length; db.soldOut = db.soldOut.filter((s) => !(s.tavernId === where.tavernId && s.skuId === where.skuId)); return { count: before - db.soldOut.length }; },
    },
    skuItem: {
      findMany: async () => db.skus.slice(),
      findUnique: async ({ where }) => db.skus.find((s) => s.id === where.id) || null,
    },
    order: {
      findMany: async ({ where }) => db.orders.filter((o) => match(o, where)).map(withTavern),
      updateMany: async ({ where, data }) => { const hit = db.orders.filter((o) => match(o, where)); hit.forEach((o) => Object.assign(o, data)); return { count: hit.length }; },
    },
    payout: { findMany: async ({ where }) => db.payouts.filter((p) => p.payeeKey === where.payeeKey && where.period.in.includes(p.period)) },
    pushSubscription: {
      findMany: async ({ where } = {}) => db.pushes.filter((p) => !where || !where.adminEmail || (where.adminEmail.startsWith ? p.adminEmail.startsWith(where.adminEmail.startsWith) : p.adminEmail === where.adminEmail)),
      findUnique: async ({ where }) => db.pushes.find((p) => p.endpoint === where.endpoint) || null,
      upsert: async ({ where, create, update }) => { const e = db.pushes.find((p) => p.endpoint === where.endpoint); if (e) Object.assign(e, update); else db.pushes.push({ id: 'p' + db.pushes.length, ...create }); },
      deleteMany: async ({ where }) => { db.pushes = db.pushes.filter((p) => !(where.adminEmail && p.adminEmail === where.adminEmail && (!where.endpoint || p.endpoint === where.endpoint)) && !(where.id && where.id.in && where.id.in.includes(p.id))); return {}; },
    },
  };
  const app = express();
  app.use(express.json());
  const pass = (req, res, next) => next();
  require('../routes/tavern-portal.js')(app, { prisma, requireAdmin: pass, writeLimiter: pass, logAdminAction: async (req, a, t, d) => db.audit.push([a, t, d]) });
  return { app, db };
}

async function boot() {
  const { app, db } = makeApp();
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  return { db, call, close: () => server.close() };
}

async function signedIn(call) {
  const on = await call('POST', '/admin/tavern-access/t1', { action: 'enable' });
  const login = await call('POST', '/api/tavern/login', { phone: '071 111 1111', pin: on.body.pin });
  return { pin: on.body.pin, token: login.body.token, login };
}

test('admin switches a tavern on; it signs in; the hash and token are never stored in clear', async () => {
  const { db, call, close } = await boot();
  try {
    const on = await call('POST', '/admin/tavern-access/t1', { action: 'enable' });
    assert.equal(on.status, 200);
    assert.match(on.body.pin, /^\d{6}$/);
    assert.equal((await call('POST', '/admin/tavern-access/t1', { action: 'enable' })).status, 409, 'second time: use reset');
    assert.equal((await call('POST', '/admin/tavern-access/nope', { action: 'enable' })).status, 404);

    assert.equal((await call('GET', '/api/tavern/home')).status, 401);
    const bad = on.body.pin === '000000' ? '111111' : '000000';
    assert.equal((await call('POST', '/api/tavern/login', { phone: '0711111111', pin: bad })).status, 401);
    assert.equal((await call('POST', '/api/tavern/login', { phone: '0722222222', pin: on.body.pin })).status, 401, 'a tavern without the portal cannot sign in');
    const login = await call('POST', '/api/tavern/login', { phone: '0711111111', pin: on.body.pin });
    assert.equal(login.status, 200);
    assert.equal(login.body.tavern.name, 'Near Tavern');
    assert.ok(!JSON.stringify(db.access[0]).includes(login.body.token));
    assert.ok(!JSON.stringify(login.body).includes('pinHash'));
    const list = await call('GET', '/admin/tavern-access');
    assert.ok(!JSON.stringify(list.body).includes('pinHash') && !JSON.stringify(list.body).includes('sessionHash'));
    assert.equal(list.body.find((t) => t.id === 't1').access.active, true);
    assert.equal(list.body.find((t) => t.id === 't2').access, null);
  } finally { close(); }
});

test('wrong PINs lock the tavern; reset and pause sign it out', async () => {
  const { call, close } = await boot();
  try {
    const { pin, token } = await signedIn(call);
    const bad = pin === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/tavern/login', { phone: '0711111111', pin: bad })).status, 401);
    assert.equal((await call('POST', '/api/tavern/login', { phone: '0711111111', pin })).status, 429);
    const reset = await call('POST', '/admin/tavern-access/t1', { action: 'reset' });
    assert.equal((await call('GET', '/api/tavern/home', null, token)).status, 401, 'reset signs the old session out');
    const login = await call('POST', '/api/tavern/login', { phone: '0711111111', pin: reset.body.pin });
    assert.equal(login.status, 200);
    await call('POST', '/admin/tavern-access/t1', { action: 'pause' });
    assert.equal((await call('GET', '/api/tavern/home', null, login.body.token)).status, 401);
    await call('POST', '/admin/tavern-access/t1', { action: 'resume' });
    assert.equal((await call('POST', '/api/tavern/login', { phone: '0711111111', pin: reset.body.pin })).status, 200);
  } finally { close(); }
});

test('orders to pack, coming soon, ready button; only the tavern\'s own orders', async () => {
  const { db, call, close } = await boot();
  try {
    const { token } = await signedIn(call);
    db.orders.push(order({ id: 'mine', code: 'EKO-MINE', tavernId: 't1', driverName: 'Sipho', driverPhone: '27712345678', collectionPin: '4821', assignedAt: new Date() }));
    db.orders.push(order({ id: 'theirs', code: 'EKO-THEIRS', tavernId: 't2', driverName: 'Themba', driverPhone: '27720000000', collectionPin: '9999' }));
    db.orders.push(order({ id: 'wait', code: 'EKO-WAIT' }));
    const home = await call('GET', '/api/tavern/home', null, token);
    assert.equal(home.status, 200);
    assert.deepEqual(home.body.toPack.map((o) => o.code), ['EKO-MINE']);
    assert.equal(home.body.toPack[0].collectionPin, '4821');
    assert.equal(home.body.incoming.length, 1, 'the unassigned order nearest to this tavern shows as coming');
    const text = JSON.stringify(home.body);
    assert.ok(!text.includes('9999') && !text.includes('EKO-THEIRS') && !text.includes('EKO-WAIT') && !text.includes('Thabo') && !text.includes('Mali'));

    assert.equal((await call('POST', '/api/tavern/orders/EKO-THEIRS/ready', { ready: true }, token)).status, 404, 'cannot touch another tavern\'s order');
    assert.equal((await call('POST', '/api/tavern/orders/EKO-MINE/ready', { ready: true }, token)).status, 200);
    assert.ok(db.orders.find((o) => o.id === 'mine').readyAt);
    assert.equal((await call('GET', '/api/tavern/home', null, token)).body.toPack[0].ready, true);
    assert.equal((await call('POST', '/api/tavern/orders/EKO-MINE/ready', { ready: false }, token)).status, 200);
    assert.equal(db.orders.find((o) => o.id === 'mine').readyAt, null);

    // the driver sees it too
    db.orders.find((o) => o.id === 'mine').readyAt = new Date();
    assert.equal(D.jobView(db.orders.find((o) => o.id === 'mine')).ready, true);
  } finally { close(); }
});

test('sold-out items: search, mark, undo, and the order moves to the next tavern', async () => {
  const { db, call, close } = await boot();
  try {
    const { token } = await signedIn(call);
    assert.equal((await call('GET', '/api/tavern/stock?q=x', null, token)).body.results.length, 0, 'under 2 letters searches nothing');
    const found = await call('GET', '/api/tavern/stock?q=castle', null, token);
    assert.equal(found.body.results.length, 1);
    assert.equal(found.body.results[0].soldOut, false);
    assert.equal((await call('POST', '/api/tavern/stock', { skuId: 'nope', soldOut: true }, token)).status, 404);
    assert.equal((await call('POST', '/api/tavern/stock', { skuId: 'sku-castle', soldOut: true }, token)).status, 200);
    await call('POST', '/api/tavern/stock', { skuId: 'sku-castle', soldOut: true }, token); // twice is fine
    assert.equal(db.soldOut.length, 1);
    const after = await call('GET', '/api/tavern/stock?q=castle', null, token);
    assert.equal(after.body.soldOut.length, 1);
    assert.equal(after.body.results[0].soldOut, true);

    db.orders.push(order({ id: 'wait', code: 'EKO-WAIT' }));
    assert.equal((await call('GET', '/api/tavern/home', null, token)).body.incoming.length, 0, 'no longer coming to the tavern that ran out');
    assert.equal(D.nearestTavern(db.orders[0], taverns, await T.loadBlocked({ tavernSoldOut: { findMany: async () => db.soldOut } })).id, 't2');

    await call('POST', '/api/tavern/stock', { skuId: 'sku-castle', soldOut: false }, token);
    assert.equal(db.soldOut.length, 0);
    assert.equal((await call('GET', '/api/tavern/home', null, token)).body.incoming.length, 1);
  } finally { close(); }
});

test('money: this tavern\'s share per day, using the same sums as admin Payouts', async () => {
  const { db, call, close } = await boot();
  try {
    const { token } = await signedIn(call);
    const now = new Date();
    // R105 of beer at 7% markup is R98.13 for the tavern, plus a R52 crate charge
    db.orders.push(order({ id: 'd1', code: 'EKO-D1', status: 'DELIVERED', tavernId: 't1', deliveredAt: now, items: [{ name: 'Castle', quantity: 1, price: 107, skuId: 'sku-castle' }], bottleDepositFee: 52, total: 300 }));
    db.orders.push(order({ id: 'd2', code: 'EKO-D2', status: 'DELIVERED', tavernId: 't2', deliveredAt: now, items: [{ name: 'Castle', quantity: 1, price: 107, skuId: 'sku-castle' }], total: 300 }));
    const y = saDay(new Date(now.getTime() - 86400000));
    db.payouts.push({ period: y, payeeType: 'TAVERN', payeeKey: 't1', amount: 10, paidAt: now });
    const m = await call('GET', '/api/tavern/money', null, token);
    assert.equal(m.status, 200);
    assert.equal(m.body.days.length, 7);
    assert.equal(m.body.today.orders, 1, 'only this tavern\'s order');
    assert.equal(m.body.today.owed, 152, '107 / 1.07 = 100, plus the R52 crate charge');
    assert.ok(m.body.yesterday.paid);
    assert.equal(m.body.weekOwed, 152);
    assert.equal(m.body.weekUnpaid, 152, 'today is not paid yet');
  } finally { close(); }
});

test('alerts: a phone is saved for this tavern only; admin phones are refused', async () => {
  const { db, call, close } = await boot();
  try {
    const { token } = await signedIn(call);
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'k'.repeat(20), auth: 'a'.repeat(10) } };
    assert.equal((await call('POST', '/api/tavern/push/subscribe', { endpoint: 'https://evil.example.com/x', keys: sub.keys }, token)).status, 400);
    assert.equal((await call('POST', '/api/tavern/push/subscribe', sub, token)).status, 200);
    assert.equal(db.pushes[0].adminEmail, 'tavern:t1');
    db.pushes.push({ id: 'adm', endpoint: 'https://fcm.googleapis.com/fcm/send/adminphone', adminEmail: 'boss@example.com' });
    assert.equal((await call('POST', '/api/tavern/push/subscribe', { ...sub, endpoint: 'https://fcm.googleapis.com/fcm/send/adminphone' }, token)).status, 409);
    await call('POST', '/api/tavern/logout', null, token);
    assert.ok(!db.pushes.some((p) => p.adminEmail === 'tavern:t1'), 'a signed-out phone stops buzzing');
  } finally { close(); }
});

test('files are wired in: page, manifest, migration, admin switch, service worker', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const page = read('public/tavern.html');
  assert.ok(page.includes('noindex') && page.includes('/api/tavern/login') && page.includes('/api/tavern/stock') && page.includes('const esc ='));
  assert.ok(!page.includes('${o.items.map((i) => i.name'), 'item names are always escaped');
  assert.ok(JSON.parse(read('public/tavern-manifest.json')).start_url === '/tavern.html');
  const schema = read('prisma/schema.prisma');
  assert.ok(/model TavernAccess \{/.test(schema) && /model TavernSoldOut \{/.test(schema) && /readyAt\s+DateTime\?/.test(schema));
  assert.ok(!/model Tavern \{[^}]*pinHash/.test(schema), 'PIN hashes never sit on the Tavern table');
  const sql = read('prisma/migrations/20261121090000_add_tavern_portal/migration.sql');
  assert.ok(sql.includes('"TavernAccess"') && sql.includes('"TavernSoldOut"') && sql.includes('"readyAt"') && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, '')));
  assert.ok(read('admin/drivers.js').includes('tavernAccessAction') && read('admin/admin.html').includes('tavernAccessBody'));
  assert.ok(read('public/sw.js').includes('/tavern.html'));
  assert.ok(read('routes/index.js').includes('tavern-portal.js'));
});
