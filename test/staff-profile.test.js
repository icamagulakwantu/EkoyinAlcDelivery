// Staff files: SA ID check, validation, encryption, masking, status, and the super-admin routes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const S = require('../lib/staff-profile.js');

const KEY = 'unit-test-staff-key-0123456789abcdef-xyz';
const ENV = { STAFF_DATA_KEY: KEY };
const NOW = new Date('2026-11-22T10:00:00Z');

// Builds a valid 13-digit SA ID for a birth date (check digit by the Luhn rule).
function makeId(yyMMdd, seq = '5009', citizen = '0') {
  const first12 = yyMMdd + seq + citizen + '8';
  for (let c = 0; c <= 9; c++) if (S.luhnOk(first12 + c)) return first12 + c;
}
const GOOD_ID = makeId('900315');
const goodDriver = (extra = {}) => ({
  fullName: 'Sipho Dlamini', idNumber: GOOD_ID, phone: '071 234 5678', email: 'Sipho@Example.com',
  addressLine: '12 Mali Street', suburb: 'Motherwell', city: 'Gqeberha', postalCode: '6001',
  licenceNumber: 'ab123456789', licenceCode: 'B', licenceExpiry: '2028-05-01',
  vehicleMake: 'VW', vehicleModel: 'Polo', vehicleColour: 'Silver', vehicleYear: 2016,
  numberPlate: 'ec 12 ab gp', vehicleRegNumber: 'rc12345678', vehicleDiscExpiry: '2027-03-31',
  bankName: 'Capitec', accountHolder: 'S Dlamini', accountNumber: '1234567890', branchCode: '470010', accountType: 'savings',
  ...extra,
});
const goodDispatcher = (extra = {}) => ({
  fullName: 'Nomsa Khumalo', idNumber: makeId('880722', '0123'), phone: '0821234567', email: 'nomsa@example.com',
  addressLine: '4 Ndlovu Road', suburb: 'Zwide', city: 'Gqeberha', postalCode: '6201', ...extra,
});

test('SA ID check: real ones pass; wrong length, fake date, bad check digit, minors fail', () => {
  assert.equal(S.checkSaId(GOOD_ID, NOW).ok, true);
  assert.equal(S.checkSaId(GOOD_ID.replace(/(\d{4})(\d{4})(\d{5})/, '$1 $2 $3'), NOW).ok, true, 'spaces are fine');
  assert.equal(S.checkSaId('12345', NOW).ok, false);
  assert.equal(S.checkSaId(GOOD_ID.slice(0, 12) + ((Number(GOOD_ID[12]) + 1) % 10), NOW).ok, false, 'check digit');
  assert.equal(S.checkSaId(makeId('901332'), NOW).ok, false, '32nd day');
  assert.equal(S.checkSaId(makeId('900230'), NOW).ok, false, '30 February');
  assert.equal(S.checkSaId(makeId('900315', '5009', '2'), NOW).ok, false, 'citizenship digit must be 0 or 1');
  assert.match(S.checkSaId(makeId('100101'), NOW).error, /18/, 'born 2010 is a minor');
  assert.equal(S.checkSaId(makeId('080101'), NOW).ok, true, 'born 2008 is 18 in 2026');
});

test('sensitive values are encrypted, differ each time, and fail if tampered with or the key is missing', () => {
  const a = S.encrypt(GOOD_ID, ENV), b = S.encrypt(GOOD_ID, ENV);
  assert.notEqual(a, b, 'random IV');
  assert.ok(!a.includes(GOOD_ID));
  assert.equal(S.decrypt(a, ENV), GOOD_ID);
  const parts = a.split(':'); parts[3] = Buffer.from('tampered').toString('base64');
  assert.throws(() => S.decrypt(parts.join(':'), ENV));
  assert.throws(() => S.decrypt(a, { STAFF_DATA_KEY: 'another-key-another-key-another-key-123' }));
  assert.equal(S.isConfigured({}), false);
  assert.equal(S.isConfigured({ STAFF_DATA_KEY: 'short' }), false, 'key must be 32+ characters');
  assert.throws(() => S.encrypt('x', {}), /STAFF_DATA_KEY/);
  assert.equal(S.idHash(GOOD_ID, ENV), S.idHash(GOOD_ID.replace(/(\d{6})/, '$1 '), ENV));
  assert.notEqual(S.idHash(GOOD_ID, ENV), S.idHash(makeId('880722', '0123'), ENV));
});

