// Receipts and time stamps (22 Nov 2026): detailed receipt, order time, delivery time, emails, ownership.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const R = require('../public/receipt.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const order = (extra = {}) => ({
  code: 'EKO-AB12CD34', status: 'DELIVERED', paymentMethod: 'card', customerName: 'Thabo Mokoena', address: '12 Mali Street, Motherwell', landmark: 'blue gate',
  createdAt: '2026-11-22T12:02:10Z', paidAt: '2026-11-22T12:03:00Z', readyAt: '2026-11-22T12:10:00Z', assignedAt: '2026-11-22T12:08:00Z', pickedUpAt: '2026-11-22T12:15:30Z', deliveredAt: '2026-11-22T12:38:07Z',
  items: [{ name: 'Castle Lite (Can)', price: 130, quantity: 2 }, { name: 'Coca-Cola 500ml', price: 20, quantity: 3 }],
  deliveryFee: 40, surgeFee: 0, priorityFee: 0, serviceFee: 16, total: 316,
  driverName: 'Sipho Dlamini', driverVehicle: 'Silver Polo', tavern: { name: 'KwaSiba', area: 'Motherwell' },
  ...extra,
});

test('times are stamped in South African time with seconds, and durations are worked out', () => {
  assert.equal(R.stamp('2026-11-22T12:38:07Z'), '22 Nov 2026, 14:38:07');
  assert.equal(R.stamp('2026-11-22T22:30:00Z'), '23 Nov 2026, 00:30:00', 'midnight rolls over in SA time');
  assert.equal(R.shortStamp('2026-11-22T12:02:10Z'), '22 Nov 14:02');
  assert.equal(R.duration('2026-11-22T12:15:30Z', '2026-11-22T12:38:07Z'), '23 min');
  assert.equal(R.duration('2026-11-22T12:00:00Z', '2026-11-22T13:05:00Z'), '1 h 5 min');
  assert.equal(R.stamp(null), '');
});

test('the receipt lists every item, every fee, and adds up to the total', () => {
  const r = R.buildReceipt(order());
  assert.equal(r.title, 'Delivery receipt');
  assert.equal(r.subtotal, 320);
  assert.deepEqual(r.lines.map((l) => [l.label, l.amount]), [['Delivery', 40], ['Care & Handling', 16], ['Discount (Cooler Box)', -60]]);
  const sum = r.subtotal + r.lines.reduce((s, l) => s + l.amount, 0);
  assert.equal(Math.round(sum * 100) / 100, r.total, 'lines always add up to the total');
  assert.equal(r.items[0].line, 260);
  assert.equal(r.payment, 'Card (Yoco)');
  assert.equal(r.outlet, 'KwaSiba (Motherwell)');
  assert.equal(r.driver, 'Sipho Dlamini (Silver Polo)');
  assert.equal(R.buildReceipt(order({ total: 400 })).lines.slice(-1)[0].label, 'Other charges', 'an unexplained difference is shown, never hidden');
  assert.equal(R.buildReceipt(order({ promoDiscount: 25, promoCode: 'WELCOME', total: 351 })).lines[0].label, 'Promo WELCOME');
});

test('the receipt proves the order time AND the delivery time the driver confirmed', () => {
  const r = R.buildReceipt(order());
  assert.equal(r.orderedAt, '22 Nov 2026, 14:02:10');
  assert.equal(r.deliveredAt, '22 Nov 2026, 14:38:07');
  assert.equal(r.orderToDelivery, '36 min');
  assert.equal(r.pickupToDelivery, '23 min');
  const html = R.renderReceiptHtml(r, { link: 'https://x.test/receipt.html?code=EKO-AB12CD34' });
  for (const must of ['Delivery receipt', 'EKO-AB12CD34', '22 Nov 2026, 14:02:10', '22 Nov 2026, 14:38:07', 'Castle Lite (Can)', 'Care &amp; Handling', 'Total paid', 'R316.00', 'Collected by the driver', 'KwaSiba', 'not yet registered for VAT', '2020/465422/07']) {
    assert.ok(html.includes(must), `receipt must include: ${must}`);
  }
  assert.ok(!/tax invoice\b(?!,)/i.test(html.replace('is not a tax invoice', '')), 'never calls itself a tax invoice while we are not VAT registered');
});

test('an order that is not delivered yet shows the order time and says delivery is pending; cash shows pay on delivery', () => {
  const placed = R.buildReceipt(order({ status: 'PENDING', deliveredAt: null, pickedUpAt: null, readyAt: null, assignedAt: null, paymentMethod: 'cod' }));
  assert.equal(placed.title, 'Order receipt');
  assert.equal(placed.deliveredAt, '');
  const html = R.renderReceiptHtml(placed);
  assert.match(html, /Order placed/);
  assert.match(html, /once it arrives/);
  assert.match(html, /Cash on delivery/);
  assert.equal(R.buildReceipt(order({ status: 'CANCELLED', deliveredAt: null })).title, 'Cancelled order');
});

