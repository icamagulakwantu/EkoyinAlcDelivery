// Driver app: PINs, sessions, the job board, taking a job, earnings, admin tools.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const D = require('../lib/driver-app.js');

// ── pure logic ──────────────────────────────────────────────────────────
test('PINs are 6 digits, hashed with a salt and verified', () => {
  const pin = D.newDriverPin();
  assert.match(pin, /^\d{6}$/);
  const h = D.hashPin(pin);
  assert.ok(!h.includes(pin) || pin.length < 3);
  assert.notEqual(D.hashPin(pin), h, 'salted');
  assert.equal(D.verifyPin(pin, h), true);
  assert.equal(D.verifyPin('000000' === pin ? '111111' : '000000', h), false);
  assert.equal(D.verifyPin(pin, 'garbage'), false);
  assert.equal(D.isValidPin('12345'), false);
  assert.equal(D.isValidPin('12345a'), false);
});

test('lock minutes count down and clear', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  assert.equal(D.lockMinutesLeft({ lockedUntil: new Date('2026-11-20T10:07:30Z') }, now), 8);
  assert.equal(D.lockMinutesLeft({ lockedUntil: new Date('2026-11-20T09:59:00Z') }, now), 0);
  assert.equal(D.lockMinutesLeft({}, now), 0);
});

test('earnings use the payout rules: delivery + surge + priority, cash taken off', () => {
  const now = new Date('2026-11-20T10:00:00Z'); // 12:00 in SA
  const mk = (code, hoursAgo, pay, total, fee) => ({ code, total, paymentMethod: pay, deliveryFee: fee, surgeFee: 10, priorityFee: 0, deliveredAt: new Date(now.getTime() - hoursAgo * 3600e3) });
  const e = D.summariseEarnings([mk('A', 1, 'card', 500, 40), mk('B', 2, 'cod', 300, 46), mk('C', 30, 'card', 400, 50), mk('OLD', 24 * 9, 'card', 400, 50)], now);
  assert.equal(e.today.deliveries, 2);
  assert.equal(e.today.earned, 106); // (40+10) + (46+10)
  assert.equal(e.today.cash, 300);
  assert.equal(e.today.net, -194);
  assert.equal(e.week.deliveries, 3, 'the 9-day-old order is outside the week');
  assert.equal(e.recent[0].code, 'A');
});

const taverns = [
  { id: 't1', name: 'Near Tavern', area: 'Motherwell', latitude: -33.80, longitude: 25.60 },
  { id: 't2', name: 'Far Tavern', area: 'Kwazakhele', latitude: -33.90, longitude: 25.50 },
];

test('the board shows area and money only, never the street address or customer', () => {
  const order = { id: 'o1', code: 'EKO-1', status: 'PENDING', address: '12 Mali Street, Motherwell', customerName: 'Thabo', customerPhone: '0710000000', deliveryLat: -33.801, deliveryLng: 25.601, deliveryFee: 40, surgeFee: 0, priorityFee: 0, paymentMethod: 'cod', total: 400, distanceKm: 1.2, items: [{ quantity: 2 }, { quantity: 1 }], paidAt: new Date(Date.now() - 5 * 60000) };
  const v = D.boardView(order, taverns);
  const json = JSON.stringify(v);
  assert.equal(v.tavern.name, 'Near Tavern');
  assert.equal(v.items, 3);
  assert.equal(v.cash, 400);
  assert.equal(v.earn, 40);
  assert.equal(v.canTake, true);
  assert.ok(!json.includes('Mali') && !json.includes('Thabo') && !json.includes('071') && !json.includes('EKO-1'));
});

test('an order with no tavern and no pin cannot be taken (dispatch assigns it)', () => {
  const v = D.boardView({ id: 'o2', status: 'PENDING', address: 'x, Motherwell', items: [], createdAt: new Date() }, taverns);
  assert.equal(v.canTake, false);
  assert.equal(D.isOnBoard({ status: 'PENDING', driverPhone: '27710000000' }), false);
  assert.equal(D.isOnBoard({ status: 'DISPATCHED' }), false);
  assert.equal(D.isOnBoard({ status: 'PENDING' }), true);
});

