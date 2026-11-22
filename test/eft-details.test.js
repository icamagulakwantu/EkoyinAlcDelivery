// EFT banking details (22 Nov 2026): kept in env vars, shown only for an EFT order waiting for payment.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getEftDetails, spaced } = require('../lib/eft-details.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const env = { EFT_BANK_NAME: 'GoTyme Bank', EFT_ACCOUNT_NAME: 'Tanduxolo Makeleni', EFT_ACCOUNT_NUMBER: '5300 2280 660', EFT_ACCOUNT_TYPE: 'Current', EFT_BRANCH_CODE: '678910' };

test('details are read from the environment and cleaned up', () => {
  const d = getEftDetails(env);
  assert.equal(d.accountNumber, '53002280660');
  assert.equal(d.branchCode, '678910');
  assert.equal(spaced(d.accountNumber), '5300 2280 660');
  assert.equal(getEftDetails({ ...env, EFT_ACCOUNT_TYPE: '' }).accountType, 'Current');
});

test('missing or malformed details show nothing, so dispatch sends them as before', () => {
  assert.equal(getEftDetails({}), null);
  for (const bad of [{ EFT_ACCOUNT_NUMBER: '12ab' }, { EFT_ACCOUNT_NUMBER: '123' }, { EFT_BRANCH_CODE: '12' }, { EFT_BANK_NAME: '' }, { EFT_ACCOUNT_NAME: ' ' }]) assert.equal(getEftDetails({ ...env, ...bad }), null, JSON.stringify(bad));
});

test('the account is never written into the code or the pages', () => {
  for (const f of ['lib/eft-details.js', 'public/eft-box.js', 'public/order-confirmation.html', 'public/track.html', 'public/terms.html', 'emails.js', 'server.js', 'README.md']) {
    assert.ok(!/5300\s?2280\s?660|9203145470085/.test(read(f)), f);
  }
});

test('the route gives details only for an EFT order that is waiting for payment', () => {
  const server = read('server.js');
  const route = server.slice(server.indexOf('app.get("/api/order/:code/eft"'), server.indexOf('app.get("/api/order/:code/track"'));
  assert.match(route, /paymentMethod !== "eft" \|\| order\.status !== "PAYMENT_PENDING"/);
  assert.match(route, /trackLimiter/);
  assert.match(route, /no-store/);
  assert.match(route, /reference: order\.code/);
});

test('the confirmation email carries the banking box only while an EFT is waiting', () => {
  const email = read('emails.js');
  assert.match(email, /function eftEmailBlock/);
  assert.match(email, /order\.paymentMethod !== "eft" \|\| order\.status !== "PAYMENT_PENDING"\) return ""/);
  assert.match(email, /Pay by EFT to start your order/);
});

test('both customer pages show the box and the Terms warn about other accounts', () => {
  assert.match(read('public/order-confirmation.html'), /EkoyiniEft\.mount/);
  assert.match(read('public/track.html'), /EkoyiniEft\.mount/);
  assert.match(read('public/sw.js'), /\/eft-box\.js/);
  assert.match(read('public/terms.html'), /Never pay into any other account/);
});
