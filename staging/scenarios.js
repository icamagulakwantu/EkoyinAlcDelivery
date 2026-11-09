// Staged market-readiness scenarios against a local Ekoyini stack.
// Each scenario runs real HTTP calls; DB setup uses psql. Results → JSON.
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const P = require('../public/pricing.js');

const B = 'http://localhost:3000';
const YOCO = 'http://localhost:4010';
const sql = (q) => execSync(`psql "${process.env.STAGING_DATABASE_URL}" -At -c ${JSON.stringify(q)}`).toString().trim();
let ipN = 1;
const freshIp = () => `10.9.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;
const H = (tok = 'test-token', extra = {}) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-Forwarded-For': freshIp(), ...extra });
const ADMIN = { 'Content-Type': 'application/json', 'x-admin-token': 'admintok', 'X-Forwarded-For': '10.200.0.1' };
async function call(method, path, { headers = H(), body } = {}) {
  const res = await fetch(B + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), redirect: 'manual' });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

const results = [];
let current = null;
async function scenario(stage, id, title, fn) {
  current = { stage, id, title, checks: [], notes: [] };
  try { await fn(); } catch (e) { current.checks.push({ ok: false, what: 'scenario crashed: ' + e.message }); }
  current.pass = current.checks.every((c) => c.ok);
  results.push(current);
  console.log(`${current.pass ? 'PASS' : 'FAIL'}  ${id}  ${title}`);
  for (const c of current.checks.filter((x) => !x.ok)) console.log('      ✗', c.what);
}
const check = (ok, what) => current.checks.push({ ok: !!ok, what });
const note = (n) => current.notes.push(n);

const base = { address: '12 Vilakazi St, Orlando West', customerName: 'Thandeka', customerPhone: '072 123 4567', priorityFee: 0 };

(async () => {
  const products = (await call('GET', '/api/products')).json;
  const by = (cat, pred = () => true) => products.find((p) => p.category === cat && p.stock > 0 && pred(p));
  const beer6 = by('BEER', (p) => p.packSize === 6);
  const gin = by('GIN', (p) => p.retailSingleZAR > 300);
  const whisky = by('WHISKY', (p) => p.retailSingleZAR > 400);
  const linesFor = (items) => items.map((i) => { const p = products.find((x) => x.id === i.skuId); return { category: p.category, total: p.retailSingleZAR * i.quantity }; });
  const expectTotal = async (items, { safetySeal = false, promoPct = 0, priorityFee = 0 } = {}) => {
    const lines = linesFor(items);
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const q = (await call('POST', '/api/delivery-quote', { body: { subtotal, priorityFee } })).json.quote;
    return P.priceOrder({ lines, deliveryTotal: q.total, safetySeal, promoPct }).total;
  };

  // ───────── STAGE 1: catalogue & content ─────────
  await scenario('1 Catalogue', '1.1', 'Every product is priced, in stock data, and no cost data leaks', async () => {
    check(products.length === 326, `326 products (got ${products.length})`);
    check(products.every((p) => p.retailSingleZAR > 0), 'every product has a price > 0');
    const leaked = ['listPriceZAR', 'supplierCaseZAR', 'supplierPortfolio', 'palletPackQty'].filter((k) => products.some((p) => k in p));
    check(leaked.length === 0, `no supplier/cost fields in the public API (${leaked.join(',') || 'none'})`);
    const quarts = products.filter((p) => /^Quart/.test(p.bottleFormat));
    check(quarts.every((p) => p.retailSingleZAR < 35), `all quarts under R35 (max R${Math.max(...quarts.map((q) => q.retailSingleZAR))})`);
    const caseOk = products.every((p) => p.unitsPerCase <= 1 || p.retailCaseZAR < p.retailSingleZAR * p.unitsPerCase + 0.01);
    check(caseOk, 'a case never costs more than the same number of singles');
  });

  await scenario('1 Catalogue', '1.2', 'Every product photo actually loads', async () => {
    const withImg = products.filter((p) => p.imageUrl);
    let broken = [];
    for (const p of withImg) {
      const url = p.imageUrl.startsWith('http') ? p.imageUrl : B + '/' + p.imageUrl.replace(/^\//, '');
      const r = await fetch(encodeURI(decodeURI(url)), { method: 'HEAD' }).catch(() => ({ status: 0 }));
      if (r.status !== 200) broken.push(`${p.name} ${p.bottleFormat} (${r.status})`);
    }
    check(withImg.length >= 320, `products with a photo: ${withImg.length}/326`);
    const external = withImg.filter((p) => /^https?:/.test(p.imageUrl));
    note(`photos from an outside site (generic stock photo, not the product): ${external.map((p) => p.name + ' ' + p.bottleFormat).join('; ') || 'none'}`);
    broken = broken.filter((b) => !external.some((p) => b.startsWith(p.name + ' ' + p.bottleFormat)));
    check(broken.length === 0, `broken photos: ${broken.length} ${broken.slice(0, 5).join('; ')}`);
    note(`${326 - withImg.length} products have no photo`);
  });

  await scenario('1 Catalogue', '1.3', 'Public store list never exposes tavern phone numbers', async () => {
    const t = (await call('GET', '/api/taverns')).json;
    check(Array.isArray(t) && t.length > 0, `taverns listed (${t.length})`);
    check(t.every((x) => !('phone' in x) && !('latitude' in x)), 'no phone or exact location in public list');
  });

  // ───────── STAGE 2: pricing integrity ─────────
  await scenario('2 Pricing', '2.1', 'Server total equals the total the customer was shown (EFT, beer + spirit + seal)', async () => {
    const items = [{ skuId: beer6.id, quantity: 2, purchaseType: 'single' }, { skuId: gin.id, quantity: 1, purchaseType: 'single' }];
    const expected = await expectTotal(items, { safetySeal: true });
    const r = await call('POST', '/order', { body: { ...base, items, paymentMethod: 'eft', safetySeal: true } });
    check(r.status === 200, `order accepted (${r.status} ${r.json?.error || ''})`);
    check(r.json?.order?.total === expected, `server R${r.json?.order?.total} = shown R${expected}`);
    check(r.json?.order?.safetySealFee === 10, 'R10 seal charged for a spirit');
    check(r.json?.order?.status === 'PAYMENT_PENDING', 'EFT waits for payment confirmation');
  });

  await scenario('2 Pricing', '2.2', 'Cooler Box discount over R2000 (time-dependent: 04:00–20:00 SA)', async () => {
    const items = [{ skuId: whisky.id, quantity: 3, purchaseType: 'single' }, { skuId: beer6.id, quantity: 4, purchaseType: 'single' }];
    const expected = await expectTotal(items);
    const r = await call('POST', '/order', { body: { ...base, items, paymentMethod: 'eft' } });
    check(r.json?.order?.total === expected, `server R${r.json?.order?.total} = shown R${expected}`);
    note(P.coolerDiscountAvailable(new Date()) ? 'Ran inside the discount window' : 'Ran after 20:00 SA: no discount expected (window rule unit-tested)');
  });

  await scenario('2 Pricing', '2.3', 'Tampered requests cannot change what is charged', async () => {
    const tries = [
      ['price field ignored', { items: [{ skuId: beer6.id, quantity: 4, purchaseType: 'single', price: 1 }], total: 1 }, 200],
      ['negative quantity', { items: [{ skuId: beer6.id, quantity: -5 }] }, 400],
      ['zero quantity', { items: [{ skuId: beer6.id, quantity: 0 }] }, 400],
      ['unknown product', { items: [{ skuId: 'nope', quantity: 1 }] }, 400],
      ['made-up priority fee', { items: [{ skuId: beer6.id, quantity: 4 }], priorityFee: 999 }, 400],
      ['empty cart', { items: [] }, 400],
      ['bad phone', { items: [{ skuId: beer6.id, quantity: 4 }], customerPhone: '123' }, 400],
      ['address too short', { items: [{ skuId: beer6.id, quantity: 4 }], address: 'x' }, 400],
      ['control characters in name', { items: [{ skuId: beer6.id, quantity: 4 }], customerName: 'A\u0000B' }, 400],
      ['unknown payment method', { items: [{ skuId: beer6.id, quantity: 4 }], paymentMethod: 'free' }, 400],
    ];
    for (const [label, over, want] of tries) {
      const r = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', ...over } });
      check(r.status === want, `${label}: HTTP ${r.status} (want ${want})${r.json?.error ? ' — ' + r.json.error : ''}`);
      if (label === 'price field ignored') check(r.json?.order?.total > 300, `charged real price R${r.json?.order?.total}, not R1`);
    }
    const frac = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', items: [{ skuId: beer6.id, quantity: '2.7' }] } });
    note(`quantity "2.7" → HTTP ${frac.status}, quantity saved ${frac.json?.order?.items?.[0]?.quantity}`);
  });

  await scenario('2 Pricing', '2.4', 'R300 minimum order is enforced by the server', async () => {
    const cheap = by('BEER', (p) => /^Quart/.test(p.bottleFormat));
    const r = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', items: [{ skuId: cheap.id, quantity: 1 }] } });
    check(r.status === 400 && /R300/.test(r.json?.error), `below-minimum refused: ${r.json?.error}`);
  });

  await scenario('2 Pricing', '2.5', 'Safety Seal is never charged without a spirit', async () => {
    const r = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', safetySeal: true, items: [{ skuId: beer6.id, quantity: 4 }] } });
    check(r.status === 200 && !r.json.order.safetySealFee, `beer-only order seal fee: ${r.json?.order?.safetySealFee ?? 0}`);
  });

  await scenario('2 Pricing', '2.6', 'Promo codes: valid, exhausted, below minimum, expired', async () => {
    sql(`delete from "PromoCode" where code like 'TEST%'`);
    sql(`insert into "PromoCode"(id,code,"discountPct","maxUses","usedCount",active) values ('p1','TEST10',10,1,0,true)`);
    sql(`insert into "PromoCode"(id,code,"discountPct","minSubtotal",active) values ('p2','TESTMIN',10,5000,true)`);
    sql(`insert into "PromoCode"(id,code,"discountPct",active,"expiresAt") values ('p3','TESTOLD',10,true,'2020-01-01')`);
    const items = [{ skuId: beer6.id, quantity: 4, purchaseType: 'single' }];
    const expected = await expectTotal(items, { promoPct: 10 });
    const ok = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', items, promoCode: 'TEST10' } });
    check(ok.json?.order?.total === expected, `10% promo: server R${ok.json?.order?.total} = shown R${expected}`);
    const again = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', items, promoCode: 'TEST10' } });
    check(again.status === 400, `single-use code refused second time: ${again.json?.error}`);
    const min = await call('POST', '/api/promo/validate', { body: { code: 'TESTMIN', subtotal: 500 } });
    check(min.json?.valid === false, `minimum-spend code refused: ${min.json?.error}`);
    const old = await call('POST', '/api/promo/validate', { body: { code: 'TESTOLD', subtotal: 500 } });
    check(old.json?.valid === false, `expired code refused: ${old.json?.error}`);
  });

  // ───────── STAGE 3: payments ─────────
  await scenario('3 Payments', '3.1', 'Card: pay at Yoco, no webhook, order created by the status check', async () => {
    const items = [{ skuId: beer6.id, quantity: 3, purchaseType: 'single' }];
    const expected = await expectTotal(items);
    const s = await call('POST', '/order/checkout-session', { body: { ...base, items } });
    check(s.status === 200 && s.json.redirectUrl, `checkout session started (${s.status})`);
    const ch = s.json.redirectUrl.split('/pay/')[1];
    const yc = await (await fetch(`${YOCO}/api/checkouts/${ch}`)).json();
    check(yc.amount === Math.round(expected * 100), `Yoco asked for R${yc.amount / 100} = shown R${expected}`);
    const pid = yc.successUrl.split('pending=')[1];
    const before = await call('GET', `/api/checkout-session/${pid}/status`);
    check(before.json.status === 'PENDING', 'unpaid stays PENDING');
    await fetch(`${YOCO}/pay/${ch}`, { redirect: 'manual' });
    await new Promise((r) => setTimeout(r, 5200));
    const after = await call('GET', `/api/checkout-session/${pid}/status`);
    check(after.json.status === 'COMPLETED' && /^EKO-/.test(after.json.orderCode), `paid → ${after.json.status} ${after.json.orderCode}`);
    const other = await call('GET', `/api/checkout-session/${pid}/status`, { headers: H('tok-intruder') });
    check(other.status === 404, `another customer cannot read this checkout (${other.status})`);
  });

  await scenario('3 Payments', '3.2', 'Card: Yoco charged the wrong amount → flagged for refund, no order', async () => {
    const s = await call('POST', '/order/checkout-session', { body: { ...base, items: [{ skuId: beer6.id, quantity: 3 }] } });
    const ch = s.json.redirectUrl.split('/pay/')[1];
    const pid = (await (await fetch(`${YOCO}/api/checkouts/${ch}`)).json()).successUrl.split('pending=')[1];
    await fetch(`${YOCO}/tamper/${ch}`);
    await new Promise((r) => setTimeout(r, 5200));
    const st = await call('GET', `/api/checkout-session/${pid}/status`);
    check(st.json.status === 'FAILED_NEEDS_REFUND', `status ${st.json.status}`);
    check(!st.json.orderCode, 'no order created');
  });

  await scenario('3 Payments', '3.3', 'Yoco webhook: forged signature rejected, signed one accepted once', async () => {
    const s = await call('POST', '/order/checkout-session', { body: { ...base, items: [{ skuId: beer6.id, quantity: 3 }] } });
    const ch = s.json.redirectUrl.split('/pay/')[1];
    const pid = (await (await fetch(`${YOCO}/api/checkouts/${ch}`)).json()).successUrl.split('pending=')[1];
    await fetch(`${YOCO}/pay/${ch}`, { redirect: 'manual' });
    const body = JSON.stringify({ type: 'payment.succeeded', payload: { id: 'p_1', metadata: { checkoutId: ch } } });
    const forged = await fetch(B + '/webhooks/yoco', { method: 'POST', headers: { 'Content-Type': 'application/json', 'webhook-id': 'm1', 'webhook-timestamp': '1', 'webhook-signature': 'v1,AAAA' }, body });
    check(forged.status === 401, `forged signature → ${forged.status}`);
    const sign = (id, ts) => 'v1,' + crypto.createHmac('sha256', Buffer.from('dGVzdHNlY3JldA==', 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
    const ts = String(Math.floor(Date.now() / 1000));
    const ok = await fetch(B + '/webhooks/yoco', { method: 'POST', headers: { 'Content-Type': 'application/json', 'webhook-id': 'm2', 'webhook-timestamp': ts, 'webhook-signature': sign('m2', ts) }, body });
    check(ok.status === 200, `signed webhook → ${ok.status}`);
    await new Promise((r) => setTimeout(r, 1500));
    await fetch(B + '/webhooks/yoco', { method: 'POST', headers: { 'Content-Type': 'application/json', 'webhook-id': 'm3', 'webhook-timestamp': ts, 'webhook-signature': sign('m3', ts) }, body });
    await new Promise((r) => setTimeout(r, 1500));
    const row = sql(`select status||'|'||coalesce("orderCode",'') from "PendingCheckout" where id='${pid}'`);
    const n = sql(`select count(*) from "Order" where code='${row.split('|')[1]}'`);
    check(row.startsWith('COMPLETED') && n === '1', `webhook delivered twice → one order (${row})`);
    const oldTs = '1600000000';
    const replay = await fetch(B + '/webhooks/yoco', { method: 'POST', headers: { 'Content-Type': 'application/json', 'webhook-id': 'm4', 'webhook-timestamp': oldTs, 'webhook-signature': sign('m4', oldTs) }, body });
    note(`a validly signed message with a 2020 timestamp got HTTP ${replay.status} (no replay window; harmless today because processing is idempotent)`);
  });

  await scenario('3 Payments', '3.4', 'Cash on delivery: new account refused, trusted account allowed, cap R1500', async () => {
    const items = [{ skuId: beer6.id, quantity: 4 }];
    const fresh = await call('POST', '/order', { headers: H('tok-newbie'), body: { ...base, items, paymentMethod: 'cod' } });
    check(fresh.status === 400 && /delivered order/.test(fresh.json?.error), `new account: ${fresh.json?.error}`);
    for (const c of ['TRUSTA1', 'TRUSTA2']) sql(`insert into "Order"(id,code,"userId",address,total,status,"updatedAt") values ('${c}','${c}','user-trusted','x',400,'DELIVERED',now()) on conflict do nothing`);
    const trusted = await call('POST', '/order', { headers: H('tok-trusted-old'), body: { ...base, items, paymentMethod: 'cod' } });
    check(trusted.status === 200 && trusted.json.order.status === 'PENDING', `trusted account COD → ${trusted.status} ${trusted.json?.order?.status}`);
    const big = await call('POST', '/order', { headers: H('tok-trusted-old'), body: { ...base, items: [{ skuId: whisky.id, quantity: 4 }], paymentMethod: 'cod' } });
    check(big.status === 400 && /R1500/.test(big.json?.error), `over R1500: ${big.json?.error}`);
  });

  // ───────── STAGE 4: stock ─────────
  await scenario('4 Stock', '4.1', 'Last item: two customers at once → exactly one gets it', async () => {
    sql(`update "SkuItem" set stock=1 where id='${gin.id}'`);
    const items = [{ skuId: gin.id, quantity: 1 }];
    const [a, b] = await Promise.all([
      call('POST', '/order', { headers: H('tok-racea'), body: { ...base, items, paymentMethod: 'eft' } }),
      call('POST', '/order', { headers: H('tok-raceb'), body: { ...base, items, paymentMethod: 'eft' } }),
    ]);
    const wins = [a, b].filter((r) => r.status === 200).length;
    check(wins === 1, `orders accepted: ${wins} (other said: ${[a, b].find((r) => r.status !== 200)?.json?.error})`);
    check(sql(`select stock from "SkuItem" where id='${gin.id}'`) === '0', 'stock is 0, never negative');
    const winner = [a, b].find((r) => r.status === 200);
    const tok = winner === a ? 'tok-racea' : 'tok-raceb';
    const c = await call('POST', `/order/${winner.json.order.code}/cancel`, { headers: H(tok) });
    check(c.status === 200, `customer cancels (${c.status})`);
    check(sql(`select stock from "SkuItem" where id='${gin.id}'`) === '1', 'cancelling puts the stock back');
    sql(`update "SkuItem" set stock=999 where id='${gin.id}'`);
  });

  await scenario('4 Stock', '4.2', 'Out-of-stock product cannot be ordered', async () => {
    sql(`update "SkuItem" set stock=0 where id='${whisky.id}'`);
    const r = await call('POST', '/order', { body: { ...base, paymentMethod: 'eft', items: [{ skuId: whisky.id, quantity: 1 }] } });
    check(r.status === 400 && /sold out/.test(r.json?.error), `refused: ${r.json?.error}`);
    sql(`update "SkuItem" set stock=999 where id='${whisky.id}'`);
  });

  // ───────── STAGE 5: order lifecycle (admin → driver → customer) ─────────
  await scenario('5 Lifecycle', '5.1', 'EFT order → admin confirms payment → assign → driver pickup → live location → delivered → rating', async () => {
    const o = (await call('POST', '/order', { headers: H('tok-life'), body: { ...base, paymentMethod: 'eft', items: [{ skuId: beer6.id, quantity: 4 }] } })).json.order;
    const noAuth = await call('PATCH', `/order/${o.code}/confirm-payment`, { headers: { 'Content-Type': 'application/json' } });
    check(noAuth.status === 401, `confirm-payment without admin login → ${noAuth.status}`);
    const cp = await call('PATCH', `/order/${o.code}/confirm-payment`, { headers: ADMIN });
    check(cp.status === 200, `admin confirms EFT (${cp.status} ${cp.json?.error || ''})`);
    const tavern = sql(`select id from "Tavern" limit 1`);
    const as = await call('PATCH', `/order/${o.code}/assign`, { headers: ADMIN, body: { tavernId: tavern, driverName: 'Sipho', driverPhone: '0821234567', driverVehicle: 'White Polo' } });
    check(as.status === 200 && as.json.driverShareToken, 'admin assigns tavern + driver, driver link created');
    const tok = as.json.driverShareToken;
    const bad = await call('POST', `/order/${o.code}/confirm-pickup`, { body: { token: 'wrong' } });
    check(bad.status === 403, `wrong driver link refused (${bad.status})`);
    const pu = await call('POST', `/order/${o.code}/confirm-pickup`, { body: { token: tok } });
    check(pu.status === 200, `driver confirms pickup (${pu.status})`);
    const cancel = await call('POST', `/order/${o.code}/cancel`, { headers: H('tok-life') });
    check(cancel.status === 400, `customer can't cancel once out for delivery (${cancel.json?.error})`);
    const loc = await call('POST', `/order/${o.code}/location`, { body: { token: tok, lat: -33.96, lng: 25.6 } });
    check(loc.status === 200, `driver location posted (${loc.status})`);
    const tr = await call('GET', `/api/order/${o.code}/track`);
    check(tr.json.status === 'DISPATCHED' && tr.json.driverLat && tr.json.driverName === 'Sipho', 'customer sees driver + live location');
    check(!('driverPhone' in tr.json) && !('address' in tr.json) && !('customerPhone' in tr.json), 'public tracking hides phone numbers and address');
    const earlyRate = await call('POST', `/order/${o.code}/rate`, { headers: H('tok-life'), body: { rating: 5 } });
    check(earlyRate.status === 400, 'cannot rate before delivery');
    const dl = await call('POST', `/order/${o.code}/confirm-delivered`, { body: { token: tok } });
    check(dl.status === 200, `driver confirms delivery (${dl.status})`);
    const locAfter = await call('POST', `/order/${o.code}/location`, { body: { token: tok, lat: -33.9, lng: 25.6 } });
    check(locAfter.status === 400 || locAfter.status === 403, `driver link stops sharing location after delivery (${locAfter.status})`);
    const intruder = await call('POST', `/order/${o.code}/rate`, { headers: H('tok-other'), body: { rating: 1 } });
    check(intruder.status === 403, 'another customer cannot rate this order');
    const rate = await call('POST', `/order/${o.code}/rate`, { headers: H('tok-life'), body: { rating: 5, comment: 'Fast!' } });
    check(rate.status === 200, 'customer rates 5 stars');
    const twice = await call('POST', `/order/${o.code}/rate`, { headers: H('tok-life'), body: { rating: 1 } });
    check(twice.status === 400, 'cannot rate twice');
    const reassign = await call('PATCH', `/order/${o.code}/assign`, { headers: ADMIN, body: { tavernId: tavern, driverName: 'X' } });
    check(reassign.status === 400, 'a delivered order cannot be re-assigned (no fresh driver link)');
  });

  await scenario('5 Lifecycle', '5.2', 'Customer sees only their own orders; unknown order codes give 404', async () => {
    const mine = (await call('GET', '/api/my-orders', { headers: H('tok-life') })).json;
    check(Array.isArray(mine) && mine.length >= 1 && mine.every((o) => o.userId === 'user-life'), `my orders: ${mine.length}, all mine`);
    const anon = await call('GET', '/api/my-orders', { headers: { 'X-Forwarded-For': freshIp() } });
    check(anon.status === 401, 'not logged in → 401');
    const nf = await call('GET', '/api/order/EKO-NOTREAL1/track');
    check(nf.status === 404, 'unknown code → 404');
  });

  // ───────── STAGE 6: security ─────────
  await scenario('6 Security', '6.1', 'Admin endpoints refuse customers and anonymous callers', async () => {
    for (const [m, p] of [['GET', '/orders'], ['GET', '/admin/products'], ['GET', '/admin/admins'], ['GET', '/admin/audit-log'], ['DELETE', '/order/EKO-X']]) {
      const anon = await call(m, p, { headers: { 'X-Forwarded-For': freshIp() } });
      const cust = await call(m, p, { headers: H('tok-cust') });
      check(anon.status === 401 && cust.status === 401, `${m} ${p}: anonymous ${anon.status}, customer ${cust.status}`);
    }
  });

  await scenario('6 Security', '6.2', 'Script in a customer name is stored as text, not run', async () => {
    const xss = '<img src=x onerror=alert(1)>';
    const r = await call('POST', '/order', { body: { ...base, customerName: xss, paymentMethod: 'eft', items: [{ skuId: beer6.id, quantity: 4 }] } });
    check(r.status === 200, 'order with odd characters accepted as text');
    const adminJs = fs.readFileSync(require('path').join(__dirname, '../admin/admin-api.js'), 'utf8');
    check(/esc\(order\.customerName/.test(adminJs), 'admin dashboard escapes customer name before display');
  });

  await scenario('6 Security', '6.3', 'Rate limits cannot be dodged by faking the client IP', async () => {
    let last = 0; let blocked = false;
    for (let i = 0; i < 18; i++) {
      const r = await fetch(B + '/api/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7' }, body: JSON.stringify({ code: 'GUESS' + i, subtotal: 500 }) });
      last = r.status; if (r.status === 429) blocked = true;
    }
    check(blocked, `same IP guessing promo codes is blocked (last HTTP ${last})`);
    let spoofBlocked = false;
    for (let i = 0; i < 18; i++) {
      const r = await fetch(B + '/api/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${i}` }, body: JSON.stringify({ code: 'GUESS' + i, subtotal: 500 }) });
      if (r.status === 429) spoofBlocked = true;
    }
    check(spoofBlocked, 'changing the X-Forwarded-For header must not reset the limit');
  });

  await scenario('6 Security', '6.4', 'Security headers on pages', async () => {
    const r = await fetch(B + '/index.html');
    const h = (k) => r.headers.get(k);
    check(!h('x-powered-by'), 'framework not advertised');
    check(!!h('x-content-type-options'), `X-Content-Type-Options: ${h('x-content-type-options')}`);
    check(!!h('x-frame-options') || /frame-ancestors/.test(h('content-security-policy') || ''), `clickjacking protection: ${h('x-frame-options')}`);
    check(!!h('strict-transport-security'), `HSTS: ${h('strict-transport-security')}`);
    check(!!h('referrer-policy'), `Referrer-Policy: ${h('referrer-policy')}`);
  });

  await scenario('6 Security', '6.5', 'No secret keys committed to the repository', async () => {
    const out = execSync(`cd ${JSON.stringify(require('path').join(__dirname, '..'))} && git grep -nE "sk_live_[A-Za-z0-9]{8}|sk_test_[A-Za-z0-9]{8}|whsec_[A-Za-z0-9+/=]{12}|service_role|re_[A-Za-z0-9]{20}" -- . ':!node_modules' ':!staging' || true`).toString().trim();
    check(out === '', `secret-looking strings: ${out ? out.split('\n').length : 0}`);
    note('The Supabase anon key in public/auth.js is public by design (protected by Supabase row-level security).');
  });

  // ───────── STAGE 7: resilience ─────────
  await scenario('7 Resilience', '7.1', 'Bad input gives clean JSON errors, not crashes', async () => {
    const bj = await call('POST', '/order', { body: '{oops' });
    check(bj.status === 400 && bj.json?.error, `malformed JSON → ${bj.status} ${bj.json?.error}`);
    const big = await call('POST', '/order', { body: { ...base, items: Array.from({ length: 150 }, () => ({ skuId: beer6.id, quantity: 1 })) } });
    check(big.status === 400, `150 cart lines refused (${big.json?.error})`);
    const health = await call('GET', '/api/health');
    check(health.json?.ok === true, 'server still healthy');
  });

  await scenario('7 Resilience', '7.2', 'Unknown page gives a helpful 404', async () => {
    const r = await fetch(B + '/does-not-exist');
    const t = await r.text();
    check(r.status === 404, `HTTP ${r.status}`);
    check(!/Cannot GET/.test(t), `friendly page (got: ${t.slice(0, 40).replace(/\n/g, ' ')})`);
  });

  fs.writeFileSync(require('path').join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n${pass}/${results.length} scenarios passed`);
})();
