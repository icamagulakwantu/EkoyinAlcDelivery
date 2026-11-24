// Onboarding pack (founder request, 24 Nov 2026): everything needed to bring
// taverns, drivers and dispatchers on board, with the contracts.
//   node onboarding-pack/build.js   (uses the preinstalled Playwright Chromium)
// Builds 7 PDFs (+ the HTML they come from) in this folder.
//
// Every number comes from the app's own rules (public/pricing.js,
// lib/dispatch.js, lib/driver-app.js, server.js), so the documents match what
// the app really does. Contact person: Thanduxolo Makeleni, Township
// Onboarding Liaison Officer (never "founder" or "owner"). The contracts are
// drafts: an attorney / labour consultant should check them before signing.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'public/pricing.js'));
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/images/brand/ekoyini-logo.png')).toString('base64');
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/images/brand/ekoyini-icon.png')).toString('base64');

const C = { green: '#2e6e4b', green2: '#4f9a6f', green3: '#a9d3b8', orange: '#f7682c', ink: '#17140e', muted: '#5c5a55', line: '#e7e2d6', paper: '#fbf8f2' };
const R = (n, d = 0) => 'R' + Number(n).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const VERSION = 'Version 1.0 · 24 November 2026';

// ── Company and contact (must match Terms and receipts) ───────────────────
const CO = {
  trading: 'Ekoyini Holdings (Pty) Ltd',
  legal: 'K2020465422 (South Africa) (Pty) Ltd',
  reg: '2020/465422/07',
  address: '7 Torquay Street, Summerstrand, Gqeberha, 6001',
  whatsapp: '064 004 5465',
  email: 'support@ekoyini.co.za',
  web: 'www.ekoyini.co.za',
};
const LINKS = { admin: 'www.ekoyini.co.za/admin/admin.html', driver: 'www.ekoyini.co.za/driver.html', tavern: 'www.ekoyini.co.za/tavern.html', rules: 'www.ekoyini.co.za/driver-terms.html', terms: 'www.ekoyini.co.za/terms.html' };

// ── The app's real rules ───────────────────────────────────────────────────
const RULES = {
  deliveryBase: 40, baseKm: 3, perKm: 6, loadPerKg: 1.5, loadFreeKg: 20,
  peak: 20, late: 30, priority: [10, 20, 30, 40, 50],
  carePct: 5, careMin: 10, careMax: 75, seal: 10, minOrder: 300,
  crate: 52, looseBottle: 3, beerMarkup: 7, spiritMarkup: 5,
  maxJobs: 3, codOrders: 10, codMax: 1500,
  alert: { assign: 10, collect: 20, silent: 3, slow: 45 },
  nmw: 30.23,
};
// Cross-check against the app so the documents never drift from the code.
const want = {
  CARE_FEE_PCT: RULES.carePct / 100, CARE_FEE_MIN: RULES.careMin, CARE_FEE_MAX: RULES.careMax,
  BASE_DELIVERY_FEE: RULES.deliveryBase, BASE_DELIVERY_KM: RULES.baseKm, PER_KM_FEE: RULES.perKm,
  LOAD_FEE_PER_KG: RULES.loadPerKg, LOAD_FREE_KG: RULES.loadFreeKg, SAFETY_SEAL_FEE: RULES.seal,
  MIN_ORDER_SUBTOTAL: RULES.minOrder, BOTTLE_DEPOSIT_LOOSE: RULES.looseBottle,
};
for (const [k, v] of Object.entries(want)) if (P[k] !== v) throw new Error(`pricing.js ${k} is ${P[k]}, documents say ${v}: update the pack`);
if (P.CRATE_FEE + P.CRATE_SIZE * P.BOTTLE_DEPOSIT_IN_CRATE !== RULES.crate) throw new Error('crate charge changed: update the pack');

// ── Worked example: one evening order, 5 km, card ─────────────────────────
const EX = (() => {
  const items = 700; // drinks, at Ekoyini prices (mix of beer 7% and spirits 5%: about 6%)
  const shelf = items / 1.06; // what the tavern is paid
  const markup = items - shelf;
  const care = Math.min(RULES.careMax, Math.max(RULES.careMin, items * RULES.carePct / 100));
  const delivery = RULES.deliveryBase + (5 - RULES.baseKm) * RULES.perKm; // 5 km
  const surge = RULES.peak;
  const total = items + care + delivery + surge;
  const yoco = total * 0.0325 + 2.5; // card fee
  const ekoyiniGross = markup + care;
  const ekoyiniNet = ekoyiniGross - yoco;
  return { items, shelf, markup, care, delivery, surge, total, yoco, ekoyiniGross, ekoyiniNet, driver: delivery + surge };
})();

// ── Dispatcher pay proposal ────────────────────────────────────────────────
const PAY = {
  hourly: 40, shiftHours: 8, perOrder: 5,
  shift() { return this.hourly * this.shiftHours; },
};
const breakEvenOrders = Math.ceil(PAY.shift() / EX.ekoyiniNet);