test('a driver file needs ID, address, licence, vehicle, plate and bank details', () => {
  const ok = S.validateProfile('DRIVER', goodDriver(), null, NOW);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.clean.numberPlate, 'EC12ABGP');
  assert.equal(ok.clean.email, 'sipho@example.com');
  assert.equal(ok.clean.phone, '27712345678');
  assert.equal(ok.clean.licenceNumber, 'AB123456789');
  for (const [field, value] of [
    ['idNumber', ''], ['idNumber', '9003155009087'], ['fullName', 'Sipho'], ['email', 'nope'], ['phone', '123'], ['postalCode', '60'],
    ['licenceNumber', ''], ['licenceCode', 'Z'], ['licenceExpiry', '2026-11-21'], ['licenceExpiry', ''],
    ['numberPlate', 'ABCD'], ['numberPlate', ''], ['vehicleRegNumber', ''], ['vehicleDiscExpiry', '2026-01-01'], ['vehicleMake', ''],
    ['bankName', ''], ['accountNumber', ''], ['accountNumber', '123'], ['branchCode', '12345'], ['accountType', 'GOLD'],
  ]) {
    assert.ok(S.validateProfile('DRIVER', goodDriver({ [field]: value }), null, NOW).errors.length > 0, `${field}=${JSON.stringify(value)} must be refused`);
  }
  assert.deepEqual(S.validateProfile('DRIVER', goodDriver({ licenceExpiry: '2026-11-22' }), null, NOW).errors, [], 'expires today is still valid today');
});

test('a dispatcher file needs ID, email and home address; bank details optional but complete if started', () => {
  assert.deepEqual(S.validateProfile('DISPATCHER', goodDispatcher(), null, NOW).errors, []);
  assert.ok(S.validateProfile('DISPATCHER', goodDispatcher({ addressLine: '' }), null, NOW).errors.length);
  assert.ok(S.validateProfile('DISPATCHER', goodDispatcher({ bankName: 'FNB' }), null, NOW).errors.length, 'half a bank record is refused');
  assert.deepEqual(S.validateProfile('DISPATCHER', goodDispatcher({ bankName: 'FNB', accountHolder: 'N Khumalo', accountNumber: '62012345678', branchCode: '250655', accountType: 'CHEQUE' }), null, NOW).errors, []);
  assert.deepEqual(S.validateProfile('DISPATCHER', goodDispatcher({ licenceNumber: 'x' }), null, NOW).clean.licenceNumber, undefined, 'dispatchers do not carry licence data');
  assert.ok(S.validateProfile('NOPE', {}, null, NOW).errors.length);
});

test('editing: blank ID, licence or account number keeps the saved one', () => {
  const existing = { licenceNumberEnc: 'x', accountNumberEnc: 'y', bankName: 'Capitec' };
  const r = S.validateProfile('DRIVER', goodDriver({ idNumber: '', licenceNumber: '', accountNumber: '' }), existing, NOW);
  assert.deepEqual(r.errors, []);
  assert.equal(r.clean.idNumber, undefined);
  assert.ok(S.validateProfile('DRIVER', goodDriver({ idNumber: '', licenceNumber: '', accountNumber: '' }), null, NOW).errors.length, 'but a new file needs them');
});

test('status: missing, unverified, verified, expiring soon, expired', () => {
  const soon = new Date('2026-12-10T00:00:00Z'), later = new Date('2028-01-01T00:00:00Z'), past = new Date('2026-10-01T00:00:00Z');
  assert.equal(S.profileStatus('DRIVER', null, NOW).code, 'MISSING');
  assert.equal(S.profileStatus('DRIVER', { verified: false, licenceExpiry: later, vehicleDiscExpiry: later }, NOW).code, 'UNVERIFIED');
  assert.deepEqual(S.profileStatus('DRIVER', { verified: true, licenceExpiry: later, vehicleDiscExpiry: later }, NOW), { code: 'VERIFIED', label: 'Verified', ok: true, flags: [] });
  const warn = S.profileStatus('DRIVER', { verified: true, licenceExpiry: soon, vehicleDiscExpiry: later }, NOW);
  assert.equal(warn.code, 'VERIFIED'); assert.match(warn.flags[0], /Licence expires in 18 days/);
  const exp = S.profileStatus('DRIVER', { verified: true, licenceExpiry: later, vehicleDiscExpiry: past }, NOW);
  assert.equal(exp.code, 'EXPIRED'); assert.equal(exp.ok, false);
  assert.equal(S.profileStatus('DISPATCHER', { verified: true }, NOW).code, 'VERIFIED', 'dispatchers have no licence to expire');
});