test('a driver job carries the link but never the collection or delivery PIN', () => {
  const j = D.jobView({ code: 'EKO-9', status: 'PENDING', address: '1 A St', collectionPin: '1111', deliveryPin: '2222', driverShareToken: 'tok', items: [{ name: 'Castle', quantity: 1 }], tavern: { name: 'T', area: 'A', phone: '27' } }, 'https://x');
  assert.equal(j.link, 'https://x/driver-track.html?code=EKO-9&token=tok');
  assert.ok(!JSON.stringify(j).includes('1111') && !JSON.stringify(j).includes('2222'));
});

// ── routes with an in-memory database ───────────────────────────────────
function makeApp() {
  const db = { drivers: [], orders: [], taverns: taverns.map((t) => ({ ...t, phone: '27711111111' })), pushes: [], audit: [] };
  const match = (row, where = {}) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'gte' in v) return new Date(row[k]) >= v.gte;
    return (row[k] ?? null) === v;
  });
  const prisma = {
    driver: {
      findUnique: async ({ where }) => db.drivers.find((d) => (where.id ? d.id === where.id : d.phone === where.phone)) || null,
      findFirst: async ({ where }) => db.drivers.find((d) => d.sessionHash === where.sessionHash) || null,
      findMany: async () => db.drivers.slice(),
      create: async ({ data }) => { const d = { id: 'd' + (db.drivers.length + 1), active: true, failedLogins: 0, lockedUntil: null, sessionHash: null, sessionExpiresAt: null, lastLoginAt: null, createdAt: new Date(), ...data }; db.drivers.push(d); return d; },
      update: async ({ where, data }) => { const d = db.drivers.find((x) => x.id === where.id); Object.assign(d, data); return d; },
    },
    order: {
      findMany: async ({ where }) => db.orders.filter((o) => match(o, where)).map((o) => ({ ...o, tavern: db.taverns.find((t) => t.id === o.tavernId) || null })),
      findUnique: async ({ where }) => { const o = db.orders.find((x) => x.id === where.id); return o ? { ...o, tavern: db.taverns.find((t) => t.id === o.tavernId) || null } : null; },
      count: async ({ where }) => db.orders.filter((o) => match(o, where)).length,
      updateMany: async ({ where, data }) => { const hit = db.orders.filter((o) => match(o, where)); hit.forEach((o) => Object.assign(o, data)); return { count: hit.length }; },
    },
    tavern: { findMany: async () => db.taverns },
    pushSubscription: { deleteMany: async () => ({ count: 0 }) },
  };
  const app = express();
  app.use(express.json());
  const pass = (req, res, next) => next();
  require('../routes/drivers.js')(app, { prisma, requireAdmin: pass, writeLimiter: pass, logAdminAction: async (req, a, t, d) => db.audit.push([a, t, d]), push: { sendToAdmins: async (p) => { db.pushes.push(p); } } });
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

const pendingOrder = (extra = {}) => ({ id: 'o1', code: 'EKO-AAA', status: 'PENDING', address: '12 Mali Street, Motherwell', deliveryLat: -33.801, deliveryLng: 25.601, deliveryFee: 40, surgeFee: 0, priorityFee: 0, paymentMethod: 'card', total: 500, driverPhone: null, driverName: null, tavernId: null, items: [{ quantity: 1, name: 'Castle' }], createdAt: new Date(), ...extra });

test('admin adds a driver, who signs in, takes a job once, and sees it as theirs', async () => {
  const { db, call, close } = await boot();
  try {
    const add = await call('POST', '/admin/drivers', { name: 'Sipho Dlamini', phone: '071 234 5678', vehicle: 'Silver Polo' });
    assert.equal(add.status, 200);
    assert.match(add.body.pin, /^\d{6}$/);
    assert.equal(db.drivers[0].phone, '27712345678');
    assert.ok(!('pinHash' in add.body.driver));
    assert.equal((await call('POST', '/admin/drivers', { name: 'Dup', phone: '0712345678' })).status, 409);

    assert.equal((await call('GET', '/api/driver/home')).status, 401);
    assert.equal((await call('POST', '/api/driver/login', { phone: '0712345678', pin: '000000' === add.body.pin ? '111111' : '000000' })).status, 401);
    const login = await call('POST', '/api/driver/login', { phone: '0712345678', pin: add.body.pin });
    assert.equal(login.status, 200);
    const token = login.body.token;
    assert.ok(!JSON.stringify(db.drivers[0]).includes(token), 'only a hash of the token is stored');

    db.orders.push(pendingOrder());
    let home = await call('GET', '/api/driver/home', null, token);
    assert.equal(home.body.board.length, 1);
    assert.equal(home.body.jobs.length, 0);
    assert.equal(home.body.board[0].id, 'o1');

    const take = await call('POST', '/api/driver/jobs/o1/take', null, token);
    assert.equal(take.status, 200);
    assert.equal(db.orders[0].driverPhone, '27712345678');
    assert.equal(db.orders[0].tavernId, 't1');
    assert.match(db.orders[0].collectionPin, /^\d{4}$/);
    assert.ok(db.orders[0].driverShareToken);
    assert.equal(db.pushes.length, 1);
    assert.ok(!db.pushes[0].body.includes(db.orders[0].collectionPin), 'the PIN is not put in a lock-screen alert');

    home = await call('GET', '/api/driver/home', null, token);
    assert.equal(home.body.board.length, 0);
    assert.equal(home.body.jobs.length, 1);
    assert.ok(home.body.jobs[0].link.includes('driver-track.html?code=EKO-AAA&token='));
    assert.ok(!JSON.stringify(home.body).includes(db.orders[0].collectionPin));

    // a second driver cannot take the same job
    const two = await call('POST', '/admin/drivers', { name: 'Themba', phone: '0821112222' });
    const t2 = (await call('POST', '/api/driver/login', { phone: '0821112222', pin: two.body.pin })).body.token;
    assert.equal((await call('POST', '/api/driver/jobs/o1/take', null, t2)).status, 409);
  } finally { close(); }
});