// ── Shared look ────────────────────────────────────────────────────────────
const CSS = `
@page { size: A4; margin: 22mm 16mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, 'DejaVu Sans', sans-serif; color: ${C.ink}; font-size: 12.5px; line-height: 1.5; }
h1 { font-size: 30px; line-height: 1.1; margin: 0 0 8px; letter-spacing: -.02em; }
h2 { font-size: 19px; margin: 22px 0 6px; color: ${C.green}; letter-spacing: -.01em; break-after: avoid; }
h3 { font-size: 14px; margin: 14px 0 4px; break-after: avoid; }
p { margin: 0 0 8px; }
.cover { background: ${C.green}; color: #fff; border-radius: 18px; padding: 26px 24px; margin-bottom: 16px; }
.cover h1 { color: #fff; }
.cover p { color: #e6f2ea; font-size: 14px; margin: 0; }
.cover .kicker { color: #fbb48f; }
.kicker { color: ${C.orange}; font-weight: 800; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 6px; }
.logo { height: 54px; margin: 0 0 14px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.card { border: 1px solid ${C.line}; border-radius: 12px; padding: 10px 12px; background: #fff; break-inside: avoid; }
.card.hl { background: ${C.paper}; border-color: #eadfc8; }
.card b.big { display: block; font-size: 22px; color: ${C.green}; }
.warn { border-left: 4px solid ${C.orange}; background: #fff6f1; padding: 8px 12px; border-radius: 6px; margin: 8px 0; break-inside: avoid; }
.ok { border-left: 4px solid ${C.green2}; background: #f2f8f4; padding: 8px 12px; border-radius: 6px; margin: 8px 0; break-inside: avoid; }
ol, ul { margin: 4px 0 8px; padding-left: 20px; }
li { margin: 2px 0; }
ol.steps { counter-reset: s; list-style: none; padding: 0; }
ol.steps > li { counter-increment: s; position: relative; padding: 4px 0 4px 34px; break-inside: avoid; }
ol.steps > li::before { content: counter(s); position: absolute; left: 0; top: 3px; width: 24px; height: 24px; border-radius: 50%; background: ${C.green}; color: #fff; font-weight: 800; font-size: 12px; display: grid; place-items: center; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; break-inside: avoid; }
td, th { padding: 6px 8px; border-bottom: 1px solid ${C.line}; text-align: left; vertical-align: top; }
th { font-size: 10.5px; color: ${C.muted}; text-transform: uppercase; letter-spacing: .06em; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.tot td { font-weight: 800; border-top: 2px solid ${C.ink}; }
.contact { background: ${C.ink}; color: #fff; border-radius: 14px; padding: 12px 16px; display: flex; gap: 14px; align-items: center; margin-top: 14px; break-inside: avoid; }
.contact img { width: 44px; height: 44px; border-radius: 10px; background: #fff; padding: 3px; }
.contact span { color: #cfcac0; }
.clause { margin: 0 0 7px; break-inside: avoid; }
.clause b { color: ${C.green}; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 26px; margin-top: 18px; break-inside: avoid; }
.sign div { border-bottom: 1px solid #888; height: 34px; font-size: 10.5px; color: ${C.muted}; display: flex; align-items: flex-end; }
.draft { font-size: 10.5px; color: ${C.muted}; border: 1px dashed #c9c1ae; padding: 6px 10px; border-radius: 8px; margin: 8px 0 12px; }
.check li { list-style: none; margin-left: -18px; }
.check li::before { content: '☐ '; font-size: 14px; color: ${C.green}; }
.pb { break-before: page; }
.note { font-size: 10.5px; color: ${C.muted}; }
`;

const head = (title) => `<img class="logo" src="${logo}" alt="Ekoyini">`;
const cover = (kicker, title, lead) => `${head(title)}<div class="cover"><div class="kicker">${kicker}</div><h1>${title}</h1><p>${lead}</p></div>`;
const LIAISON = `<div class="contact"><img src="${icon}" alt=""><div><b>Thanduxolo Makeleni</b><br><span>Township Onboarding Liaison Officer · Ekoyini</span><br><span>WhatsApp ${CO.whatsapp} · ${CO.email} · ${CO.web}</span></div></div>`;
const DRAFT = `<div class="draft"><b>Draft for signature.</b> This agreement is written in plain language from Ekoyini's working rules. Before the first one is signed, have it checked once by an attorney or labour consultant. Each party keeps a signed copy.</div>`;
const companyBlock = `<b>${CO.trading}</b> (registered as ${CO.legal}, registration number ${CO.reg}), ${CO.address} ("<b>Ekoyini</b>")`;
const signEkoyini = (other) => `<div class="sign"><div>For Ekoyini: name and title</div><div>${other}: full name</div><div>Signature and date</div><div>Signature and date</div><div>Place</div><div>Witness name and signature</div></div>`;