test('customer-typed text cannot inject markup into a receipt', () => {
  const html = R.renderReceiptHtml(R.buildReceipt(order({ customerName: '<script>alert(1)</script>', address: '"><img src=x onerror=1>', items: [{ name: '<b>x</b>', price: 1, quantity: 1 }], total: 100 })));
  assert.ok(!html.includes('<script>') && !html.includes('<img') && !html.includes('<b>x</b>'));
});

test('admin one-line summary shows every stamp', () => {
  const t = R.timelineText(order());
  for (const bit of ['Ordered 22 Nov 14:02', 'Paid 22 Nov 14:03', 'Ready 22 Nov 14:10', 'Assigned 22 Nov 14:08', 'Collected 22 Nov 14:15', 'Delivered 22 Nov 14:38 (23 min from pickup)']) assert.ok(t.includes(bit), bit);
});

test('the seller details on the receipt match the Terms', () => {
  const terms = read('public/terms.html');
  for (const v of [R.SELLER.legalName, R.SELLER.registration, R.SELLER.tradingName, R.SELLER.address]) assert.ok(terms.includes(v), `Terms must carry ${v}`);
});

test('emails: placing an order and delivery both send the detailed receipt', async () => {
  const sent = [];
  const realFetch = global.fetch;
  process.env.RESEND_API_KEY = 're_test';
  global.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({}), text: async () => '' }; };
  try {
    delete require.cache[require.resolve('../emails.js')];
    const E = require('../emails.js');
    await E.sendOrderConfirmationEmail(order({ status: 'PENDING', deliveredAt: null, deliveryPin: '4821' }), 'thabo@example.com');
    await E.sendDeliveryReceiptEmail(order({ customerEmail: 'thabo@example.com' }));
    await E.sendDeliveryReceiptEmail(order({ customerEmail: '' }));
  } finally { global.fetch = realFetch; delete process.env.RESEND_API_KEY; delete require.cache[require.resolve('../emails.js')]; }
  assert.equal(sent.length, 2, 'no email without an address');
  assert.match(sent[0].subject, /Order confirmed/);
  assert.ok(sent[0].html.includes('22 Nov 2026, 14:02:10') && sent[0].html.includes('4821') && sent[0].html.includes('Order receipt'));
  assert.match(sent[1].subject, /Your Ekoyini receipt — EKO-AB12CD34 \(delivered 22 Nov 2026, 14:38:07\)/);
  assert.ok(sent[1].html.includes('22 Nov 2026, 14:38:07') && sent[1].html.includes('Delivery receipt') && sent[1].html.includes('receipt.html?code=EKO-AB12CD34'));
});

test('route: only the customer who placed the order can open the receipt', async () => {
  const orders = [{ ...order(), userId: 'u1', items: order().items }];
  const prisma = { order: { findUnique: async ({ where }) => orders.find((o) => o.code === where.code) || null } };
  const app = express();
  let user = { id: 'u1' };
  require('../routes/receipt.js')(app, { prisma, requireUser: (req, res, next) => { req.user = user; next(); } });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const get = async (code) => { const res = await fetch(`http://127.0.0.1:${server.address().port}/api/order/${code}/receipt`); return { status: res.status, body: await res.json() }; };
  try {
    const mine = await get('EKO-AB12CD34');
    assert.equal(mine.status, 200);
    assert.equal(mine.body.receipt.deliveredAt, '22 Nov 2026, 14:38:07');
    assert.ok(!JSON.stringify(mine.body).match(/customerPhone|deliveryPin|collectionPin|driverPhone/), 'no PINs or phone numbers on a receipt');
    user = { id: 'someone-else' };
    assert.equal((await get('EKO-AB12CD34')).status, 404, "someone else's receipt");
    assert.equal((await get('EKO-NOPE0000')).status, 404);
  } finally { server.close(); }
});

test('wiring: both delivery paths email the receipt; pages and service worker carry the receipt files', () => {
  const server = read('server.js');
  assert.match(server, /emailDeliveryReceipt\(req\.params\.code\)/, 'driver PIN-proven delivery');
  assert.match(server, /if \(status === "DELIVERED"\) emailDeliveryReceipt\(order\.code\)/, 'admin delivered');
  assert.match(server, /deliveredAt: true,\n\s+driverLat/, 'track page gets the delivery time');
  assert.match(read('public/receipt.html'), /requireAuth/);
  assert.match(read('public/track.html'), /View your receipt/);
  assert.match(read('admin/admin-api.js'), /timelineText/);
  assert.match(read('public/sw.js'), /\/receipt\.js/);
  assert.match(read('public/terms.html'), /final receipt when the driver confirms delivery/);
});
