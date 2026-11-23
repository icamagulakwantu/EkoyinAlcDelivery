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
  assert.match(read('public/terms.html'), /do <b>not<\/b> pack, dispatch or deliver an EFT order until the money has actually reflected/);
});

test('customers are told to pay immediately everywhere the banking details appear', () => {
  for (const f of ['public/checkout.html', 'public/eft-box.js', 'public/order-confirmation.html', 'public/track.html', 'emails.js', 'public/terms.html']) assert.match(read(f), /PayShap/, f);
});

test('choosing EFT at checkout shows the reminder, and only then', () => {
  const c = read('public/checkout.html');
  assert.match(c, /id="eftNotice"/);
  assert.match(c, /pay by "Immediate payment" or PayShap only/);
  assert.match(c, /eftNotice\.hidden = method !== 'eft'/);
});

test('EFT needs the customer to confirm, at checkout and on the server, and the Terms spell out the rules (22 Nov)', () => {
  const c = read('public/checkout.html');
  assert.match(c, /id="eftAck"/);
  assert.match(c, /!document\.getElementById\('eftAck'\)\.checked/);
  assert.match(c, /eftAck: selectedPayment === 'eft'/);
  assert.match(c, /A proof of payment \(POP\) is not accepted/);
  const server = read('server.js');
  assert.match(server, /paymentMethod === "eft" && \(req\.body \|\| \{\}\)\.eftAck !== true/);
  const terms = read('public/terms.html');
  for (const must of ['7.4C', '7.4D', '11.6', 'no refund will be made', 'not</b> proof of payment', 'reflecting in our bank account', 'we are not liable for the delay']) assert.ok(terms.includes(must), must);
  for (const f of ['public/eft-box.js', 'public/order-confirmation.html', 'emails.js']) assert.match(read(f), /POP/, f);
});

test('Terms: no returns, breakage after handover, no-delivery areas; driver rules page carries the liability (22 Nov)', () => {
  const terms = read('public/terms.html');
  for (const must of ['13.6', '13.7', '8.11', 'We do not accept returns, exchanges or refunds', 'not liable for breakage, spillage, loss, theft', 'Areas we do not deliver to', 'we do not accept returns, and we are not liable for breakage after handover']) assert.ok(terms.includes(must), must);
  const d = read('public/driver-terms.html');
  for (const must of ['fully liable', 'nearest police station', 'accident', 'robbery', 'vigilant', 'no-delivery areas']) assert.match(d, new RegExp(must), must);
  assert.match(d, /noindex/);
  assert.match(read('public/driver.html'), /driver-terms\.html/);
});

test('Driver rules: breakage paid like a restaurant, fair steps, 25% cap, signed written agreement (23 Nov)', () => {
  const d = read('public/driver-terms.html');
  for (const must of ['like breakage at a restaurant', 'actual|real loss|What it costs us|real loss', '48 hours', '25%', 'in writing, in advance', 'Driver agreement', 'Witness', 'Version 1.1']) assert.match(d, new RegExp(must), must);
  assert.match(d, /never more than/i);
});
