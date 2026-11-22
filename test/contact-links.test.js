// WhatsApp contact between customer, driver and dispatcher (22 Nov 2026): links, messages, and when numbers show.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../public/contact-links.js');
const { driverContactFor } = require('../lib/track-contact.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('South African numbers become WhatsApp links in every common format', () => {
  for (const n of ['071 973 6683', '+27 71 973 6683', '27719736683', '0719736683', '719736683']) assert.equal(C.waNumber(n), '27719736683', n);
  assert.equal(C.waNumber('12345'), '');
  assert.equal(C.waLink('abc', 'hi'), '');
  assert.equal(C.waLink('071 973 6683', 'Hi there & welcome'), 'https://wa.me/27719736683?text=Hi%20there%20%26%20welcome');
  assert.equal(C.telLink('071 973 6683'), 'tel:+27719736683');
});

test('messages carry the order code and, where it helps, the live tracking link', () => {
  const origin = 'https://www.ekoyini.co.za';
  const toCustomer = C.driverToCustomer({ customerName: 'Thabo Mokoena', driverName: 'Sipho Dlamini', code: 'EKO-AB12CD34', origin });
  assert.match(toCustomer, /Hi Thabo/);
  assert.match(toCustomer, /Sipho from Ekoyini/);
  assert.ok(toCustomer.includes('https://www.ekoyini.co.za/track.html?code=EKO-AB12CD34'), 'driver message has the live tracking link');
  const dispatch = C.dispatchToCustomer({ customerName: 'Thabo', code: 'EKO-AB12CD34', driverName: 'Sipho Dlamini', driverVehicle: 'Silver Polo', origin });
  assert.match(dispatch, /Sipho Dlamini \(Silver Polo\) is delivering it/);
  assert.ok(dispatch.includes('track.html?code=EKO-AB12CD34'));
  assert.ok(!/is delivering it/.test(C.dispatchToCustomer({ customerName: 'Thabo', code: 'EKO-1', origin })), 'no driver yet, no claim about one');
  assert.match(C.customerToDriver({ driverName: 'Sipho Dlamini', code: 'EKO-AB12CD34' }), /Hi Sipho.*EKO-AB12CD34/);
  assert.match(C.dispatchToDriver({ driverName: 'Sipho', code: 'EKO-1' }), /dispatch/i);
});

test("the driver's live map link only exists while the position is fresh", () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const o = (minsAgo) => ({ driverLat: -33.9, driverLng: 25.6, driverLocationAt: new Date(now - minsAgo * 60000).toISOString() });
  assert.equal(C.driverMapUrl(o(2), now), 'https://www.google.com/maps?q=-33.9,25.6');
  assert.equal(C.driverMapUrl(o(30), now), '', 'stale');
  assert.equal(C.driverMapUrl({ driverLat: null, driverLng: null }, now), '');
  assert.equal(C.driverMapUrl(null, now), '');
});

test("the customer only gets the driver's number while the order is out for delivery", () => {
  const base = { driverPhone: '27719736683', driverName: 'Sipho' };
  assert.equal(driverContactFor({ ...base, status: 'DISPATCHED' }), '27719736683');
  for (const status of ['PAYMENT_PENDING', 'PENDING', 'DELIVERED', 'CANCELLED']) assert.equal(driverContactFor({ ...base, status }), null, status);
  assert.equal(driverContactFor({ status: 'DISPATCHED' }), null, 'no driver number saved');
  assert.equal(driverContactFor(null), null);
});

test('wiring: public track route uses the rule and never selects customer details; pages load the helper', () => {
  const server = read('server.js');
  const route = server.slice(server.indexOf('app.get("/api/order/:code/track"'), server.indexOf('// ⭐ CUSTOMER: RATE A DELIVERED ORDER'));
  assert.match(route, /driverPhone: true/);
  assert.match(route, /order\.driverPhone = driverContactFor\(order\)/);
  assert.ok(!/customerPhone|customerName|address:|driverShareToken|collectionPin|deliveryPin/.test(route), 'track route must not expose customer data or PINs');
  for (const page of ['public/track.html', 'public/driver.html', 'admin/admin.html']) assert.match(read(page), /contact-links\.js/, page);
  assert.match(read('public/sw.js'), /\/contact-links\.js/);
  assert.match(read('admin/admin-api.js'), /whatsAppCustomer/);
  assert.match(read('public/driver.html'), /WhatsApp customer/);
  assert.match(read('public/track.html'), /Call driver/);
});

test('at pickup the live location goes to dispatch (phone alert) and the driver gets WhatsApp buttons for customer and dispatch (22 Nov)', () => {
  const msg = C.driverToDispatch({ driverName: 'Sipho Dlamini', code: 'EKO-AB12', origin: 'https://www.ekoyini.co.za' });
  assert.match(msg, /collected order EKO-AB12/);
  assert.match(msg, /track\.html\?code=EKO-AB12/);
  assert.match(C.waLink(C.DISPATCH_WHATSAPP, msg), /^https:\/\/wa\.me\/27640045465\?text=/);
  const server = read('server.js');
  const pickup = server.slice(server.indexOf('app.post("/order/:code/confirm-pickup"'), server.indexOf('// 🏁 DRIVER: CONFIRM DELIVERED'));
  assert.match(pickup, /push\.sendToAdmins\(/, 'dispatch phones are alerted at pickup');
  assert.match(pickup, /contact: driverShareContact\(order\)/);
  const contact = server.slice(server.indexOf('app.post("/order/:code/driver-contact"'), server.indexOf('// 🚚 DRIVER: CONFIRM PICKUP'));
  assert.match(contact, /driverTokenMatches/, 'customer number only for the driver token holder');
  assert.match(contact, /status !== "DISPATCHED"/, 'only while out for delivery');
  const page = read('public/driver-track.html');
  assert.match(page, /contact-links\.js/);
  assert.match(page, /Send live location to the customer on WhatsApp/);
  assert.match(page, /Send live location to dispatch on WhatsApp/);
});
