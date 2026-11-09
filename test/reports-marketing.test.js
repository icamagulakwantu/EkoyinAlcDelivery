// Reports, CSV export safety and signed unsubscribe links.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, toCsv, csvCell, areaOf } = require('../lib/reports.js');
const { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } = require('../lib/marketing.js');

const now = new Date('2026-11-09T12:00:00Z');
const order = (o) => ({ createdAt: '2026-11-07T17:30:00Z', status: 'DELIVERED', total: 500, paymentMethod: 'card', address: '12 Vilakazi St, Motherwell NU10', userId: 'u1', items: [{ name: 'Castle Lager', quantity: 2, price: 100 }], ...o });

test('report counts only real sales and groups by SA time, area and product', () => {
  const r = buildReport([
    order({}),
    order({ userId: 'u1', total: 300, items: [{ name: 'Gin', quantity: 1, price: 300 }] }),
    order({ userId: 'u2', status: 'CANCELLED' }),
    order({ userId: 'u3', status: 'PAYMENT_PENDING' }),
    order({ createdAt: '2026-09-01T10:00:00Z' }), // outside 30 days
  ], { days: 30, now });
  assert.equal(r.orders, 2);
  assert.equal(r.revenue, 800);
  assert.equal(r.averageOrder, 400);
  assert.equal(r.cancelled, 1);
  assert.equal(r.awaitingPayment, 1);
  assert.equal(r.repeatRate, 100); // u1 ordered twice
  assert.equal(r.topAreas[0].name, 'Motherwell NU10');
  assert.equal(r.topProducts[0].name, 'Gin');
  assert.equal(r.busiestHours[0].name, '19:00'); // 17:30 UTC = 19:30 SA
  assert.equal(r.byDay[6].count, 2); // Saturday 7 Nov
});

test('areas never include the street address', () => {
  assert.equal(areaOf('12 Vilakazi St, Motherwell NU10'), 'Motherwell NU10');
  assert.equal(areaOf('7A Main Rd, 22 Zwide'), 'Zwide');
  assert.equal(areaOf('just a street 5'), 'Unknown');
});

test('CSV cells cannot run as spreadsheet formulas', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(csvCell('+27 72 123 4567'), "'+27 72 123 4567");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('Thandeka, Zwide'), '"Thandeka, Zwide"');
  assert.equal(toCsv(['a', 'b'], [[1, null]]), 'a,b\r\n1,\r\n');
});

test('unsubscribe links are signed per customer and cannot be forged', () => {
  const t = unsubscribeToken('user-1', 'secret');
  assert.ok(verifyUnsubscribeToken('user-1', t, 'secret'));
  assert.equal(verifyUnsubscribeToken('user-2', t, 'secret'), false, 'token is tied to the user');
  assert.equal(verifyUnsubscribeToken('user-1', t, 'other-secret'), false);
  assert.equal(verifyUnsubscribeToken('user-1', 'x', 'secret'), false);
  assert.equal(unsubscribeToken('user-1', ''), null, 'no secret, no links');
  assert.match(unsubscribeUrl('https://www.ekoyini.co.za/', 'user-1', 'secret'), /^https:\/\/www\.ekoyini\.co\.za\/unsubscribe\.html\?u=user-1&t=/);
});