test('the admin view never contains encrypted values, hashes or full numbers', () => {
  const p = { id: 'p1', kind: 'DRIVER', fullName: 'Sipho Dlamini', email: 'a@b.co', phone: '27712345678', addressLine: 'x', suburb: 'y', city: 'z', postalCode: '6001',
    idNumberEnc: 'v1:SECRETENC', idNumberHash: 'HASHVALUE', idLast4: '5087', licenceNumberEnc: 'v1:LICENC', licenceLast4: '6789', accountNumberEnc: 'v1:ACCENC', accountLast4: '7890', verified: false };
  const json = JSON.stringify(S.publicView(p));
  assert.ok(!/SECRETENC|HASHVALUE|LICENC|ACCENC|Enc"/.test(json));
  assert.match(json, /•••• 5087/);
});

// ── routes, with an in-memory database ──────────────────────────────────
function fakePrisma() {
  const profiles = [];
  const drivers = [{ id: 'd1', name: 'Sipho Dlamini', phone: '27712345678', active: true, createdAt: new Date() }];
  const admins = [{ email: 'nomsa@example.com', role: 'DISPATCHER', createdAt: new Date() }];
  const match = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  let n = 0;
  return {
    _profiles: profiles,
    driver: { findUnique: async ({ where }) => drivers.find((d) => match(d, where)) || null, findMany: async () => drivers },
    adminUser: { findUnique: async ({ where }) => admins.find((a) => match(a, where)) || null, findMany: async () => admins },
    staffProfile: {
      findUnique: async ({ where }) => profiles.find((p) => match(p, where)) || null,
      findMany: async () => profiles.map((p) => ({ ...p })),
      create: async ({ data }) => { const p = { id: 'p' + ++n, createdAt: new Date(), updatedAt: new Date(), driverId: null, adminEmail: null, ...data }; profiles.push(p); return p; },
      update: async ({ where, data }) => { const p = profiles.find((x) => x.id === where.id); Object.assign(p, data, { updatedAt: new Date() }); return p; },
    },
  };
}

async function startApp({ role = 'SUPER_ADMIN', key = KEY } = {}) {
  process.env.STAFF_DATA_KEY = key || '';
  const prisma = fakePrisma();
  const logs = [];
  const app = express();
  app.use(express.json());
  const requireAdmin = (req, res, next) => { req.user = { email: 'boss@example.com' }; req.adminRole = role; next(); };
  const requireSuperAdmin = (req, res, next) => (req.adminRole === 'SUPER_ADMIN' ? next() : res.status(403).json({ error: 'Super-admin only' }));
  require('../routes/staff.js')(app, { prisma, requireAdmin, requireSuperAdmin, writeLimiter: (q, s, nx) => nx(), logAdminAction: async (req, action, target, detail) => logs.push({ action, target, detail }) });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})), text: null };
  };
  return { call, prisma, logs, close: () => server.close() };
}

test('routes: save a driver file, ID/licence/account are stored encrypted, list and form show only the last digits', async () => {
  const t = await startApp();
  try {
    const saved = await t.call('PUT', '/admin/staff/driver/d1', goodDriver());
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const row = t.prisma._profiles[0];
    for (const v of [GOOD_ID, 'AB123456789', '1234567890']) assert.ok(!JSON.stringify(row).includes(v), 'no plain sensitive value in the database row');
    assert.equal(S.decrypt(row.idNumberEnc), GOOD_ID);
    assert.equal(row.idLast4, GOOD_ID.slice(-4));
    assert.equal(row.verified, false);
    const list = await t.call('GET', '/admin/staff');
    const driver = list.body.people.find((p) => p.kind === 'DRIVER');
    assert.equal(driver.status.code, 'UNVERIFIED');
    assert.equal(list.body.people.find((p) => p.kind === 'DISPATCHER').status.code, 'MISSING');
    const form = await t.call('GET', '/admin/staff/driver/d1');
    const json = JSON.stringify(form.body);
    for (const v of [GOOD_ID, 'AB123456789', '1234567890', 'Enc', 'Hash']) assert.ok(!json.includes(v), `form must not leak ${v}`);
    assert.equal(t.logs[0].action, 'CREATE_STAFF_FILE');
    assert.ok(!JSON.stringify(t.logs).includes(GOOD_ID), 'activity log has no sensitive values');
  } finally { t.close(); }
});