function doc(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

const rateTable = `<table><tr><th>What you are paid for</th><th class="n">Amount</th></tr>
  <tr><td>Delivery, first ${RULES.baseKm} km from the tavern</td><td class="n">${R(RULES.deliveryBase)}</td></tr>
  <tr><td>Every km after that</td><td class="n">${R(RULES.perKm)} a km</td></tr>
  <tr><td>Heavy load (above ${RULES.loadFreeKg} kg, e.g. crates)</td><td class="n">R1.50 a kg</td></tr>
  <tr><td>Peak surge, 16:00 to 22:00</td><td class="n">+${R(RULES.peak)}</td></tr>
  <tr><td>Late-night surge, 22:00 to 04:00</td><td class="n">+${R(RULES.late)}</td></tr>
  <tr><td>Priority tip chosen by the customer</td><td class="n">R10 to R50</td></tr>
  <tr class="tot"><td>Your share of all of the above</td><td class="n">100%</td></tr></table>`;

// ═════════════════════ 1. HOW IT WORKS + PROPOSAL ═══════════════════════
const overview = doc('Ekoyini: how it works and team proposal', `
${cover('For the Ekoyini team · ' + VERSION, 'How Ekoyini works, and the team we need', 'One page per role: the customer, the partner tavern, the driver and the dispatcher, how the money moves, and a proposal for paying dispatchers.')}
<h2>1. Ekoyini in one paragraph</h2>
<p>Ekoyini is a delivery platform for Nelson Mandela Bay. <b>Partner taverns sell the drinks</b> at their own shelf price; Ekoyini lists them in the app with a small markup (7% beer, cider and wine; 5% spirits, mixers and water), takes the order and the payment, and a <b>driver who is already on the road</b> collects from the nearest tavern and delivers. The tavern and the driver are paid every day at 12:00 for the day before.</p>

<h2>2. The four people in every order</h2>
<div class="grid2">
  <div class="card hl"><b>Customer</b><br>Orders on ${CO.web}, pays by card, EFT (immediate payment or PayShap) or cash (after ${RULES.codOrders} delivered orders). Gets a 4-digit <b>delivery PIN</b> and live tracking.</div>
  <div class="card hl"><b>Partner tavern</b><br>Packs the order cold within 10 minutes, gives it to the driver only against the 4-digit <b>collection PIN</b>, marks items sold out. Uses the Tavern portal or WhatsApp.</div>
  <div class="card hl"><b>Driver</b><br>Takes the job on the Job board (up to ${RULES.maxJobs} at a time), collects with the collection PIN + location, delivers with the customer's PIN after checking ID (18+).</div>
  <div class="card hl"><b>Dispatcher</b><br>Watches the orders, confirms EFT payments, makes sure every order has a tavern and a driver, sends the WhatsApps, and steps in when an alert turns amber or red.</div>
</div>

<h2>3. One order, start to finish</h2>
<ol class="steps">
  <li><b>Customer pays.</b> Card goes through Yoco straight away; EFT waits until the dispatcher sees the money in the bank and taps <i>Confirm Payment Received</i>.</li>
  <li><b>The job appears</b> on the drivers' Job board (area, distance and pay only: no address, no customer). Phones ring.</li>
  <li><b>A driver takes it.</b> The app picks the nearest tavern that has the items. The tavern gets the order and its collection PIN in the portal (and the dispatcher can send it on WhatsApp too).</li>
  <li><b>Tavern packs</b> and taps <i>Ready</i>. Driver arrives, the tavern reads out the collection PIN, the driver types it in with location on: live tracking starts.</li>
  <li><b>At the gate</b> the driver checks ID, gets the customer's delivery PIN and types it in. The order is delivered; both receive a receipt.</li>
  <li><b>Next day 12:00</b> Payouts shows what each tavern and driver is owed. Super admin pays and taps <i>Mark as paid</i>.</li>
</ol>

<h2>4. Where the money goes (example order)</h2>
<p>An evening order, 5 km from the tavern, R${EX.items} of drinks, paid by card:</p>
<table><tr><th>Line</th><th class="n">Customer pays</th><th>Goes to</th></tr>
  <tr><td>Drinks</td><td class="n">${R(EX.items, 2)}</td><td>Tavern ${R(EX.shelf, 2)} (its shelf price) + Ekoyini ${R(EX.markup, 2)} (markup)</td></tr>
  <tr><td>Care &amp; Handling (${RULES.carePct}%, min R${RULES.careMin}, max R${RULES.careMax})</td><td class="n">${R(EX.care, 2)}</td><td>Ekoyini</td></tr>
  <tr><td>Delivery (5 km)</td><td class="n">${R(EX.delivery, 2)}</td><td>Driver, 100%</td></tr>
  <tr><td>Peak surge</td><td class="n">${R(EX.surge, 2)}</td><td>Driver, 100%</td></tr>
  <tr class="tot"><td>Total</td><td class="n">${R(EX.total, 2)}</td><td></td></tr></table>
<p>Ekoyini keeps <b>${R(EX.ekoyiniGross, 2)}</b>, less the card fee (3.25% + R2.50 = ${R(EX.yoco, 2)}): about <b>${R(EX.ekoyiniNet)} per card order</b>. EFT orders have no card fee. Every salary, advert and server cost is paid from this amount.</p>

<h2 class="pb">5. Proposal: the dispatcher role and pay</h2>
<div class="warn"><b>This is a proposal for the owner to decide.</b> Nothing here is agreed until the dispatcher agreement is signed.</div>
<h3>Why dispatchers are employees, not contractors</h3>
<p>A dispatcher works set shifts, on our system, following our instructions. South African labour law (LRA section 200A) presumes such a person is an <b>employee</b>, whatever the contract calls them. Drivers are different: they choose which jobs to take and when, use their own vehicle, and are paid per delivery, so they stay independent contractors. We therefore propose a <b>part-time employment contract</b> for dispatchers. That means:</p>
<ul>
  <li>At least the <b>national minimum wage, ${R(RULES.nmw, 2)} an hour</b> (from 1 March 2026).</li>
  <li>Register Ekoyini as an employer for <b>UIF</b> (uFiling): 1% from the dispatcher and 1% from Ekoyini each month. COIDA registration as well.</li>
  <li>Paid leave builds up (1 day for every 17 days worked), and a written contract (the Dispatcher Agreement in this pack).</li>
  <li>PAYE tax only if a dispatcher earns above the SARS tax threshold.</li>
</ul>

<h3>Proposed pay</h3>
<table><tr><th>Part</th><th class="n">Amount</th><th>Why</th></tr>
  <tr><td>Hourly rate</td><td class="n">${R(PAY.hourly)} an hour</td><td>About 32% above the minimum wage; competitive for evening and weekend work</td></tr>
  <tr><td>Shift (${PAY.shiftHours} hours)</td><td class="n">${R(PAY.shift())}</td><td>Paid whether it is busy or quiet</td></tr>
  <tr><td>Order bonus</td><td class="n">${R(PAY.perOrder)} per order</td><td>For every order dispatched in the shift that is <b>delivered</b> (not cancelled)</td></tr></table>
<p>A shift pays for itself after about <b>${breakEvenOrders} card orders</b> (${R(PAY.shift())} ÷ about ${R(EX.ekoyiniNet)} per order).</p>

<h3>Growing in three stages</h3>
<table><tr><th>Stage</th><th>Orders a day</th><th>Who dispatches</th><th class="n">Monthly cost (about)</th></tr>
  <tr><td><b>1. Launch</b></td><td>under 15</td><td>The super admin on weekdays; one dispatcher Fri 16:00–24:00, Sat 16:00–24:00, Sun 12:00–20:00</td><td class="n">${R(PAY.shift() * 3 * 4.33)} + bonuses</td></tr>
  <tr><td><b>2. Growing</b></td><td>15 to 40</td><td>A dispatcher every evening 16:00–24:00 (two people sharing the week)</td><td class="n">${R(PAY.shift() * 7 * 4.33)} + bonuses</td></tr>
  <tr><td><b>3. Busy</b></td><td>over 40</td><td>A full-time lead dispatcher (about R8 000 to R10 000 a month) plus weekend help</td><td class="n">from R10 000</td></tr></table>
<p class="note">Monthly figures: shift pay × shifts × 4.33 weeks, before UIF (1%) and order bonuses. Move to the next stage only when the orders have been there for a full month.</p>

<h3>What a dispatcher must have</h3>
<ul><li>A smartphone with WhatsApp linked to the business number (064 004 5465) and data; a quiet place to work.</li><li>Grade 12 or similar, good reading and typing, calm on the phone in English and isiXhosa.</li><li>A clean record with money and customers. Signs the confidentiality part of the agreement (POPIA).</li></ul>

<h2>6. What is in this pack</h2>
<table><tr><th>Document</th><th>Who gets it</th></tr>
  <tr><td>Tavern Onboarding Guide</td><td>Every partner tavern (and its packers)</td></tr>
  <tr><td>Partner Tavern Agreement</td><td>Tavern owner or licence holder signs</td></tr>
  <tr><td>Driver Onboarding Guide</td><td>Every driver</td></tr>
  <tr><td>Driver Agreement</td><td>Driver signs (with the Driver rules, version 1.1)</td></tr>
  <tr><td>Dispatcher Operations Manual</td><td>Every dispatcher; keep it open during shifts</td></tr>
  <tr><td>Dispatcher Agreement</td><td>Dispatcher signs</td></tr></table>
${LIAISON}`);

// ═════════════════════ 2. TAVERN ONBOARDING GUIDE ═════════════════════
const tavernGuide = doc('Ekoyini Tavern Onboarding Guide', `
${cover('Partner taverns · ' + VERSION, 'Tavern Onboarding Guide', 'Everything you and your packers need to sell on Ekoyini: what to prepare, how an order works, the portal, and how you are paid.')}
<h2>1. Before you start: what we need from you</h2>
<ul class="check">
  <li>A copy of your <b>liquor licence</b> (you stay the seller of the drinks; Ekoyini is your agent)</li>
  <li>A <b>dedicated WhatsApp number</b> for Ekoyini orders, on a phone that stays at the counter</li>
  <li>The <b>exact location</b> of the tavern (we pin it on the map so orders go to the nearest tavern)</li>
  <li>Your <b>bank details</b> for daily payouts, and your trading hours</li>
  <li>The details for the customer's receipt: legal or trading name, licence number, VAT number (if registered), street address</li>
  <li>A <b>packer on duty</b> on Friday, Saturday, Sunday and month-end, so drivers never wait in the queue</li>
  <li>Photos of your tavern (only if you want to be featured on the app)</li>
  <li>The signed <b>Partner Tavern Agreement</b></li>
</ul>

<h2>2. How an order reaches you</h2>
<ol class="steps">
  <li><b>The order arrives.</b> Your portal phone rings and shows the order with a 4-digit <b>Collection PIN</b>. Ekoyini may also send it to your WhatsApp. You never receive the customer's name, address or number.</li>
  <li><b>Pack it within 10 minutes</b>, cold. Check every item and that sealed bottles are sealed. If something is out of stock, tell dispatch at once.</li>
  <li><b>Tap Ready</b> in the portal.</li>
  <li><b>The driver arrives</b> and shows the order code. Hand over and <b>read the Collection PIN to the driver</b>, who types it in. Only then has the order left your care.</li>
</ol>
<div class="warn"><b>Never give the Collection PIN to anyone except the driver collecting that order, in person, at handover.</b> Do not send it on WhatsApp or say it on the phone.</div>

<h2>3. The Tavern portal</h2>
<p>Open <b>${LINKS.tavern}</b> on the counter phone. Sign in with your tavern's WhatsApp number and the <b>6-digit PIN</b> Ekoyini sends you. Then add it to the home screen (Android: menu ⋮ → Add to Home screen; iPhone: Share → Add to Home Screen) and tap <b>Turn on order alerts</b>.</p>
<table><tr><th>Tab</th><th>What it is for</th></tr>
  <tr><td><b>Orders</b></td><td><i>Pack these now</i> (with the Collection PIN and a Ready button), <i>Coming your way</i>, and <i>Collected in the last 24 hours</i></td></tr>
  <tr><td><b>Items</b></td><td>Mark a drink <b>sold out</b> at your tavern. New orders with that drink go to the next nearest tavern. Switch it back when you restock.</td></tr>
  <tr><td><b>Money</b></td><td>What you are owed for today so far and for yesterday</td></tr></table>
<p><b>Loud on weekends?</b> Keep both: the portal alert <i>and</i> Ekoyini's WhatsApp. In WhatsApp open the Ekoyini chat → Custom notifications → loudest tone and long vibration, and pin the chat to the top.</p>

<h2>4. How you are paid</h2>
<ul>
  <li>You receive <b>your own shelf price</b> for everything you sold through Ekoyini, plus the bottles &amp; crates deposit (R${RULES.crate} a crate of 12 returnable quarts, R${RULES.looseBottle} a loose bottle).</li>
  <li>Ekoyini's markup (7% beer, cider and wine; 5% spirits, mixers and water) is added on top for the customer: <b>it never comes out of your price</b>.</li>
  <li>Paid <b>every day at 12:00</b> for the orders delivered the day before, into your bank account. The Money tab shows the same amount.</li>
  <li>No joining fee, no monthly fee.</li>
</ul>
<p>Example: a customer buys drinks for R${EX.items} on Ekoyini. Your shelf price for those drinks is about ${R(EX.shelf, 2)}: that is what you are paid.</p>

<h2>5. Good practice</h2>
<ul>
  <li>Keep prices honest: tell Ekoyini when your shelf price changes.</li>
  <li>Wrong or missing items are fixed at the tavern's cost (we bring the right item or refund the customer).</li>
  <li>Breakage before handover is the tavern's; after the Collection PIN it is the driver's.</li>
  <li>Never hand alcohol to someone who looks under 18, drunk, or is not the Ekoyini driver.</li>
</ul>
${LIAISON}`);

// ═════════════════════ 3. PARTNER TAVERN AGREEMENT ════════════════════
const tavernAgreement = doc('Ekoyini Partner Tavern Agreement', `
${head()}<div class="kicker">${VERSION}</div><h1>Partner Tavern Agreement</h1>
${DRAFT}
<p>Between ${companyBlock}, and</p>
<p>Tavern name: ______________________________ Liquor licence number: ____________________<br>Licence holder (full name / company): ______________________________ ID / registration: ____________________<br>Address: ____________________________________________ WhatsApp number: ____________________<br>("<b>the Tavern</b>")</p>

<h2>1. What this agreement is about</h2>
<p class="clause"><b>1.1</b> The Tavern sells drinks from its licensed premises to customers who order on the Ekoyini app and website. <b>The Tavern is the seller of the drinks</b> and holds the liquor licence. Ekoyini acts as the Tavern's <b>agent</b> to list the drinks, take orders and payments, and arrange delivery through independent drivers.</p>
<p class="clause"><b>1.2</b> This agreement is not exclusive. The Tavern may keep selling in any other way.</p>

<h2>2. Prices and payment</h2>
<p class="clause"><b>2.1</b> The Tavern's price for each drink is its normal shelf price. Ekoyini adds its fee on top: <b>7%</b> on beer, cider, ready-to-drink and wine, and <b>5%</b> on spirits, liqueurs, mixers, water and ice. The customer also pays Ekoyini's delivery and service fees. None of these come out of the Tavern's price.</p>
<p class="clause"><b>2.2</b> Ekoyini collects the customer's payment as the Tavern's agent and pays the Tavern its shelf price, plus any bottle and crate deposits, <b>every day at 12:00</b> for orders delivered the previous day, by EFT to the account below. Cash orders are collected by the driver and settled by Ekoyini in the same daily payout.</p>
<p class="clause"><b>2.3</b> The Tavern pays Ekoyini no joining fee and no monthly fee.</p>
<p class="clause"><b>2.4</b> The Tavern tells Ekoyini within 7 days if a payout looks wrong. Ekoyini checks and corrects it in the next payout.</p>
<p class="clause"><b>2.5</b> If an item was missing, wrong, past its date or not sealed, the cost of fixing it for the customer (replacement or refund) is deducted from the Tavern's next payout, after Ekoyini has told the Tavern and given it a chance to explain.</p>

<h2>3. What the Tavern does</h2>
<p class="clause"><b>3.1</b> Keeps its liquor licence valid and gives Ekoyini a copy; tells Ekoyini at once if the licence is suspended, ends or changes.</p>
<p class="clause"><b>3.2</b> Keeps a dedicated WhatsApp number for Ekoyini orders, and a person to pack orders on Fridays, Saturdays, Sundays, public holidays and month-end.</p>
<p class="clause"><b>3.3</b> Packs each order correctly, cold and sealed within 10 minutes; marks it Ready in the portal; and hands it only to the Ekoyini driver who gives the order code, against the 4-digit Collection PIN. The Tavern never shares the Collection PIN in any other way.</p>
<p class="clause"><b>3.4</b> Marks items sold out in the portal (or tells dispatch) as soon as it runs out, and tells Ekoyini about shelf-price changes.</p>
<p class="clause"><b>3.5</b> Trades only within its licensed hours and never sells to anyone under 18.</p>
<p class="clause"><b>3.6</b> Is responsible for the drinks until handover to the driver (breakage, loss or quality); after the Collection PIN is entered the driver is responsible.</p>

<h2>4. What Ekoyini does</h2>
<p class="clause"><b>4.1</b> Lists the Tavern's drinks, runs the app, payments, customer service and dispatch; sends orders to the nearest suitable tavern.</p>
<p class="clause"><b>4.2</b> Pays the Tavern daily as in clause 2.2 and gives it access to the Tavern portal.</p>
<p class="clause"><b>4.3</b> Requires every driver to check ID (18+) at handover and to follow the Driver rules.</p>
<p class="clause"><b>4.4</b> May feature the Tavern's name, area and the photos it provides on the app, but only with the Tavern's consent below.</p>

<h2>5. Customer information and confidentiality</h2>
<p class="clause"><b>5.1</b> Ekoyini does not share customers' names, addresses or numbers with the Tavern. If the Tavern ever receives personal information about a customer or driver, it keeps it confidential, uses it only for that order, and deletes it afterwards (Protection of Personal Information Act).</p>
<p class="clause"><b>5.2</b> Each party keeps the other's business information confidential.</p>

<h2>6. Duration and ending</h2>
<p class="clause"><b>6.1</b> This agreement starts when both parties sign and continues month to month. Either party may end it with <b>14 days' written notice</b> (WhatsApp is fine).</p>
<p class="clause"><b>6.2</b> Ekoyini may suspend or end it at once if the Tavern loses its licence, sells to a minor, acts dishonestly with orders or money, or repeatedly fails clause 3.</p>
<p class="clause"><b>6.3</b> Money owed for orders delivered before the end is still paid.</p>

<h2>7. General</h2>
<p class="clause"><b>7.1</b> Ekoyini's customer Terms of Use (${LINKS.terms}) apply to the customer's order. This agreement is governed by South African law.</p>
<p class="clause"><b>7.2</b> Changes to this agreement are valid only in writing signed (or accepted on WhatsApp) by both parties. Ekoyini gives at least 14 days' notice of any change to its fees in clause 2.1.</p>

<h2>8. Payout details and consent</h2>
<p>Bank: ____________________ Account holder: ____________________ Account number: ____________________ Branch code: __________</p>
<p>☐ We agree that Ekoyini may show our tavern's name, area and the photos we provide in the app's "Our partner taverns" section.</p>
${signEkoyini('For the Tavern')}`);

// ═════════════════════ 4. DRIVER ONBOARDING GUIDE ═════════════════════
const driverGuide = doc('Ekoyini Driver Onboarding Guide', `
${cover('Drivers · ' + VERSION, 'Driver Onboarding Guide', 'How to join, how to use the Driver app, how a delivery works step by step, and how and when you are paid.')}
<h2>1. What you need</h2>
<ul class="check">
  <li>A valid <b>driver's licence</b> and a roadworthy car or motorbike (with licence disc)</li>
  <li>Your <b>ID</b>, and a smartphone with data, location and WhatsApp</li>
  <li><b>Bank details</b> for daily payouts</li>
  <li>The signed <b>Driver Agreement</b> and <b>Driver rules</b> (${LINKS.rules})</li>
</ul>
<p>Ekoyini keeps these in your staff file. You will get a WhatsApp from Ekoyini with your sign-in: the link, your cell number and a <b>6-digit PIN</b>.</p>

<h2>2. Set up the Driver app (5 minutes)</h2>
<ol class="steps">
  <li>Open <b>${LINKS.driver}</b>, enter your cell number and PIN.</li>
  <li>Add it to your home screen (Android: menu ⋮ → Add to Home screen; iPhone: Share → Add to Home Screen, and always open it from that icon).</li>
  <li>Tap <b>Turn on job alerts</b> and allow notifications, so your phone rings for new jobs.</li>
</ol>
<table><tr><th>Tab</th><th>What it is for</th></tr>
  <tr><td><b>Job board</b></td><td>Open jobs near you: area, distance, what you will earn, number of items. No address or customer until you take it. Tap to take a job; first come, first served. Up to ${RULES.maxJobs} jobs at a time.</td></tr>
  <tr><td><b>My jobs</b></td><td>The jobs you took: navigate to the tavern and customer, call the tavern or customer, WhatsApp the customer, open the job link.</td></tr>
  <tr><td><b>Earnings</b></td><td>What you earned, cash you hold, and a receipt for every delivery.</td></tr></table>

<h2>3. A delivery, step by step</h2>
<ol class="steps">
  <li><b>Take the job</b> on the Job board. The app picks the nearest tavern that has everything.</li>
  <li><b>At the tavern</b>, show the order code. Check the items, the count and that seals are intact <i>before</i> you leave.</li>
  <li><b>Confirm pickup:</b> the tavern reads you the 4-digit <b>Collection PIN</b>; type it in with your location on. Live tracking starts by itself. From now the order is in your care.</li>
  <li><b>Drive straight to the customer.</b> No stops. Keep your phone and location on (dispatch is warned after ${RULES.alert.silent} minutes without a location).</li>
  <li><b>At the gate:</b> check ID (18+). No ID, under 18 or drunk: no handover, call dispatch.</li>
  <li><b>Ask for the customer's 4-digit delivery PIN</b> and type it in. Delivered. Never hand over without it.</li>
</ol>

<h2>4. What you earn</h2>
${rateTable}
<p>Example: a 5 km evening delivery pays ${R(RULES.deliveryBase)} + ${R(2 * RULES.perKm)} + ${R(RULES.peak)} surge = <b>${R(EX.driver)}</b>, plus any priority tip.</p>
<h3>When you are paid</h3>
<p>Every day at 12:00 for the deliveries of the day before, by EFT. The Earnings tab and Ekoyini's Payouts statement show every trip.</p>
<h3>Cash orders</h3>
<p>Some trusted customers pay cash (up to ${R(RULES.codMax)}). You collect the full amount, <b>keep your fees from it</b>, and pay the rest in to Ekoyini the same day. Example: you collect R900 and your fees were R72, so you pay in R828. If you hold more cash than you earned, your payout shows what to pay in.</p>

<h2>5. The rules that protect you (summary)</h2>
<ul>
  <li>Zero alcohol while on duty. Respect for every customer and tavern.</li>
  <li>The order is in your care from the Collection PIN to the delivery PIN. Breakage or loss in that time is yours to pay, like a dropped glass in a restaurant: only the real cost, you can explain first, never more than 25% of a payday. <b>Genuine accidents and robberies reported to the police cost you nothing.</b> Your safety comes first: never resist a robbery.</li>
  <li>Do not deliver to no-delivery areas or unsafe addresses: ask dispatch.</li>
  <li>Customer details are only for that delivery. Never save, share or contact a customer afterwards.</li>
</ul>
<p>The full rules are at ${LINKS.rules}. Questions: WhatsApp dispatch.</p>
${LIAISON}`);

// ═════════════════════ 5. DRIVER AGREEMENT ════════════════════════════
const driverAgreement = doc('Ekoyini Driver Agreement', `
${head()}<div class="kicker">${VERSION}</div><h1>Independent Driver Agreement</h1>
${DRAFT}
<p>Between ${companyBlock}, and</p>
<p>Driver full name: ______________________________ ID number: ____________________<br>Cell number: ____________________ Address: ____________________________________________<br>Vehicle (make, colour): ____________________ Registration: ____________ Licence number: ____________________<br>("<b>the Driver</b>")</p>

<h2>1. The relationship</h2>
<p class="clause"><b>1.1</b> The Driver is an <b>independent contractor</b>, not an employee of Ekoyini. The Driver decides when to work and which jobs to take or decline, may work for others (for example e-hailing), and uses their own vehicle, phone and data.</p>
<p class="clause"><b>1.2</b> The Driver is responsible for their own licence, vehicle roadworthiness, insurance, fuel, traffic fines and income tax (SARS).</p>

<h2>2. The work</h2>
<p class="clause"><b>2.1</b> The Driver takes delivery jobs in the Ekoyini Driver app or from dispatch, collects from the partner tavern against the Collection PIN, and delivers to the customer against the customer's delivery PIN, as described in the Driver Onboarding Guide.</p>
<p class="clause"><b>2.2</b> The Driver follows the <b>Ekoyini Driver rules and liability, version 1.1</b> (${LINKS.rules}), which form part of this agreement, including: checking ID (18+), zero alcohol on duty, no unattended alcohol, no-delivery areas, and keeping location on during deliveries.</p>

<h2>3. Pay</h2>
<p class="clause"><b>3.1</b> For each completed delivery the Driver earns <b>100%</b> of the delivery fee (R${RULES.deliveryBase} for the first ${RULES.baseKm} km, then R${RULES.perKm} a km), the load fee (R1.50 a kg above ${RULES.loadFreeKg} kg), surge fees (R${RULES.peak} from 16:00 to 22:00, R${RULES.late} from 22:00 to 04:00) and any priority tip the customer chose.</p>
<p class="clause"><b>3.2</b> Ekoyini pays every day at 12:00 for the deliveries of the previous day, by EFT to the account below.</p>
<p class="clause"><b>3.3</b> On cash orders the Driver collects the full amount, keeps their fees for that trip, and pays the balance to Ekoyini the <b>same day</b> (by 12:00 the next day at the latest). Unpaid cash is set off against the Driver's payouts.</p>
<p class="clause"><b>3.4</b> Ekoyini may change the rates with at least 7 days' notice on WhatsApp. Jobs already taken are paid at the old rate.</p>

<h2>4. Breakage, loss and deductions</h2>
<p class="clause"><b>4.1</b> From the Collection PIN until the customer's delivery PIN is accepted, the order is in the Driver's care. The Driver is liable for breakage, spillage or loss in that time, except for a genuine accident not caused by carelessness, or a robbery, reported to dispatch at once and to the police (case number within 24 hours).</p>
<p class="clause"><b>4.2</b> <b>The Driver agrees in writing, in advance,</b> that Ekoyini may deduct such a loss from money due to the Driver, but only: the actual replacement cost, after telling the Driver in writing and giving 48 hours to explain, and at most 25% of any one payday, with the balance carried over.</p>

<h2>5. Confidentiality and data</h2>
<p class="clause"><b>5.1</b> Customer names, addresses, numbers and PINs are used only to complete that delivery. The Driver never keeps, shares or uses them afterwards (Protection of Personal Information Act).</p>
<p class="clause"><b>5.2</b> The Driver agrees that Ekoyini records their location during deliveries and keeps their staff file (ID, licence, vehicle, bank details), as set out in Ekoyini's Privacy Policy.</p>

<h2>6. Ending</h2>
<p class="clause"><b>6.1</b> Either party may end this agreement at any time with notice on WhatsApp. Ekoyini may pause or end the Driver's access at once for drinking on duty, handing alcohol to a minor, dishonesty with goods or cash, or serious misconduct.</p>
<p class="clause"><b>6.2</b> Earnings for completed deliveries are still paid, less any amount owed under clauses 3.3 and 4.</p>

<h2>7. Payout details</h2>
<p>Bank: ____________________ Account holder: ____________________ Account number: ____________________ Branch code: __________</p>
<p>☐ I have read and received the Driver rules (version 1.1) and the Driver Onboarding Guide.</p>
${signEkoyini('Driver')}`);

// ═════════════════════ 6. DISPATCHER OPERATIONS MANUAL ═════════════════
const A = RULES.alert;
const dispatcherManual = doc('Ekoyini Dispatcher Operations Manual', `
${cover('Dispatchers · ' + VERSION, 'Dispatcher Operations Manual', 'How the system works, what to do every shift, every button you will use, and what to do when something goes wrong.')}
<h2>1. Your job in one sentence</h2>
<p><b>Every paid order gets a tavern and a driver quickly, and arrives safely.</b> You watch the orders, confirm EFT payments, make sure each order is moving, keep taverns, drivers and customers informed, and solve problems before the customer has to call.</p>

<h2>2. Your tools</h2>
<table><tr><th>Tool</th><th>How</th></tr>
  <tr><td><b>Admin page</b></td><td>${LINKS.admin}. Sign in with your own email (the super admin adds you as Dispatcher). Never share your login.</td></tr>
  <tr><td><b>Order alerts</b></td><td>Tap <i>Turn on order alerts</i> on your phone (iPhone: add the admin page to the home screen first). Your phone rings for new orders and delay alerts.</td></tr>
  <tr><td><b>WhatsApp</b></td><td>The admin buttons open WhatsApp with the message ready: <b>you still press send</b>. The device must be linked to the business number <b>064 004 5465</b>.</td></tr>
  <tr><td><b>Bank app</b></td><td>View-only access to check that EFT payments have really arrived (the super admin arranges this).</td></tr></table>

<h2>3. The tabs you use</h2>
<table><tr><th>Tab</th><th>Use it to</th></tr>
  <tr><td><b>Orders</b></td><td>All orders, with filters: <i>Awaiting EFT Payment, Packing, Dispatched, Delivered, Cancelled</i>. Each order card has its buttons.</td></tr>
  <tr><td><b>Drivers</b></td><td>See drivers, add a driver, reset a PIN (green <i>Send PIN on WhatsApp</i> button), pause or resume.</td></tr>
  <tr><td><b>Taverns</b></td><td>See taverns, their number, location and portal; send a portal PIN.</td></tr>
  <tr><td><b>Delivery</b></td><td>Surge pricing on/off (super admin) and the fee rules.</td></tr>
  <tr><td><b>Driver reports</b></td><td>Customer complaints about drivers.</td></tr></table>
<p class="note">Payouts, Staff files, Admins and Activity are for super admins only.</p>

<h2>4. The order card buttons</h2>
<table><tr><th>Button</th><th>When to use it</th></tr>
  <tr><td><b>Confirm Payment Received</b></td><td>EFT orders only, and only when the money <b>shows in the bank account</b>. A proof of payment (POP) is not proof.</td></tr>
  <tr><td><b>Assign</b></td><td>Choose the tavern and the driver yourself (the driver picker lists your drivers). Use it when no driver takes the job from the board.</td></tr>
  <tr><td><b>Post job to drivers group</b></td><td>Builds a WhatsApp post for the drivers' group with area and pay only: no customer details.</td></tr>
  <tr><td><b>1. WhatsApp tavern (prepare)</b></td><td>Sends the tavern what to pack and the Collection PIN (no customer details). Send it for every order, even if the tavern uses the portal.</td></tr>
  <tr><td><b>2. WhatsApp driver (collect &amp; deliver)</b></td><td>Sends the driver the job link (only if you assigned by hand).</td></tr>
  <tr><td><b>WhatsApp customer / WhatsApp driver</b></td><td>One-tap messages to keep the customer informed or check in with the driver.</td></tr>
  <tr><td><b>Driver live location</b></td><td>Opens the map with the driver's position once the order is out.</td></tr>
  <tr><td><b>Card payment QR</b></td><td>For an EFT or cash order the customer wants to pay by card instead: show or send the QR.</td></tr>
  <tr><td><b>Mark Picked Up (Manual)</b></td><td>Only if the driver's phone cannot confirm pickup. Note why.</td></tr>
  <tr><td><b>Deliver / Cancel Order</b></td><td>Deliver only when the driver cannot enter the PIN but delivery is confirmed by the customer. Cancel with the reason, after telling the customer.</td></tr></table>

<h2 class="pb">5. Every shift</h2>
<h3>Start of shift</h3>
<ul class="check"><li>Sign in to admin; order alerts on; phone charged; WhatsApp linked to 064 004 5465</li><li>Open <i>Awaiting EFT Payment</i> and <i>Packing</i>: anything waiting from before your shift?</li><li>Check which drivers are online and which taverns are open (and who has their portal on)</li><li>Read the handover note from the last dispatcher</li></ul>
<h3>During the shift, for every order</h3>
<ol class="steps">
  <li><b>New order rings.</b> Card orders are already paid. EFT: check the bank; when the money is there, tap <i>Confirm Payment Received</i> (if it has not arrived after 30 minutes, WhatsApp the customer).</li>
  <li><b>Within ${A.assign} minutes</b> a driver should take it from the Job board. If not: <i>Post job to drivers group</i>, then <i>Assign</i> by hand.</li>
  <li><b>Tap 1. WhatsApp tavern</b> so the tavern has the order and the Collection PIN in its chat.</li>
  <li><b>Watch the alerts bar</b> (below) until the order shows <i>Delivered</i>.</li>
</ol>
<h3>End of shift</h3>
<ul class="check"><li>No order left in Awaiting EFT or Packing without a plan</li><li>Every order out for delivery has a moving driver</li><li>Write a handover note (WhatsApp to the next dispatcher and the super admin): open problems, drivers holding cash, taverns that were slow</li></ul>

<h2>6. Alerts: amber means look, red means act now</h2>
<table><tr><th>Alert</th><th class="n">Amber</th><th class="n">Red</th><th>What to do</th></tr>
  <tr><td>Paid but no driver</td><td class="n">${A.assign} min</td><td class="n">${A.assign * 2} min</td><td>Post to the drivers group, phone drivers nearby, assign by hand.</td></tr>
  <tr><td>Driver assigned, not collected</td><td class="n">${A.collect} min</td><td class="n">${A.collect * 2} min</td><td>WhatsApp the driver; phone the tavern: is it packed? Reassign if the driver is not coming.</td></tr>
  <tr><td>Driver's location stopped</td><td class="n">${A.silent} min</td><td class="n">${A.silent * 2} min</td><td>WhatsApp then phone the driver. No answer after 10 minutes: tell the super admin.</td></tr>
  <tr><td>Out for delivery too long</td><td class="n">${A.slow} min</td><td class="n">${A.slow * 2} min</td><td>Check live location, phone the driver, update the customer.</td></tr></table>
<p class="note">Each alert is also emailed to the team once at amber and once at red. Taking action is still your job.</p>

<h2>7. When something goes wrong</h2>
<table><tr><th>Problem</th><th>What to do</th></tr>
  <tr><td>Tavern doesn't answer / is closed</td><td>Phone twice. Then reassign to the next nearest open tavern (Assign) and tell the driver.</td></tr>
  <tr><td>Item sold out at the tavern</td><td>Ask the tavern to mark it sold out. Find another tavern with everything, or WhatsApp the customer to swap or remove the item (refunds: super admin).</td></tr>
  <tr><td>Driver doesn't show</td><td>Phone the driver. If they cannot come within 10 minutes, cancel their assignment by reassigning the order to another driver.</td></tr>
  <tr><td>Customer not at the gate / no answer</td><td>Driver waits 10 minutes while you phone and WhatsApp the customer. Then the driver returns the order to the tavern; tell the super admin.</td></tr>
  <tr><td>Customer has no ID, is under 18 or drunk</td><td>No handover, no exceptions. Driver returns the order. Note it on the order.</td></tr>
  <tr><td>Wrong delivery PIN</td><td>The customer finds the PIN on the tracking page or in the email. Never read the PIN to the driver yourself.</td></tr>
  <tr><td>Accident or robbery</td><td>Safety first: is the driver hurt? Police 10111 if in danger. Driver reports at the nearest police station; get the case number within 24 hours. Tell the super admin at once.</td></tr>
  <tr><td>Breakage</td><td>Photo from the driver, note it on the order, tell the super admin (who follows the Driver rules, section 4).</td></tr>
  <tr><td>Customer complaint</td><td>Listen, apologise, write it down with the order code, tell the super admin. Never promise a refund yourself.</td></tr>
  <tr><td>Cash order</td><td>Cash only for customers the system allows (after ${RULES.codOrders} delivered orders, up to ${R(RULES.codMax)}). Remind the driver to pay in the balance the same day.</td></tr></table>

<h2>8. Rules you never break</h2>
<ul>
  <li><b>Customer details stay in the admin page.</b> Never post a customer's name, address or number in a group, never screenshot it, never keep it on your phone.</li>
  <li><b>Collection and delivery PINs are never read out by you.</b> The tavern gives the Collection PIN to the driver at handover; the customer gives the delivery PIN at the gate.</li>
  <li>Confirm EFT only when the money is in the bank.</li>
  <li>No deliveries to anyone under 18, to no-delivery areas, or to unsafe addresses.</li>
  <li>Be polite and calm. If you are unsure, ask the super admin.</li>
</ul>
${LIAISON}`);

// ═════════════════════ 7. DISPATCHER AGREEMENT ════════════════════════
const dispatcherAgreement = doc('Ekoyini Dispatcher Agreement', `
${head()}<div class="kicker">${VERSION}</div><h1>Dispatcher Agreement (part-time employment)</h1>
${DRAFT}
<p>Between ${companyBlock} ("<b>the Employer</b>"), and</p>
<p>Full name: ______________________________ ID number: ____________________<br>Cell number: ____________________ Email (for admin sign-in): ______________________________<br>Address: ____________________________________________ ("<b>the Dispatcher</b>")</p>

<h2>1. Position and start</h2>
<p class="clause"><b>1.1</b> The Dispatcher is employed part-time as <b>Dispatcher</b>, starting on ____ / ____ / ________, working remotely from a place of their choice with reliable signal.</p>
<p class="clause"><b>1.2</b> The first <b>3 months</b> are a probation period, with feedback at least once a month.</p>

<h2>2. Duties</h2>
<p class="clause"><b>2.1</b> The Dispatcher carries out the duties in the <b>Ekoyini Dispatcher Operations Manual</b> (which may be updated, with notice), including watching orders, confirming EFT payments only when the money has arrived, assigning taverns and drivers, sending WhatsApp messages, acting on delay alerts and writing a handover note at the end of each shift.</p>
<p class="clause"><b>2.2</b> The Dispatcher reports to the super admin of Ekoyini.</p>

<h2>3. Hours</h2>
<p class="clause"><b>3.1</b> The Dispatcher works the shifts on the roster agreed each week (for example Friday and Saturday 16:00 to 24:00 and Sunday 12:00 to 20:00). Each shift has a 30-minute break when orders allow. Ordinary hours never exceed 45 a week.</p>
<p class="clause"><b>3.2</b> Shift changes are agreed at least 48 hours ahead, except in an emergency.</p>

<h2>4. Pay</h2>
<p class="clause"><b>4.1</b> <b>R${PAY.hourly} per hour</b> worked on the roster (never less than the national minimum wage, R${RULES.nmw} an hour from 1 March 2026), plus an <b>order bonus of R${PAY.perOrder}</b> for each order the Dispatcher handled during their shift that is delivered.</p>
<p class="clause"><b>4.2</b> Paid by EFT every ______ (weekly / month-end), with a payslip showing hours, bonus and deductions.</p>
<p class="clause"><b>4.3</b> Deductions: UIF (1%) and PAYE income tax if applicable. No other deductions without the Dispatcher's written consent.</p>

<h2>5. Leave</h2>
<p class="clause"><b>5.1</b> Annual leave of 1 day for every 17 days worked; sick leave and family responsibility leave as in the Basic Conditions of Employment Act.</p>

<h2>6. Equipment and access</h2>
<p class="clause"><b>6.1</b> The Dispatcher uses their own smartphone. The Employer pays a data allowance of R______ a month and gives access to the admin page and the business WhatsApp.</p>
<p class="clause"><b>6.2</b> The admin login is personal and every action is recorded. The Dispatcher never shares it and signs out on shared devices.</p>

<h2>7. Confidentiality (POPIA)</h2>
<p class="clause"><b>7.1</b> Customer, driver and tavern information, PINs, prices, payouts and business information are confidential. The Dispatcher uses them only to do the job, never shares them outside the admin page or with anyone not entitled to them, never screenshots or keeps them, and reports any leak at once. This continues after employment ends.</p>

<h2>8. Conduct</h2>
<p class="clause"><b>8.1</b> No alcohol or drugs during shifts. Respectful to every customer, tavern and driver. Never confirms an EFT payment that has not arrived, never shares a PIN, never approves a delivery to a minor.</p>

<h2>9. Ending</h2>
<p class="clause"><b>9.1</b> Notice: 1 week during the first 6 months, 2 weeks after that, in writing (WhatsApp is accepted). Dismissal follows a fair reason and a fair procedure under the Labour Relations Act.</p>
<p class="clause"><b>9.2</b> On the last day the Employer removes the admin access and the Dispatcher returns or deletes any business information.</p>

<h2>10. Payment details</h2>
<p>Bank: ____________________ Account holder: ____________________ Account number: ____________________ Branch code: __________ Tax number (if any): ____________________</p>
<p>☐ I have received and read the Dispatcher Operations Manual.</p>
${signEkoyini('Dispatcher')}`);

// ── Build ─────────────────────────────────────────────────────────────────
const DOCS = [
  ['Ekoyini-1-How-It-Works-and-Team-Proposal', overview, 'For the Ekoyini team'],
  ['Ekoyini-2-Tavern-Onboarding-Guide', tavernGuide, 'Tavern Onboarding Guide'],
  ['Ekoyini-3-Partner-Tavern-Agreement', tavernAgreement, 'Partner Tavern Agreement'],
  ['Ekoyini-4-Driver-Onboarding-Guide', driverGuide, 'Driver Onboarding Guide'],
  ['Ekoyini-5-Driver-Agreement', driverAgreement, 'Independent Driver Agreement'],
  ['Ekoyini-6-Dispatcher-Operations-Manual', dispatcherManual, 'Dispatcher Operations Manual'],
  ['Ekoyini-7-Dispatcher-Agreement', dispatcherAgreement, 'Dispatcher Agreement'],
];
module.exports = { RULES, EX, PAY, breakEvenOrders, DOCS };

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const footer = (label) => `<div style="font-size:8px;color:#5c5a55;width:100%;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>Ekoyini Holdings · ${label} · ${VERSION}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
    for (const [file, html, label] of DOCS) {
      fs.writeFileSync(path.join(__dirname, `${file}.html`), html);
      await page.setContent(html, { waitUntil: 'load' });
      await page.pdf({ path: path.join(__dirname, `${file}.pdf`), format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer(label), margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' } });
      console.log('built', file);
    }
    await browser.close();
  })();
}