test('wrong PINs lock the account; reset and pause sign the driver out', async () => {
  const { db, call, close } = await boot();
  try {
    const add = await call('POST', '/admin/drivers', { name: 'Sipho', phone: '0712345678' });
    const bad = add.body.pin === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/driver/login', { phone: '0712345678', pin: bad })).status, 401);
    const locked = await call('POST', '/api/driver/login', { phone: '0712345678', pin: add.body.pin });
    assert.equal(locked.status, 429, 'even the right PIN waits while locked');

    const id = add.body.driver.id;
    const reset = await call('PATCH', `/admin/drivers/${id}`, { resetPin: true });
    assert.match(reset.body.pin, /^\d{6}$/);
    const login = await call('POST', '/api/driver/login', { phone: '0712345678', pin: reset.body.pin });
    assert.equal(login.status, 200);
    assert.equal((await call('GET', '/api/driver/home', null, login.body.token)).status, 200);

    await call('PATCH', `/admin/drivers/${id}`, { active: false });
    assert.equal((await call('GET', '/api/driver/home', null, login.body.token)).status, 401, 'paused = signed out at once');
    assert.equal((await call('POST', '/api/driver/login', { phone: '0712345678', pin: reset.body.pin })).status, 401);
    assert.ok(db.audit.length >= 3);
  } finally { close(); }
});

test('a driver cannot hold more than 3 jobs, and cannot take a job with no tavern', async () => {
  const { db, call, close } = await boot();
  try {
    const add = await call('POST', '/admin/drivers', { name: 'Sipho', phone: '0712345678' });
    const token = (await call('POST', '/api/driver/login', { phone: '0712345678', pin: add.body.pin })).body.token;
    for (let i = 1; i <= 4; i++) db.orders.push(pendingOrder({ id: 'o' + i, code: 'EKO-' + i }));
    for (let i = 1; i <= 3; i++) assert.equal((await call('POST', `/api/driver/jobs/o${i}/take`, null, token)).status, 200);
    assert.equal((await call('POST', '/api/driver/jobs/o4/take', null, token)).status, 400);
    db.orders.push(pendingOrder({ id: 'o9', code: 'EKO-9', deliveryLat: null, deliveryLng: null }));
    db.orders.find((o) => o.id === 'o1').status = 'DELIVERED';
    assert.equal((await call('POST', '/api/driver/jobs/o9/take', null, token)).status, 400);
  } finally { close(); }
});

test('the driver page and admin tab are wired in, noindex and safe', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/driver.html'), 'utf8');
  assert.ok(page.includes('noindex'));
  assert.ok(page.includes('/api/driver/login') && page.includes('/take'));
  assert.ok(page.includes('const esc ='));
  const admin = fs.readFileSync(path.join(__dirname, '../admin/admin.html'), 'utf8');
  assert.ok(admin.includes("showSection('drivers', this)") && admin.includes('id="driversSection"') && admin.includes('drivers.js'));
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  assert.ok(/model Driver \{/.test(schema));
  assert.ok(fs.existsSync(path.join(__dirname, '../prisma/migrations/20261120120000_add_drivers/migration.sql')));
});
