// Portal rehearsal (23 Nov 2026): admin Taverns tab + driver app + tavern
// portal + customer, one order from start to finish, against a LOCAL stack
// (same setup as scenarios.js; never the live database).
//   Use a FRESH database (each run adds a test tavern at the same spot):
//   STAGING_DATABASE_URL=... node staging/portals.js
const { execSync } = require('child_process');

const B = 'http://localhost:3000';
const sql = (q) => execSync(`psql "${process.env.STAGING_DATABASE_URL}" -At -c ${JSON.stringify(q)}`).toString().trim();
let ip = 1;
const fwd = () => `10.77.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`;
const ADMIN = () => ({ 'Content-Type': 'application/json', 'x-admin-token': process.env.STAGING_ADMIN_TOKEN || 'ekoyini-staging-admin-token-0123456789abcdef', 'X-Forwarded-For': fwd() });
const CUSTOMER = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-portalcustomer', 'X-Forwarded-For': fwd() });
const BEARER = (t) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, 'X-Forwarded-For': fwd() });
async function call(method, path, headers, body) {
  const res = await fetch(B + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

let pass = 0; let fail = 0;
const check = (ok, what) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };

(async () => {
  const stamp = Date.now() % 100000;
  // ── Admin: Taverns tab ──
  const add = await call('POST', '/admin/taverns', ADMIN(), { name: `Portal Test Tavern ${stamp}`, area: 'Zwide', phone: '', location: '-33.8672, 25.5662' });
  check(add.status === 201, `admin adds a tavern (${add.status})`);
  const tavernId = add.json && add.json.id;
  const noPhone = await call('POST', `/admin/tavern-access/${tavernId}`, ADMIN(), { action: 'enable' });
  check(noPhone.status === 400, 'portal cannot be switched on without a WhatsApp number');
  const badPhone = await call('PATCH', `/admin/taverns/${tavernId}/phone`, ADMIN(), { phone: '12345' });
  check(badPhone.status === 400, 'a wrong number is refused');
  const tPhone = `0721${String(stamp).padStart(6, '0')}`;
  const setPhone = await call('PATCH', `/admin/taverns/${tavernId}/phone`, ADMIN(), { phone: tPhone });
  check(setPhone.status === 200 && /^27\d{9}$/.test(setPhone.json.phone), `number saved as 27... (${setPhone.json && setPhone.json.phone})`);
  const loc = await call('PATCH', `/admin/taverns/${tavernId}/location`, ADMIN(), { latitude: '-33.8672', longitude: '25.5662' });
  check(loc.status === 200, 'location saved');
  const det = await call('PATCH', `/admin/taverns/${tavernId}/details`, ADMIN(), { legalName: 'Portal Test (Pty) Ltd', vatNumber: '', liquorLicenceNumber: 'EC-123', address: '1 Test St, Zwide' });
  check(det.status === 200, `receipt details saved (${det.status} ${det.json && det.json.error || ''})`);
  const on = await call('POST', `/admin/tavern-access/${tavernId}`, ADMIN(), { action: 'enable' });
  check(on.status === 200 && /^\d{4,6}$/.test(on.json.pin), 'portal switched on, PIN issued once');
  const list = await call('GET', '/admin/tavern-access', ADMIN());
  const mine = (list.json || []).find((t) => t.id === tavernId);
  check(mine && mine.access && mine.access.active && mine.signInOk, 'Taverns tab lists it as on');
  const settings = await call('GET', '/admin/delivery-settings', ADMIN());
  check((settings.json.taverns || []).some((t) => t.id === tavernId && t.phone), 'Taverns tab gets the number from the server');

  // ── Tavern signs in ──
  const tWrong = await call('POST', '/api/tavern/login', BEARER('x'), { phone: tPhone, pin: '0000' });
  check(tWrong.status === 401, 'tavern: wrong PIN refused');
  const tLogin = await call('POST', '/api/tavern/login', BEARER('x'), { phone: tPhone, pin: on.json.pin });
  check(tLogin.status === 200 && tLogin.json.token, 'tavern signs in with number + PIN');
  const tTok = tLogin.json && tLogin.json.token;

  // ── Admin adds a driver, driver signs in ──
  const dPhone = `0731${String(stamp).padStart(6, '0')}`;
  const drv = await call('POST', '/admin/drivers', ADMIN(), { name: 'Portal Driver', phone: dPhone, vehicle: 'White Polo' });
  check(drv.status === 200 || drv.status === 201, `admin adds a driver (${drv.status} ${drv.json && drv.json.error || ''})`);
  const dLogin = await call('POST', '/api/driver/login', BEARER('x'), { phone: dPhone, pin: drv.json && drv.json.pin });
  check(dLogin.status === 200 && dLogin.json.token, 'driver signs in with number + PIN');
  const dTok = dLogin.json && dLogin.json.token;

  // ── Customer orders (EFT), admin confirms payment ──
  const products = (await call('GET', '/api/products', CUSTOMER())).json;
  const beer = products.find((p) => p.category === 'BEER' && p.packSize === 6 && p.stock > 10);
  const order = await call('POST', '/order', CUSTOMER(), { address: '5 Test St, Zwide', customerName: 'Portal Customer', customerPhone: '072 555 0101', priorityFee: 0, eftAck: true, deliveryLat: -33.8670, deliveryLng: 25.5660, items: [{ skuId: beer.id, quantity: 3 }], paymentMethod: 'eft' });
  check(order.status === 200, `customer places an EFT order (${order.status} ${order.json && order.json.error || ''})`);
  const code = order.json.order.code;
  const paid = await call('PATCH', `/order/${code}/confirm-payment`, ADMIN());
  check(paid.status === 200, 'admin confirms the EFT payment');

  // ── Driver takes the job from the board ──
  const home = await call('GET', '/api/driver/home', BEARER(dTok));
  const orderId = sql(`select id from "Order" where code='${code}'`);
  const job = (home.json.board || []).find((j) => j.id === orderId);
  check(!!job, 'paid order appears on the driver job board');
  check(job && !('code' in job) && !('address' in job) && !('customerPhone' in job), 'the board hides the order code, address and customer until a driver takes it');
  const take = await call('POST', `/api/driver/jobs/${job && job.id}/take`, BEARER(dTok));
  check(take.status === 200, `driver takes the job (${take.status} ${take.json && take.json.error || ''})`);
  const again = await call('POST', `/api/driver/jobs/${job && job.id}/take`, BEARER(dTok));
  check(again.status === 409, 'the same job cannot be taken twice');
  const row = sql(`select "tavernId", "collectionPin", "driverShareToken" from "Order" where code='${code}'`).split('|');
  check(row[0] === tavernId, 'job went to the nearest tavern (our test tavern)');

  // ── Tavern packs it ──
  const tHome = await call('GET', '/api/tavern/home', BEARER(tTok));
  const pack = (tHome.json.toPack || []).find((o) => o.code === code);
  check(pack && String(pack.collectionPin) === row[1], 'tavern sees the order to pack with the collection PIN');
  check(pack && !('customerPhone' in pack) && !('address' in pack), 'tavern never sees the customer phone or address');
  const ready = await call('POST', `/api/tavern/orders/${code}/ready`, BEARER(tTok), { ready: true });
  check(ready.status === 200, 'tavern marks it ready');
  const stock = await call('POST', '/api/tavern/stock', BEARER(tTok), { skuId: beer.id, soldOut: true });
  check(stock.status === 200 && stock.json.soldOut, 'tavern can mark an item sold out');
  await call('POST', '/api/tavern/stock', BEARER(tTok), { skuId: beer.id, soldOut: false });

  // ── Driver collects (tavern PIN + location) and delivers (customer PIN) ──
  const badPick = await call('POST', `/order/${code}/confirm-pickup`, BEARER('x'), { token: row[2], pin: '0000', lat: -33.8672, lng: 25.5662 });
  check(badPick.status >= 400, 'pickup refused with the wrong tavern PIN');
  const pick = await call('POST', `/order/${code}/confirm-pickup`, BEARER('x'), { token: row[2], pin: row[1], lat: -33.8672, lng: 25.5662 });
  check(pick.status === 200, `pickup confirmed with the tavern PIN + location (${pick.status} ${pick.json && pick.json.error || ''})`);
  const track = await call('GET', `/api/order/${code}/track`, BEARER('x'));
  check(track.json.status === 'DISPATCHED' && track.json.driverName === 'Portal Driver', 'customer tracking shows the driver on the way');
  const dPin = await call('GET', `/api/order/${code}/delivery-pin`, CUSTOMER());
  check(dPin.status === 200 && /^\d{4}$/.test(dPin.json.pin), 'customer sees their delivery PIN');
  const badDrop = await call('POST', `/order/${code}/confirm-delivered`, BEARER('x'), { token: row[2], pin: '0000' });
  check(badDrop.status >= 400, 'delivery refused with the wrong customer PIN');
  const drop = await call('POST', `/order/${code}/confirm-delivered`, BEARER('x'), { token: row[2], pin: dPin.json.pin });
  check(drop.status === 200, `delivered with the customer PIN (${drop.status} ${drop.json && drop.json.error || ''})`);

  // ── Afterwards: receipts and money on every side ──
  const rcpt = await call('GET', `/api/driver/receipt/${code}`, BEARER(dTok));
  check(rcpt.status === 200 && rcpt.json.receipt, 'driver gets a receipt');
  const custRcpt = await call('GET', `/api/order/${code}/receipt`, CUSTOMER());
  check(custRcpt.status === 200, 'customer gets a receipt');
  const otherRcpt = await call('GET', `/api/order/${code}/receipt`, BEARER('tok-someoneelse'));
  check(otherRcpt.status === 404 || otherRcpt.status === 403, 'another customer cannot open this receipt');
  const money = await call('GET', '/api/tavern/money', BEARER(tTok));
  check(money.status === 200, 'tavern sees its money');
  const dHome2 = await call('GET', '/api/driver/home', BEARER(dTok));
  check(dHome2.json.earnings && JSON.stringify(dHome2.json.earnings).length > 2, 'driver earnings update');
  const today = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  const payouts = await call('GET', `/admin/payouts?from=${today}&to=${today}`, ADMIN());
  check(payouts.status === 200 && payouts.json.taverns.some((t) => t.orders.some((o) => o.code === code)) && payouts.json.drivers.some((d) => d.orders.some((o) => o.code === code)), 'admin Payouts lists the tavern and the driver for this order');

  // ── Security on the portals ──
  check((await call('GET', '/api/tavern/home', BEARER(dTok))).status === 401, 'a driver session cannot open the tavern portal');
  check((await call('GET', '/api/driver/home', BEARER(tTok))).status === 401, 'a tavern session cannot open the driver app');
  const custEdit = await call('PATCH', `/admin/taverns/${tavernId}/phone`, CUSTOMER(), { phone: '0721111111' });
  check(custEdit.status === 401 || custEdit.status === 403, `customers cannot change tavern numbers (${custEdit.status})`);
  const newNum = await call('PATCH', `/admin/taverns/${tavernId}/phone`, ADMIN(), { phone: `0741${String(stamp).padStart(6, '0')}` });
  check(newNum.status === 200 && (await call('GET', '/api/tavern/home', BEARER(tTok))).status === 401, 'changing the tavern number signs the tavern out');

  console.log(`\n${pass}/${pass + fail} portal checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