test('routes: reveal decrypts and is logged; verify needs a file, and any edit removes the tick', async () => {
  const t = await startApp();
  try {
    assert.equal((await t.call('POST', '/admin/staff/driver/d1/verify', { verified: true })).status, 404, 'no file yet');
    await t.call('PUT', '/admin/staff/driver/d1', goodDriver());
    const rev = await t.call('POST', '/admin/staff/driver/d1/reveal');
    assert.equal(rev.body.idNumber, GOOD_ID);
    assert.equal(rev.body.accountNumber, '1234567890');
    assert.ok(t.logs.some((l) => l.action === 'VIEW_STAFF_SENSITIVE'), 'every reveal is logged');
    const v = await t.call('POST', '/admin/staff/driver/d1/verify', { verified: true });
    assert.equal(v.body.status.code, 'VERIFIED');
    assert.equal(t.prisma._profiles[0].verifiedBy, 'boss@example.com');
    await t.call('PUT', '/admin/staff/driver/d1', goodDriver({ idNumber: '', licenceNumber: '', accountNumber: '', suburb: 'Kwazakhele' }));
    assert.equal(t.prisma._profiles[0].verified, false, 'editing removes the verified tick');
    assert.equal(S.decrypt(t.prisma._profiles[0].idNumberEnc), GOOD_ID, 'blank sensitive fields kept the saved ones');
  } finally { t.close(); }
});

test('routes: the same ID cannot be filed for two people; dispatchers work by email', async () => {
  const t = await startApp();
  try {
    await t.call('PUT', '/admin/staff/driver/d1', goodDriver());
    const dup = await t.call('PUT', '/admin/staff/dispatcher/nomsa%40example.com', goodDispatcher({ idNumber: GOOD_ID }));
    assert.equal(dup.status, 409);
    const ok = await t.call('PUT', '/admin/staff/dispatcher/nomsa%40example.com', goodDispatcher());
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(t.prisma._profiles[1].adminEmail, 'nomsa@example.com');
    assert.equal((await t.call('GET', '/admin/staff/dispatcher/someone%40else.com')).status, 404);
  } finally { t.close(); }
});

test('routes: refuse to save without the encryption key; dispatchers (non super-admins) are locked out', async () => {
  const noKey = await startApp({ key: '' });
  try {
    const r = await noKey.call('PUT', '/admin/staff/driver/d1', goodDriver());
    assert.equal(r.status, 503);
    assert.equal(noKey.prisma._profiles.length, 0, 'nothing saved');
    assert.equal((await noKey.call('GET', '/admin/staff')).body.keyReady, false);
  } finally { noKey.close(); }
  const dispatcher = await startApp({ role: 'DISPATCHER' });
  try {
    for (const [m, u] of [['GET', '/admin/staff'], ['GET', '/admin/staff/driver/d1'], ['PUT', '/admin/staff/driver/d1'], ['POST', '/admin/staff/driver/d1/reveal'], ['POST', '/admin/staff/driver/d1/verify']]) {
      assert.equal((await dispatcher.call(m, u, {})).status, 403, `${m} ${u}`);
    }
  } finally { dispatcher.close(); }
});

test('wiring: the table, migration, mount and admin tab exist, and the list never selects encrypted columns', () => {
  const root = path.join(__dirname, '..');
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  assert.match(read('prisma/schema.prisma'), /model StaffProfile/);
  const mig = fs.readdirSync(path.join(root, 'prisma/migrations')).filter((d) => /staff_profiles/.test(d));
  assert.equal(mig.length, 1);
  assert.match(read(`prisma/migrations/${mig[0]}/migration.sql`), /CREATE TABLE IF NOT EXISTS "StaffProfile"/);
  assert.match(read('routes/index.js'), /staff\.js/);
  assert.match(read('admin/admin.html'), /sectionTabStaff/);
  assert.match(read('admin/admin.html'), /staff\.js/);
  const select = read('routes/staff.js').match(/PUBLIC_SELECT = \{[^}]*\}/)[0];
  assert.ok(!/Enc|Hash/.test(select));
});
